/**
 * Closed-Loop Runner — 실행 → 검증 → 재계획 자동 루프
 *
 * OperationPlan을 실행하고, 실패 시 ReplanStrategy를 통해
 * 자동으로 재계획한 뒤 재시도하는 closed-loop 패턴 구현.
 *
 * 특징:
 * - 최대 재시도 횟수 제한 (기본 3회)
 * - 동일 실패 패턴 반복 시 자동 중단
 * - 고위험 replan은 approval queue로 이동
 * - 실행 증거(evidence) 수집
 */

import { nowId, nowISO, createLogger, type ProductCode } from '@sangfor/workflow-shared';
import type {
  OperationPlan,
  OperationStep,
  OperationRisk,
  Workflow,
  WorkflowExecutionResult,
} from './types.js';
import { WorkflowExecutor } from './workflow-executor.js';
import { ApprovalManager } from './approval-manager.js';
import { ReplanStrategy } from './replan-strategy.js';
import type { FailureContext, ReplanFailureCategory } from './replan-strategy.js';

const log = createLogger('closed-loop-runner');

// ─── Closed-Loop Result ───────────────────────────────────────────────────

export interface AttemptRecord {
  attemptNumber: number;
  planId: string;
  startedAt: string;
  completedAt: string;
  success: boolean;
  failedStepId?: string;
  errorMessage?: string;
  errorCategory?: ReplanFailureCategory;
  duration: number;
}

export interface ClosedLoopResult {
  /** 최종 성공 여부 */
  success: boolean;
  /** 총 실행 시도 횟수 */
  attempts: number;
  /** replan 발생 횟수 */
  replans: number;
  /** 최종 실행된 plan */
  finalPlan: OperationPlan;
  /** 실행 증거 기록 */
  evidence: AttemptRecord[];
  /** 중단 사유 (실패 시) */
  abortReason?: string;
  /** approval queue로 이동된 replan (고위험) */
  pendingApprovalPlanId?: string;
}

// ─── Replan History Entry ─────────────────────────────────────────────────

interface ReplanHistoryEntry {
  originalPlanId: string;
  replanId: string;
  reason: string;
  createdAt: string;
}

// ─── Closed-Loop Runner ───────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES = 3;

export class ClosedLoopRunner {
  private replanStrategy: ReplanStrategy;
  private approvalManager: ApprovalManager | null;

  constructor(approvalManager?: ApprovalManager) {
    this.replanStrategy = new ReplanStrategy();
    this.approvalManager = approvalManager ?? null;
  }

