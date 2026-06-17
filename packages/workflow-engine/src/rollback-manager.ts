/**
 * Rollback Manager — 복구 계획 검증 및 실행
 *
 * RemediationPlan의 rollback 계획을 검증하고 실행하는 모듈.
 * DeviceSnapshot을 기반으로 이전 상태로 복구하며,
 * 복구 과정의 증거(evidence)를 수집.
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { DeviceSnapshot as EngineDeviceSnapshot } from './types.js';
import type { DeviceSnapshot as ModelDeviceSnapshot } from './device-model.js';
import type { RemediationPlan, RemediationStep, RollbackPlan } from './remediation-planner.js';

const log = createLogger('rollback-manager');

// ─── Rollback Types ────────────────────────────────────────────────────────

export interface RollbackValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

export interface RollbackStepResult {
  stepId: string;
  title: string;
  success: boolean;
  executedAt: string;
  duration: number;
  output: string;
  error?: string;
}

export interface RollbackEvidence {
  id: string;
  type: 'snapshot_before' | 'snapshot_after' | 'step_log' | 'diff' | 'screenshot';
  description: string;
  data: Record<string, unknown>;
  capturedAt: string;
}

export interface RollbackResult {
  rollbackId: string;
  planId: string;
  success: boolean;
  steps: RollbackStepResult[];
  restoredState: Record<string, unknown>;
  evidence: RollbackEvidence[];
  startedAt: string;
  completedAt: string;
  duration: number;
  error?: string;
  mode: 'dry-run' | 'execute';
}

export interface RollbackExecutionOptions {
  mode?: 'dry-run' | 'execute';
}

// ─── Rollback Manager ──────────────────────────────────────────────────────

export class RollbackManager {

  private rollbackHistory: Map<string, RollbackResult> = new Map();
  private rollbackStepExecutor: ((
    step: RemediationStep,
  ) => Promise<{ success: boolean; output: string; error?: string }>) | null = null;

  setRollbackStepExecutor(
    executor: (step: RemediationStep) => Promise<{ success: boolean; output: string; error?: string }>,
  ): void {
    this.rollbackStepExecutor = executor;
  }

  /**
   * 롤백 계획 검증
   * - rollback steps가 존재하는지
   * - 각 step에 필수 필드가 있는지
   * - 순서(order) 연속성
   * - 롤백 대상 필드 확인
   */
  validateRollbackPlan(plan: RemediationPlan): RollbackValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    log.info(`Validating rollback plan for remediation: ${plan.id}`);

    // rollback plan 존재 여부
    if (!plan.rollback) {
      errors.push('Rollback plan이 정의되지 않았습니다.');
      return { valid: false, errors, warnings, missingFields };
    }

    if (plan.rollback.steps.length === 0) {
      warnings.push('Rollback steps가 비어있습니다. 복구 실패 시 수동 복구가 필요합니다.');
    }

    // 각 step 필수 필드 검증
    for (const step of plan.rollback.steps) {
      if (!step.id) {
        errors.push(`Rollback step에 id가 없습니다.`);
        missingFields.push('step.id');
      }
      if (!step.title) {
        errors.push(`Rollback step ${step.id}에 title이 없습니다.`);
        missingFields.push('step.title');
      }
      if (!step.action) {
        errors.push(`Rollback step ${step.id}에 action이 없습니다.`);
        missingFields.push('step.action');
      }
      if (!step.input || Object.keys(step.input).length === 0) {
        warnings.push(`Rollback step ${step.id}에 input이 비어있습니다.`);
      }
      if (!step.expectedChange) {
        warnings.push(`Rollback step ${step.id}에 expectedChange가 정의되지 않았습니다.`);
      }
    }

    // order 연속성 검사
    const orders = plan.rollback.steps
      .map(s => s.order)
      .sort((a, b) => a - b);

    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        warnings.push(
          `Rollback step 순서가 연속적이지 않습니다. ` +
          `예상: ${i + 1}, 실제: ${orders[i]}`,
        );
        break;
      }
    }

    // step ID 중복 검사
    const stepIds = plan.rollback.steps.map(s => s.id);
    const duplicateIds = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
    if (duplicateIds.length > 0) {
      errors.push(`중복된 rollback step ID: ${duplicateIds.join(', ')}`);
    }

    // trigger condition 확인
    if (plan.rollback.automaticTrigger && !plan.rollback.triggerCondition) {
      warnings.push('자동 트리거가 활성화되었지만 triggerCondition이 정의되지 않았습니다.');
    }

    const valid = errors.length === 0;
    log.info(
      `Rollback plan validation: ${valid ? 'VALID' : 'INVALID'} ` +
      `(${errors.length} errors, ${warnings.length} warnings)`,
    );

    return { valid, errors, warnings, missingFields };
  }

  /**
   * 롤백 실행
   * - snapshot 기반 이전 상태로 복구
   * - 각 단계별 결과 및 증거 수집
   */
  async executeRollback(
    plan: RemediationPlan,
    snapshot: EngineDeviceSnapshot | ModelDeviceSnapshot | null,
    options: RollbackExecutionOptions = {},
  ): Promise<RollbackResult> {
    const rollbackId = nowId('rollback');
    const startedAt = nowISO();
    const mode = options.mode ?? 'dry-run';

    log.info(`Executing rollback: ${rollbackId} for plan: ${plan.id}`);

    // 검증 먼저 수행
    const validation = this.validateRollbackPlan(plan);
    if (!validation.valid) {
      const errorMsg = `Rollback plan 검증 실패: ${validation.errors.join('; ')}`;
      log.error(errorMsg);

      const result: RollbackResult = {
        rollbackId,
        planId: plan.id,
        success: false,
        steps: [],
        restoredState: {},
        evidence: [],
        startedAt,
        completedAt: nowISO(),
        duration: 0,
        error: errorMsg,
        mode,
      };
      this.rollbackHistory.set(rollbackId, result);
      return result;
    }

    const steps: RollbackStepResult[] = [];
    const evidence: RollbackEvidence[] = [];

    // snapshot evidence (before)
    if (snapshot) {
      evidence.push({
        id: nowId('evidence'),
        type: 'snapshot_before',
        description: '롤백 실행 전 장비 스냅샷',
        data: this.extractSnapshotData(snapshot),
        capturedAt: nowISO(),
      });
    }

    // 롤백 단계 순차 실행
    for (const step of plan.rollback.steps) {
      const stepResult = await this.executeRollbackStep(step, mode);
      steps.push(stepResult);

      // step log evidence
      evidence.push({
        id: nowId('evidence'),
        type: 'step_log',
        description: `Rollback step: ${step.title}`,
        data: {
          stepId: step.id,
          success: stepResult.success,
          output: stepResult.output,
          error: stepResult.error,
        },
        capturedAt: nowISO(),
      });

      // 단계 실패 시 롤백 중단
      if (!stepResult.success) {
        log.warn(`Rollback step failed: ${step.id} — ${stepResult.error}`);
      }
    }

    const completedAt = nowISO();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const allSuccess = steps.every(s => s.success);

    // restored state 구성
    const restoredState = this.buildRestoredState(plan, snapshot);

    // snapshot evidence (after)
    evidence.push({
      id: nowId('evidence'),
      type: 'snapshot_after',
      description: '롤백 실행 후 상태',
      data: restoredState,
      capturedAt: nowISO(),
    });

    const result: RollbackResult = {
      rollbackId,
      planId: plan.id,
      success: allSuccess,
      steps,
      restoredState,
      evidence,
      startedAt,
      completedAt,
      duration,
      error: allSuccess ? undefined : '일부 롤백 단계가 실패했습니다.',
      mode,
    };

    this.rollbackHistory.set(rollbackId, result);

    log.info(
      `Rollback ${rollbackId} completed: ${allSuccess ? 'SUCCESS' : 'PARTIAL'} ` +
      `(${steps.length} steps, ${duration}ms)`,
    );

    return result;
  }

  /**
   * 롤백 이력 조회
   */
  getRollbackHistory(): RollbackResult[] {
    return Array.from(this.rollbackHistory.values());
  }

  /**
   * 특정 롤백 결과 조회
   */
  getRollbackResult(rollbackId: string): RollbackResult | null {
    return this.rollbackHistory.get(rollbackId) ?? null;
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────────────────────────

  /**
   * 단일 롤백 단계 실행 (시뮬레이션)
   */
  private async executeRollbackStep(
    step: RemediationStep,
    mode: 'dry-run' | 'execute',
  ): Promise<RollbackStepResult> {
    const startTime = Date.now();

    log.info(`Executing rollback step: ${step.id} — ${step.title}`);

    if (mode === 'dry-run') {
      return {
        stepId: step.id,
        title: step.title,
        success: true,
        executedAt: nowISO(),
        duration: Date.now() - startTime,
        output: `[SIMULATED] 롤백 예정: ${step.title} (${step.action})`,
      };
    }

    if (!this.rollbackStepExecutor) {
      return {
        stepId: step.id,
        title: step.title,
        success: false,
        executedAt: nowISO(),
        duration: Date.now() - startTime,
        output: '',
        error: 'Rollback executor is not configured for execute mode',
      };
    }

    try {
      const execution = await this.rollbackStepExecutor(step);

      return {
        stepId: step.id,
        title: step.title,
        success: execution.success,
        executedAt: nowISO(),
        duration: Date.now() - startTime,
        output: execution.output,
        error: execution.error,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        stepId: step.id,
        title: step.title,
        success: false,
        executedAt: nowISO(),
        duration: Date.now() - startTime,
        output: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Snapshot에서 복구 상태 데이터 추출
   */
  private extractSnapshotData(
    snapshot: EngineDeviceSnapshot | ModelDeviceSnapshot,
  ): Record<string, unknown> {
    // EngineDeviceSnapshot 타입 확인 (product, currentConfig)
    if ('currentConfig' in snapshot && snapshot.currentConfig) {
      return {
        product: snapshot.product,
        firmwareVersion: snapshot.version,
        currentConfig: snapshot.currentConfig,
        capturedAt: snapshot.collectedAt,
      };
    }

    // ModelDeviceSnapshot 타입 확인 (policies, objects)
    if ('policies' in snapshot) {
      return {
        product: snapshot.product,
        version: snapshot.version,
        policiesCount: snapshot.policies.length,
        objectsCount: snapshot.objects.length,
        collectedAt: snapshot.collectedAt,
      };
    }

    return { snapshot };
  }

  /**
   * 복구 후 상태 구성
   */
  private buildRestoredState(
    plan: RemediationPlan,
    snapshot: EngineDeviceSnapshot | ModelDeviceSnapshot | null,
  ): Record<string, unknown> {
    const state: Record<string, unknown> = {
      planId: plan.id,
      incidentId: plan.incident.id,
      restoredAt: nowISO(),
    };

    if (snapshot) {
      if ('currentConfig' in snapshot && snapshot.currentConfig) {
        state['restoredConfig'] = snapshot.currentConfig;
        state['product'] = snapshot.product;
      }
      if ('policies' in snapshot) {
        state['restoredPolicies'] = snapshot.policies.length;
        state['restoredObjects'] = snapshot.objects.length;
      }
    }

    // rollback steps의 expectedChange 기록
    state['rolledBackFields'] = plan.rollback.steps.map(s => ({
      field: s.expectedChange,
      action: s.action,
    }));

    return state;
  }
}
