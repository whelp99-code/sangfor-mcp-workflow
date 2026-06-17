/**
 * Replan Strategy — 실패한 OperationPlan에 대한 재계획 전략
 *
 * 실행 실패 시 대안 접근법을 생성하여 재계획(plan)을 수립.
 * - 실패한 step을 분석하여 action 변경 등 대안 탐색
 * - 원본 plan의 risk, intent를 보존하면서 step 재구성
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type {
  OperationPlan,
  OperationStep,
  OperationRisk,
} from './types.js';

const log = createLogger('replan-strategy');

// ─── Failure Context ──────────────────────────────────────────────────────

export interface FailureContext {
  /** 실패한 step ID */
  failedStepId: string;
  /** 실패 에러 메시지 */
  errorMessage: string;
  /** 실패 에러 카테고리 (timeout, auth, api_limit, connection, unknown) */
  errorCategory: ReplanFailureCategory;
  /** 이미 시도한 tool/adapter 목록 */
  attemptedTools: string[];
  /** 실행 시각 */
  failedAt: string;
  /** 재시도 횟수 */
  retryCount: number;
}

export type ReplanFailureCategory =
  | 'timeout'
  | 'auth'
  | 'api_limit'
  | 'connection'
  | 'state_mismatch'
  | 'permission'
  | 'unknown';

// ─── Alternative Approach ─────────────────────────────────────────────────

export interface AlternativeApproach {
  toolName: string;
  toolArgs: Record<string, unknown>;
  reason: string;
}

// ─── Replan Strategy ──────────────────────────────────────────────────────

export class ReplanStrategy {
  /**
   * 실패한 plan을 분석하여 재계획을 생성한다.
   *
   * - 실패한 step 이후의 step들을 유지
   * - 실패한 step에 대안 접근법 적용
   * - risk level이 상승할 수 있음을 기록
   * - 새 plan ID 발급
   */
  generateReplan(
    failedPlan: OperationPlan,
    failureContext: FailureContext
  ): OperationPlan {
    log.info(
      `Generating replan for ${failedPlan.id} — failed step: ${failureContext.failedStepId}, ` +
      `category: ${failureContext.errorCategory}, retry: ${failureContext.retryCount}`
    );

    const failedStepIndex = failedPlan.steps.findIndex(
      (s) => s.id === failureContext.failedStepId
    );

    if (failedStepIndex === -1) {
      throw new Error(
        `Failed step not found in plan: ${failureContext.failedStepId}`
      );
    }

    const failedStep = failedPlan.steps[failedStepIndex];

    // 대안 접근법 생성 시도
    const alternative = this.selectAlternativeApproach(failedStep, failureContext);

    // 재계획된 step 구성
    const replannedSteps: OperationStep[] = [...failedPlan.steps];

    if (alternative) {
      // 대안이 있으면 해당 step 교체
      const newStep: OperationStep = {
        ...failedStep,
        id: nowId('step'),
        title: `${failedStep.title} (대안)`,
        action: alternative.toolName,
        input: alternative.toolArgs as Record<string, string | number | boolean>,
      };
      replannedSteps[failedStepIndex] = newStep;

      log.info(
        `Alternative approach found: ${failedStep.action} → ` +
        `${alternative.toolName} (${alternative.reason})`
      );
    } else {
      // 대안이 없으면 step은 유지하되 metadata에 실패 정보 기록
      log.warn(
        `No alternative approach found for step ${failureContext.failedStepId}. ` +
        `Keeping original step with failure annotation.`
      );
    }

    // risk 평가 — 재시도 횟수가 많을수록 risk 상승
    const escalatedRisk = this.evaluateEscalatedRisk(
      failedPlan.risk,
      failureContext
    );

    const newPlanId = nowId('replan');

    const replan: OperationPlan = {
      id: newPlanId,
      intent: { ...failedPlan.intent },
      deviceId: failedPlan.deviceId,
      desiredState: { ...failedPlan.desiredState },
      prechecks: [...failedPlan.prechecks],
      steps: replannedSteps,
      postchecks: [...failedPlan.postchecks],
      rollback: [],
      risk: escalatedRisk,
      approval: {
        required: escalatedRisk.level === 'high' || escalatedRisk.level === 'critical',
        reason: `재계획 에스컬레이션: risk ${escalatedRisk.level}`,
        approverRole: 'admin',
      },
      evidencePolicy: { ...failedPlan.evidencePolicy },
    };

    log.info(
      `Replan generated: ${newPlanId} (risk: ${escalatedRisk.level}, ` +
      `risk escalated)`
    );

    return replan;
  }