  /**
   * plan을 실행하고, 실패 시 replan + 재시도하는 closed-loop 실행.
   *
   * @param plan - 실행할 OperationPlan
   * @param executor - WorkflowExecutor 인스턴스
   * @param maxRetries - 최대 replan 횟수 (기본 3)
   * @returns ClosedLoopResult
   */
  async executeWithRetry(
    plan: OperationPlan,
    executor: WorkflowExecutor,
    maxRetries: number = DEFAULT_MAX_RETRIES
  ): Promise<ClosedLoopResult> {
    log.info(
      `Closed-loop execution started: plan=${plan.id}, maxRetries=${maxRetries}`
    );

    const evidence: AttemptRecord[] = [];
    const replanHistory: ReplanHistoryEntry[] = [];
    const failureSignatures: string[] = [];

    let currentPlan = plan;
    let attemptNumber = 0;
    let replanCount = 0;

    while (attemptNumber <= maxRetries) {
      attemptNumber++;
      const startedAt = nowISO();

      log.info(
        `Attempt ${attemptNumber}/${maxRetries + 1}: executing plan ${currentPlan.id}`
      );

      // plan 실행
      const executionResult = await this.executePlan(currentPlan, executor);

      const completedAt = nowISO();
      const duration =
        new Date(completedAt).getTime() - new Date(startedAt).getTime();

      if (executionResult.success) {
        // 성공
        const record: AttemptRecord = {
          attemptNumber,
          planId: currentPlan.id,
          startedAt,
          completedAt,
          success: true,
          duration,
        };
        evidence.push(record);

        log.info(
          `Plan ${currentPlan.id} executed successfully on attempt ${attemptNumber}`
        );

        return {
          success: true,
          attempts: attemptNumber,
          replans: replanCount,
          finalPlan: currentPlan,
          evidence,
        };
      }

      // 실패 정보 추출
      const failureContext = this.extractFailureContext(
        executionResult,
        currentPlan
      );

      const failureSignature = this.computeFailureSignature(failureContext);
      failureSignatures.push(failureSignature);

      const record: AttemptRecord = {
        attemptNumber,
        planId: currentPlan.id,
        startedAt,
        completedAt,
        success: false,
        failedStepId: failureContext.failedStepId,
        errorMessage: failureContext.errorMessage,
        errorCategory: failureContext.errorCategory,
        duration,
      };
      evidence.push(record);

      log.warn(
        `Plan ${currentPlan.id} failed on attempt ${attemptNumber}: ` +
        `step=${failureContext.failedStepId}, category=${failureContext.errorCategory}`
      );

      // 최대 재시도 횟수 초과 확인
      if (attemptNumber > maxRetries) {
        log.warn(
          `Max retries (${maxRetries}) exceeded for plan ${currentPlan.id}`
        );
        return {
          success: false,
          attempts: attemptNumber,
          replans: replanCount,
          finalPlan: currentPlan,
          evidence,
          abortReason: `최대 재시도 횟수(${maxRetries}) 초과`,
        };
      }

      // 동일 실패 패턴 연속 반복 확인 (직전 3회와 동일하면 중단)
      if (this.isSameFailureRepeating(failureSignatures)) {
        log.warn(
          `동일 실패 패턴이 ${failureSignatures.length}회 연속 반복 — 자동 중단`
        );
        return {
          success: false,
          attempts: attemptNumber,
          replans: replanCount,
          finalPlan: currentPlan,
          evidence,
          abortReason:
            '동일 실패 패턴 반복 — 재시도 무의미하여 자동 중단',
        };
      }

      // Replan 생성
      replanCount++;
      failureContext.retryCount = replanCount;

      const replan = this.replanStrategy.generateReplan(
        currentPlan,
        failureContext
      );

      replanHistory.push({
        originalPlanId: currentPlan.id,
        replanId: replan.id,
        reason: failureContext.errorMessage,
        createdAt: nowISO(),
      });

      log.info(
        `Replan ${replanCount} generated: ${replan.id} (risk: ${replan.risk.level})`
      );

      // 고위험 replan → approval queue로 이동
      if (this.isHighRisk(replan.risk)) {
        log.warn(
          `High-risk replan detected (${replan.risk.level}) — routing to approval queue`
        );

        if (this.approvalManager) {
          this.approvalManager.requestOperationApproval(replan);
          log.info(
            `Replan ${replan.id} submitted to approval queue`
          );
        }

        return {
          success: false,
          attempts: attemptNumber,
          replans: replanCount,
          finalPlan: currentPlan,
          evidence,
          abortReason: `고위험 replan (${replan.risk.level}) — 승인 대기 중`,
          pendingApprovalPlanId: replan.id,
        };
      }

      // 다음 iteration에서 replan 실행
      currentPlan = replan;
    }

    // 이론적으로 도달하지 않아야 하는 지점 (safety net)
    return {
      success: false,
      attempts: attemptNumber,
      replans: replanCount,
      finalPlan: currentPlan,
      evidence,
      abortReason: '예상치 못한 종료',
    };
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  /**
   * OperationPlan을 WorkflowExecutor로 실행.
   *
   * OperationPlan → Workflow 변환 후 WorkflowExecutor.executeWorkflow() 호출.
   */
  private async executePlan(
    plan: OperationPlan,
    executor: WorkflowExecutor
  ): Promise<{ success: boolean; failedStepId?: string; error?: string }> {
    try {
      // postcheck 검증
      if (plan.postchecks.length === 0) {
        log.warn(`Plan ${plan.id} has no postchecks — skipping post-validation`);
      }

      // OperationPlan → Workflow 변환 후 실행
      const workflow = this.convertPlanToWorkflow(plan);
      const result = await executor.executeWorkflow(workflow);

      if (result.status === 'completed') {
        return { success: true };
      }

      // 실패한 step 추출
      const failedEntry = result.errors.length > 0 ? result.errors[0] : null;

      return {
        success: false,
        failedStepId: failedEntry?.stepId,
        error: failedEntry?.error ?? 'Workflow execution failed',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(`Plan execution error: ${errorMessage}`);

      return {
        success: false,
        failedStepId: plan.steps[0]?.id,
        error: errorMessage,
      };
    }
  }

  /**
   * OperationPlan → Workflow 변환 (adapter)
   *
   * WorkflowExecutor.executeWorkflow()에 맞는 Workflow 형태로 변환.
   */
  private convertPlanToWorkflow(plan: OperationPlan): Workflow {
    const now = nowISO();

    return {
      id: plan.id,
      name: `Operation: ${plan.intent.rawText}`,
      description: `Auto-generated workflow from OperationPlan ${plan.id}`,
      customerProfile: {
        customerName: 'closed-loop',
        products: [plan.intent.target] as ProductCode[],
        requirements: [],
        environment: 'production',
        riskLevel: plan.risk.level,
        similarCases: [],
        metadata: {},
      },
      steps: plan.steps.map((step) => ({
        id: step.id,
        name: step.title,
        description: step.capability,
        toolName: step.action,
        toolArgs: step.input as Record<string, string>,
        dependsOn: [] as string[],
        optional: !step.requiresApproval,
        retryPolicy: {
          maxRetries: 1,
          backoff: 'linear' as const,
          retryOn: ['error' as const],
        },
        status: 'pending' as const,
      })),
      reasoning: `Closed-loop execution of plan ${plan.id}`,
      estimatedDuration: 'unknown',
      estimatedCost: 'unknown',
      status: 'running',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * execution result에서 FailureContext 추출
   */
  private extractFailureContext(
    executionResult: { success: boolean; failedStepId?: string; error?: string },
    plan: OperationPlan
  ): FailureContext {
    const errorMessage = executionResult.error ?? 'Unknown error';
    const failedStepId = executionResult.failedStepId ?? plan.steps[0]?.id ?? 'unknown';
    const errorCategory = this.categorizeError(errorMessage);

    // 해당 step의 toolName 정보 추출
    const failedStep = plan.steps.find(
      (s) => s.id === failedStepId || s.action === failedStepId
    );
    const attemptedTools = failedStep
      ? [failedStep.action]
      : [];

    return {
      failedStepId,
      errorMessage,
      errorCategory,
      attemptedTools,
      failedAt: nowISO(),
      retryCount: 0, // caller에서 설정
    };
  }

  /**
   * 에러 메시지를 기반으로 에러 카테고리 분류
   */
  private categorizeError(errorMessage: string): ReplanFailureCategory {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'timeout';
    }
    if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('401')) {
      return 'auth';
    }
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('throttl')) {
      return 'api_limit';
    }
    if (msg.includes('connection') || msg.includes('econnrefused') || msg.includes('network')) {
      return 'connection';
    }
    if (msg.includes('state') || msg.includes('mismatch') || msg.includes('unexpected state')) {
      return 'state_mismatch';
    }
    if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('403')) {
      return 'permission';
    }

    return 'unknown';
  }

  /**
   * 실패 패턴 시그니처 생성 (동일 실패 반복 감지용)
   */
  private computeFailureSignature(context: FailureContext): string {
    return `${context.failedStepId}:${context.errorCategory}`;
  }

  /**
   * 동일 실패 패턴 연속 반복 확인
   * 직전 3개 시그니처가 동일하면 반복으로 판정
   */
  private isSameFailureRepeating(signatures: string[]): boolean {
    if (signatures.length < 3) return false;

    const last = signatures[signatures.length - 1];
    const secondLast = signatures[signatures.length - 2];
    const thirdLast = signatures[signatures.length - 3];

    return last === secondLast && secondLast === thirdLast;
  }

  /**
   * 고위험 replan 판단
   * - risk level이 high 또는 critical
   * - requiresApproval이 true
   */
  private isHighRisk(risk: OperationRisk): boolean {
    return (
      risk.level === 'high' ||
      risk.level === 'critical'
    );
  }
}
