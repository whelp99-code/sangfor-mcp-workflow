/**
 * Parallel Executor — 병렬 실행 가능한 step 동시 실행
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type {
  Workflow,
  WorkflowStep,
  WorkflowExecutionResult,
  ExecutionLog,
} from './types.js';
import { ToolRegistry } from './tool-registry.js';
import { ExecutionLogger } from './execution-logger.js';
import { ErrorHandler } from './error-handler.js';

const log = createLogger('parallel-executor');

// ─── 병렬 실행 설정 ────────────────────────────────────────────────────────

export interface ParallelConfig {
  maxConcurrency: number;      // 최대 동시 실행 수
  timeoutMs: number;           // 단계 타임아웃 (ms)
  enableCaching: boolean;      // 결과 캐싱 활성화
  cacheTtlMs: number;          // 캐시 유효 시간 (ms)
}

const DEFAULT_CONFIG: ParallelConfig = {
  maxConcurrency: 3,
  timeoutMs: 300000, // 5분
  enableCaching: true,
  cacheTtlMs: 3600000, // 1시간
};

// ─── 실행 결과 캐시 ─────────────────────────────────────────────────────────

interface CacheEntry {
  result: any;
  timestamp: number;
  hits: number;
}

export class ResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 3600000) {
    this.ttlMs = ttlMs;
  }

  // 캐시 조회
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL 확인
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.result;
  }

  // 캐시 저장
  set(key: string, result: any): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  // 캐시 키 생성
  static generateKey(toolName: string, args: Record<string, any>): string {
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    return `${toolName}:${argsStr}`;
  }

  // 캐시 통계
  getStats(): { size: number; hits: number; misses: number } {
    let hits = 0;
    for (const entry of this.cache.values()) {
      hits += entry.hits;
    }
    return {
      size: this.cache.size,
      hits,
      misses: 0, // TODO: 추적
    };
  }

  // 캐시 초기화
  clear(): void {
    this.cache.clear();
  }
}

// ─── 병렬 실행기 ────────────────────────────────────────────────────────────

export class ParallelExecutor {
  private toolRegistry: ToolRegistry;
  private executionLogger: ExecutionLogger;
  private errorHandler: ErrorHandler;
  private config: ParallelConfig;
  private cache: ResultCache;

  constructor(
    toolRegistry: ToolRegistry,
    executionLogger: ExecutionLogger,
    errorHandler: ErrorHandler,
    config?: Partial<ParallelConfig>
  ) {
    this.toolRegistry = toolRegistry;
    this.executionLogger = executionLogger;
    this.errorHandler = errorHandler;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new ResultCache(this.config.cacheTtlMs);
  }

  // 의존성 없는 step들을 병렬 실행
  async executeWorkflow(workflow: Workflow): Promise<WorkflowExecutionResult> {
    const startedAt = nowISO();
    workflow.status = 'running';
    workflow.updatedAt = nowISO();

    log.info(`Executing workflow with parallel support: ${workflow.id}`);

    const results: Map<string, any> = new Map();
    const executionLogs: ExecutionLog[] = [];
    const errors: Array<{ stepId: string; error: string }> = [];

    let stepsExecuted = 0;
    let stepsSucceeded = 0;
    let stepsFailed = 0;
    let stepsSkipped = 0;

    // 의존성 그래프 구축
    const dependencyGraph = this.buildDependencyGraph(workflow.steps);
    const completed = new Set<string>();
    const running = new Set<string>();

    // 실행 가능한 step 찾기
    const getRunnableSteps = (): WorkflowStep[] => {
      return workflow.steps.filter((step) => {
        // 이미 완료되거나 실행 중이면 스킵
        if (completed.has(step.toolName) || running.has(step.toolName)) {
          return false;
        }

        // 의존성 확인
        const deps = dependencyGraph.get(step.toolName) || new Set();
        for (const dep of deps) {
          if (!completed.has(dep)) {
            return false;
          }
        }

        return true;
      });
    };

    // 단일 step 실행
    const executeStep = async (step: WorkflowStep): Promise<void> => {
      running.add(step.toolName);
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
        // 캐시 확인
        if (this.config.enableCaching) {
          const cacheKey = ResultCache.generateKey(step.toolName, step.toolArgs);
          const cachedResult = this.cache.get(cacheKey);

          if (cachedResult) {
            log.info(`Cache hit for step: ${step.toolName}`);
            step.status = 'completed';
            step.completedAt = nowISO();
            step.result = cachedResult;
            step.duration = 0;
            results.set(step.toolName, cachedResult);
            completed.add(step.toolName);
            stepsSucceeded++;
            running.delete(step.toolName);
            return;
          }
        }

        // 이전 단계 결과 주입
        const injectedArgs = this.injectPreviousResults(step, results);

        // tool 실행 (타임아웃 적용)
        const tool = this.toolRegistry.getTool(step.toolName);
        if (!tool) throw new Error(`Tool not found: ${step.toolName}`);

        const result = await this.executeWithTimeout(
          tool.handler(injectedArgs),
          this.config.timeoutMs
        );

        // 성공
        step.status = 'completed';
        step.completedAt = nowISO();
        step.result = result;
        step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
        results.set(step.toolName, result);
        completed.add(step.toolName);
        stepsSucceeded++;

        // 캐시 저장
        if (this.config.enableCaching) {
          const cacheKey = ResultCache.generateKey(step.toolName, step.toolArgs);
          this.cache.set(cacheKey, result);
        }

        logEntry.completedAt = step.completedAt;
        logEntry.duration = step.duration;
        logEntry.result = result;

        log.info(`Step completed: ${step.toolName} (${step.duration}ms)`);
      } catch (error) {
        // 에러 처리
        const errorDecision = await this.errorHandler.handleError(step, error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorDecision.action === 'retry' && step.retryPolicy.maxRetries > logEntry.retryCount) {
          logEntry.retryCount++;
          step.status = 'pending';
          stepsExecuted--;
          running.delete(step.toolName);
          // 재시도를 위해 다시 큐에 추가
          return;
        } else if (errorDecision.action === 'skip' && step.optional) {
          step.status = 'skipped';
          stepsSkipped++;
          completed.add(step.toolName);
        } else {
          step.status = 'failed';
          step.error = errorMessage;
          stepsFailed++;
          errors.push({ stepId: step.id, error: errorMessage });
          logEntry.error = errorMessage;
        }
      }

      running.delete(step.toolName);
      executionLogs.push(logEntry);
      this.executionLogger.log(logEntry);
    };

    // 병렬 실행 루프
    while (completed.size < workflow.steps.length) {
      const runnableSteps = getRunnableSteps();

      if (runnableSteps.length === 0 && running.size === 0) {
        // 실행 가능한 step이 없고, 실행 중인 step도 없으면 중단
        log.warn('No runnable steps and no running steps — deadlock detected');
        break;
      }

      if (runnableSteps.length > 0) {
        // 동시 실행 수 제한
        const stepsToExecute = runnableSteps.slice(0, this.config.maxConcurrency - running.size);

        // 병렬 실행
        await Promise.all(stepsToExecute.map(executeStep));
      } else {
        // 실행 중인 step이 완료될 때까지 대기
        await this.delay(100);
      }
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

  // 의존성 그래프 구축
  private buildDependencyGraph(steps: WorkflowStep[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const step of steps) {
      graph.set(step.toolName, new Set(step.dependsOn));
    }

    return graph;
  }

  // 이전 단계 결과 주입
  private injectPreviousResults(step: WorkflowStep, results: Map<string, any>): Record<string, any> {
    const args = { ...step.toolArgs };

    for (const depId of step.dependsOn) {
      const depResult = results.get(depId);
      if (depResult) {
        args[depId] = depResult;
      }
    }

    return args;
  }

  // 타임아웃 적용 실행
  private executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  // 지연 함수
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 캐시 통계 조회
  getCacheStats(): { size: number; hits: number; misses: number } {
    return this.cache.getStats();
  }

  // 캐시 초기화
  clearCache(): void {
    this.cache.clear();
  }

  // 설정 조회
  getConfig(): ParallelConfig {
    return { ...this.config };
  }

  // 설정 업데이트
  updateConfig(config: Partial<ParallelConfig>): void {
    this.config = { ...this.config, ...config };
    log.info(`Updated parallel config: ${JSON.stringify(this.config)}`);
  }
}