  /**
   * 실패한 step에 대한 대안 접근법을 탐색한다.
   *
   * 전략 우선순위:
   * 1. adapter fallback (action에 포함된 adapter 접미사 변경: _api → _ssh → _ui)
   * 2. action 변경 (인증 재시도, 권한 상승 등)
   * 3. null 반환 (대안 없음)
   */
  selectAlternativeApproach(
    failedStep: OperationStep,
    failureContext?: FailureContext
  ): AlternativeApproach | null {
    const attemptedTools = failureContext?.attemptedTools ?? [failedStep.action];
    const errorCategory = failureContext?.errorCategory ?? 'unknown';

    // action에서 adapter 추출 및 fallback 시도
    return this.buildToolAlternative(failedStep, attemptedTools, errorCategory);
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  /**
   * action 기반 대안 구성
   *
   * action에서 adapter 접미사를 추출하여 fallback 시도:
   * - xxx_api → xxx_ssh → xxx_ui
   * - 접미사가 없으면 에러 카테고리 기반 대안 생성
   */
  private buildToolAlternative(
    failedStep: OperationStep,
    attemptedTools: string[],
    errorCategory: ReplanFailureCategory
  ): AlternativeApproach | null {
    const toolName = failedStep.action;

    // adapter 접미사 매핑
    const adapterSuffixes = ['_api', '_ssh', '_ui'];
    const currentSuffix = adapterSuffixes.find((s) => toolName.endsWith(s));
    const baseToolName = currentSuffix
      ? toolName.slice(0, -currentSuffix.length)
      : toolName;

    // 1단계: adapter fallback
    const fallbackOrder = adapterSuffixes.filter((s) => `_api` !== currentSuffix || s !== currentSuffix);

    for (const suffix of fallbackOrder) {
      const candidateTool = `${baseToolName}${suffix}`;
      if (attemptedTools.includes(candidateTool)) continue;

      // API 실패 시 SSH fallback
      if (currentSuffix === '_api' && suffix === '_ssh') {
        if (
          errorCategory === 'timeout' ||
          errorCategory === 'connection' ||
          errorCategory === 'api_limit'
        ) {
          return {
            toolName: candidateTool,
            toolArgs: {
              ...failedStep.input,
              _adapterFallback: true,
              _originalTool: toolName,
            },
            reason: `API ${errorCategory} — fallback to SSH`,
          };
        }
      }

      // SSH 실패 시 API fallback
      if (currentSuffix === '_ssh' && suffix === '_api') {
        if (errorCategory === 'timeout' || errorCategory === 'connection') {
          return {
            toolName: candidateTool,
            toolArgs: {
              ...failedStep.input,
              _adapterFallback: true,
              _originalTool: toolName,
            },
            reason: `SSH ${errorCategory} — fallback to API`,
          };
        }
      }

      // API/SSH 모두 실패 시 UI fallback (최후 수단)
      if (
        (currentSuffix === '_api' || currentSuffix === '_ssh') &&
        suffix === '_ui'
      ) {
        return {
          toolName: candidateTool,
          toolArgs: {
            ...failedStep.input,
            _adapterFallback: true,
            _originalTool: toolName,
            _manualConfirmRequired: true,
          },
          reason: `${currentSuffix} unavailable — fallback to UI (manual)`,
        };
      }
    }

    // 2단계: 에러 카테고리 기반 특수 대안
    if (errorCategory === 'auth') {
      return {
        toolName: 're_authenticate',
        toolArgs: {
          ...failedStep.input,
          _retryAfterAuth: true,
          _originalTool: toolName,
        },
        reason: 'Authentication failure — attempting re-authentication',
      };
    }

    if (errorCategory === 'permission') {
      return {
        toolName: `${baseToolName}_elevated${currentSuffix ?? ''}`,
        toolArgs: {
          ...failedStep.input,
          _elevated: true,
          _originalTool: toolName,
        },
        reason: 'Permission denied — attempting with elevated privileges',
      };
    }

    return null;
  }

  /**
   * 재시도/실패 이력을 반영한 risk 평가
   */
  private evaluateEscalatedRisk(
    originalRisk: OperationRisk,
    failureContext: FailureContext
  ): OperationRisk {
    const escalationFactors: string[] = [];

    // 같은 에러가 반복되면 risk 상승
    if (failureContext.retryCount >= 2) {
      escalationFactors.push(
        `반복 실패 (${failureContext.retryCount}회) — 안정성 우려`
      );
    }

    // state_mismatch는 위험도 상승 요인
    if (failureContext.errorCategory === 'state_mismatch') {
      escalationFactors.push('장비 상태 불일치 — 예상과 다른 상태');
    }

    // permission 실패는 보안 관련
    if (failureContext.errorCategory === 'permission') {
      escalationFactors.push('권한 부족 — 보안 정책 확인 필요');
    }

    const escalatedLevel = this.computeEscalatedLevel(
      originalRisk.level,
      failureContext.retryCount
    );

    return {
      level: escalatedLevel,
      categories: [
        ...originalRisk.categories,
        ...(escalationFactors.length > 0 ? ['replan_escalation'] : []),
      ],
      mitigation: [
        originalRisk.mitigation,
        ...escalationFactors.map((f) => `에스컬레이션: ${f}`),
      ].join('; '),
    };
  }

  /**
   * 원래 risk level + 반복 실패 횟수 → 에스컬레이션된 level
   */
  private computeEscalatedLevel(
    original: OperationRisk['level'],
    retryCount: number
  ): OperationRisk['level'] {
    const levels: OperationRisk['level'][] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(original);

    // 2회 이상 반복 실패 시 1단계 상승
    if (retryCount >= 2 && currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }

    return original;
  }
}
