/**
 * Workflow Executor — 워크플로우 실행기
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type {
  Workflow,
  WorkflowStep,
  WorkflowExecutionResult,
  ExecutionLog,
  RiskLevel,
} from './types.js';
import { ToolRegistry } from './tool-registry.js';
import { ExecutionLogger } from './execution-logger.js';
import { ErrorHandler } from './error-handler.js';
import { ApprovalManager } from './approval-manager.js';
import { BreakGlassPolicy } from './breakglass-policy.js';

const log = createLogger('workflow-executor');

export class WorkflowExecutor {
  private toolRegistry: ToolRegistry;
  private executionLogger: ExecutionLogger;
  private errorHandler: ErrorHandler;
  private approvalManager: ApprovalManager | null = null;
  private breakGlassPolicy: BreakGlassPolicy | null = null;

  constructor(
    toolRegistry: ToolRegistry,
    executionLogger: ExecutionLogger,
    errorHandler: ErrorHandler
  ) {
    this.toolRegistry = toolRegistry;
    this.executionLogger = executionLogger;
    this.errorHandler = errorHandler;
  }

  setApprovalManager(approvalManager: ApprovalManager): void {
    this.approvalManager = approvalManager;
  }

  setBreakGlassPolicy(policy: BreakGlassPolicy): void {
    this.breakGlassPolicy = policy;
  }

  // 워크플로우 실행
  async executeWorkflow(workflow: Workflow): Promise<WorkflowExecutionResult> {
    const startedAt = nowISO();
    workflow.status = 'running';
    workflow.updatedAt = nowISO();

    log.info(`Executing workflow: ${workflow.id} (${workflow.name})`);

    const results: Map<string, any> = new Map();
    const executionLogs: ExecutionLog[] = [];
    const errors: Array<{ stepId: string; error: string }> = [];
    const retryCounts = new Map<string, number>();

    let stepsExecuted = 0;
    let stepsSucceeded = 0;
    let stepsFailed = 0;
    let stepsSkipped = 0;

    // 실행 순서 결정 (의존성 기반)
    const executionOrder = this.determineExecutionOrder(workflow.steps);

    // 순차 실행
    for (const step of executionOrder) {
      // 의존성 확인
      const dependenciesMet = this.checkDependencies(step, workflow.steps, results);

      if (!dependenciesMet) {
        step.status = 'skipped';
        stepsSkipped++;
        log.info(`Skipping step ${step.toolName}: dependencies not met`);
        continue;
      }

      // tool 실행
      step.status = 'running';
      step.startedAt = nowISO();
      stepsExecuted++;

      const logEntry: ExecutionLog = {
        id: nowId('log'),
        workflowId: workflow.id,
        stepId: step.id,
        toolName: step.toolName,
        toolArgs: step.toolArgs,
        startedAt: step.startedAt,
        retryCount: 0,
        metadata: {},
      };

      try {
        // 이전 단계 결과를 현재 단계 args에 주입
        const injectedArgs = this.injectPreviousResults(step, results);

        // tool 실행
        const tool = this.toolRegistry.getTool(step.toolName);
        if (!tool) {
          throw new Error(`Tool not found: ${step.toolName}`);
        }

        this.assertExecutionAllowed(workflow, step, tool.riskLevel, tool.requiresApproval);

        log.info(`Executing step: ${step.toolName}`);
        const result = await tool.handler(injectedArgs);

        // 성공
        step.status = 'completed';
        step.completedAt = nowISO();
        step.result = result;
        step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
        results.set(step.toolName, result);
        stepsSucceeded++;

        logEntry.completedAt = step.completedAt;
        logEntry.duration = step.duration;
        logEntry.result = result;

        log.info(`Step completed: ${step.toolName} (${step.duration}ms)`);
      } catch (error) {
        // 에러 처리
        const errorDecision = await this.errorHandler.handleError(step, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const retryCount = retryCounts.get(step.id) ?? 0;

        log.warn(`Step failed: ${step.toolName} - ${errorDecision.action}: ${errorDecision.reason}`);

        if (errorDecision.action === 'retry' && retryCount < step.retryPolicy.maxRetries) {
          // 재시도
          const nextRetryCount = retryCount + 1;
          retryCounts.set(step.id, nextRetryCount);
          logEntry.retryCount = nextRetryCount;
          step.status = 'pending';
          stepsExecuted--; // 다시 시도할 것이므로 카운트 감소

          // 재시도 지연
          if (errorDecision.retryDelay) {
            await this.delay(errorDecision.retryDelay);
          }

          // 재시도를 위해 executionOrder에 다시 추가
          executionOrder.push(step);
          continue;
        } else if (errorDecision.action === 'skip' && step.optional) {
          // 스킵
          step.status = 'skipped';
          stepsSkipped++;
          log.info(`Skipped step: ${step.toolName}`);
        } else {
          // 실패
          step.status = 'failed';
          step.error = errorMessage;
          stepsFailed++;
          errors.push({ stepId: step.id, error: errorMessage });

          logEntry.error = errorMessage;

          log.error(`Step failed: ${step.toolName} - ${errorMessage}`);
        }
      }

      executionLogs.push(logEntry);
      this.executionLogger.log(logEntry);
    }

    // 최종 상태 결정
    workflow.status = stepsFailed > 0 ? 'failed' : 'completed';
    workflow.completedAt = nowISO();
    workflow.updatedAt = workflow.completedAt;

    const completedAt = nowISO();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    log.info(
      `Workflow ${workflow.status}: ${stepsSucceeded}/${stepsExecuted} succeeded, ${stepsFailed} failed, ${stepsSkipped} skipped`
    );

    return {
      workflowId: workflow.id,
      status: workflow.status,
      startedAt,
      completedAt,
      duration,
      stepsExecuted,
      stepsSucceeded,
      stepsFailed,
      stepsSkipped,
      outputs: Object.fromEntries(results),
      errors,
      executionLogs,
    };
  }

  // 실행 순서 결정 (의존성 기반)
  private determineExecutionOrder(steps: WorkflowStep[]): WorkflowStep[] {
    // 이미 topological sort가 되어 있으므로 그대로 사용
    // 단, 의존성 재검증
    const ordered: WorkflowStep[] = [];
    const visited = new Set<string>();
    const stepMap = new Map<string, WorkflowStep>();

    for (const step of steps) {
      stepMap.set(step.toolName, step);
    }

    const visit = (step: WorkflowStep) => {
      if (visited.has(step.toolName)) return;
      visited.add(step.toolName);

      // 의존성 먼저 방문
      for (const depId of step.dependsOn) {
        const depStep = stepMap.get(depId);
        if (depStep) {
          visit(depStep);
        }
      }

      ordered.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return ordered;
  }

  // 의존성 확인
  private checkDependencies(
    step: WorkflowStep,
    allSteps: WorkflowStep[],
    results: Map<string, any>
  ): boolean {
    if (step.dependsOn.length === 0) return true;

    return step.dependsOn.every((depId) => {
      const depStep = allSteps.find((s) => s.toolName === depId);
      return depStep && depStep.status === 'completed' && results.has(depId);
    });
  }

  // 이전 단계 결과를 현재 단계 args에 주입
  private injectPreviousResults(step: WorkflowStep, results: Map<string, any>): Record<string, any> {
    const args = { ...step.toolArgs };

    for (const depId of step.dependsOn) {
      const depResult = results.get(depId);
      if (depResult) {
        // 의존성 매핑에 따라 결과 주입
        args[depId] = depResult;
      }
    }

    return args;
  }

  // 지연 함수
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private assertExecutionAllowed(
    workflow: Workflow,
    step: WorkflowStep,
    riskLevel: RiskLevel,
    requiresApproval: boolean,
  ): void {
    const explicitMutationStep = /apply|create|update|delete|remove|restart|reboot|write|configure/i.test(
      step.toolName,
    );
    const highRisk = riskLevel === 'high' || riskLevel === 'critical';
    const needsApproval = requiresApproval || highRisk || explicitMutationStep;

    if (!needsApproval) {
      return;
    }

    if (workflow.status === 'approved') {
      return;
    }

    const breakGlassRequestId = workflow.metadata?.['breakGlassRequestId'];
    if (typeof breakGlassRequestId === 'string' && this.breakGlassPolicy?.isRequestActive(breakGlassRequestId)) {
      return;
    }

    if (this.breakGlassPolicy?.isBreakGlassActive()) {
      return;
    }

    if (this.approvalManager?.isPending(workflow.id)) {
      throw new Error(`Approval required before executing sensitive step: ${step.toolName}`);
    }

    throw new Error(
      `Execution blocked: workflow ${workflow.id} is not approved for sensitive step ${step.toolName}`,
    );
  }

  // 워크플로우 일시정지
  pauseWorkflow(workflow: Workflow): void {
    workflow.status = 'paused';
    workflow.updatedAt = nowISO();
    log.info(`Workflow paused: ${workflow.id}`);
  }

  // 워크플로우 재개
  resumeWorkflow(workflow: Workflow): void {
    workflow.status = 'running';
    workflow.updatedAt = nowISO();
    log.info(`Workflow resumed: ${workflow.id}`);
  }

  // 워크플로우 취소
  cancelWorkflow(workflow: Workflow): void {
    workflow.status = 'cancelled';
    workflow.updatedAt = nowISO();

    // 실행 중인 단계 취소
    for (const step of workflow.steps) {
      if (step.status === 'running' || step.status === 'pending') {
        step.status = 'cancelled';
      }
    }

    log.info(`Workflow cancelled: ${workflow.id}`);
  }
}
