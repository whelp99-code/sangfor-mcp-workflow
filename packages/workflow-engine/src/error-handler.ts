/**
 * Error Handler — 에러 처리/복구
 */

import { createLogger } from '@sangfor/workflow-shared';
import type { WorkflowStep, ErrorDecision, ErrorAction } from './types.js';

const log = createLogger('error-handler');

export class ErrorHandler {
  // 에러 처리 결정
  async handleError(step: WorkflowStep, error: unknown): Promise<ErrorDecision> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = this.classifyError(error);

    log.warn(`Error in step ${step.toolName}: ${errorMessage} (type: ${errorType})`);

    // 에러 타입별 처리
    switch (errorType) {
      case 'timeout':
        return this.handleTimeout(step);

      case 'rate_limit':
        return this.handleRateLimit(step);

      case 'network':
        return this.handleNetworkError(step);

      case 'auth':
        return this.handleAuthError(step);

      case 'validation':
        return this.handleValidationError(step);

      case 'not_found':
        return this.handleNotFoundError(step);

      default:
        return this.handleUnknownError(step, errorMessage);
    }
  }

  // 에러 타입 분류
  private classifyError(error: unknown): string {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    if (message.includes('network') || message.includes('econnrefused') || message.includes('econnreset')) {
      return 'network';
    }
    if (message.includes('auth') || message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
      return 'auth';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('400')) {
      return 'validation';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'not_found';
    }

    return 'unknown';
  }

  // 타임아웃 처리
  private handleTimeout(step: WorkflowStep): ErrorDecision {
    if (step.retryPolicy.retryOn.includes('timeout') && step.retryPolicy.maxRetries > 0) {
      return {
        action: 'retry',
        reason: 'Timeout detected, retrying with backoff',
        retryDelay: this.calculateBackoffDelay(step),
      };
    }

    if (step.optional) {
      return {
        action: 'skip',
        reason: 'Timeout on optional step, skipping',
      };
    }

    return {
      action: 'abort',
      reason: 'Timeout on required step',
    };
  }

  // Rate limit 처리
  private handleRateLimit(step: WorkflowStep): ErrorDecision {
    return {
      action: 'retry',
      reason: 'Rate limited, waiting before retry',
      retryDelay: 60000, // 1분 대기
    };
  }

  // 네트워크 에러 처리
  private handleNetworkError(step: WorkflowStep): ErrorDecision {
    if (step.retryPolicy.retryOn.includes('error') && step.retryPolicy.maxRetries > 0) {
      return {
        action: 'retry',
        reason: 'Network error, retrying',
        retryDelay: this.calculateBackoffDelay(step),
      };
    }

    if (step.optional) {
      return {
        action: 'skip',
        reason: 'Network error on optional step, skipping',
      };
    }

    return {
      action: 'abort',
      reason: 'Network error on required step',
    };
  }

  // 인증 에러 처리
  private handleAuthError(step: WorkflowStep): ErrorDecision {
    // 인증 에러는 재시도해도 소용없음
    return {
      action: 'abort',
      reason: 'Authentication error, manual intervention required',
    };
  }

  // 검증 에러 처리
  private handleValidationError(step: WorkflowStep): ErrorDecision {
    if (step.optional) {
      return {
        action: 'skip',
        reason: 'Validation error on optional step, skipping',
      };
    }

    return {
      action: 'abort',
      reason: 'Validation error on required step',
    };
  }

  // Not found 에러 처리
  private handleNotFoundError(step: WorkflowStep): ErrorDecision {
    if (step.optional) {
      return {
        action: 'skip',
        reason: 'Resource not found on optional step, skipping',
      };
    }

    return {
      action: 'abort',
      reason: 'Resource not found on required step',
    };
  }

  // 알 수 없는 에러 처리
  private handleUnknownError(step: WorkflowStep, message: string): ErrorDecision {
    if (step.retryPolicy.retryOn.includes('error') && step.retryPolicy.maxRetries > 0) {
      return {
        action: 'retry',
        reason: `Unknown error: ${message}, retrying`,
        retryDelay: this.calculateBackoffDelay(step),
      };
    }

    if (step.optional) {
      return {
        action: 'skip',
        reason: `Unknown error on optional step: ${message}`,
      };
    }

    return {
      action: 'abort',
      reason: `Unknown error on required step: ${message}`,
    };
  }

  // 백오프 지연 시간 계산
  private calculateBackoffDelay(step: WorkflowStep): number {
    const baseDelay = 1000; // 1초

    switch (step.retryPolicy.backoff) {
      case 'none':
        return 0;

      case 'linear':
        return baseDelay * (step.retryPolicy.maxRetries + 1);

      case 'exponential':
        return baseDelay * Math.pow(2, step.retryPolicy.maxRetries);

      default:
        return baseDelay;
    }
  }

  // 에러 복구 가능 여부 확인
  isRecoverable(step: WorkflowStep, error: unknown): boolean {
    const errorType = this.classifyError(error);

    // 인증 에러는 복구 불가
    if (errorType === 'auth') return false;

    // 재시도 정책이 있으면 복구 가능
    if (step.retryPolicy.maxRetries > 0) return true;

    // 선택적 단계는 스킵 가능
    if (step.optional) return true;

    return false;
  }

  // 에러 통계
  getErrorStats(errors: Array<{ stepId: string; error: string }>): {
    total: number;
    byType: Record<string, number>;
    recoverable: number;
  } {
    const byType: Record<string, number> = {};

    for (const err of errors) {
      const type = this.classifyError(err.error);
      byType[type] = (byType[type] || 0) + 1;
    }

    return {
      total: errors.length,
      byType,
      recoverable: 0, // TODO: 실제 계산
    };
  }
}
