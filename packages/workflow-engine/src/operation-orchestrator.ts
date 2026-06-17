/**
 * Operation Orchestrator — before → execute → after → verify 원자적 실행 루프
 */

import { createLogger } from '@sangfor/workflow-shared';
import {
  PostVerifier,
  type PostVerifierSnapshot,
  type PostCheckResult,
  type VerificationExpectedChange,
} from './device-verifier.js';

const log = createLogger('operation-orchestrator');

export interface AtomicExecutionRequest {
  executionId: string;
  beforeSnapshot: PostVerifierSnapshot;
  collectAfterSnapshot: () => Promise<PostVerifierSnapshot>;
  execute: () => Promise<{ success: boolean; error?: string }>;
  expectedChanges: VerificationExpectedChange[];
}

export interface AtomicExecutionResult {
  executionId: string;
  executionSuccess: boolean;
  executionError?: string;
  verification: PostCheckResult;
  evidencePath: string;
}

export class OperationOrchestrator {
  private postVerifier: PostVerifier;

  constructor(postVerifier?: PostVerifier) {
    this.postVerifier = postVerifier ?? new PostVerifier();
  }

  /**
   * snapshot 수집(사전) → 실행 → snapshot 재수집(사후) → postcheck 검증
   */
  async executeWithVerification(
    request: AtomicExecutionRequest,
  ): Promise<AtomicExecutionResult> {
    log.info(`Atomic execution start: ${request.executionId}`);

    const execResult = await request.execute();
    const afterSnapshot = await request.collectAfterSnapshot();

    const verification = this.postVerifier.verifyPostExecution(
      request.executionId,
      request.beforeSnapshot,
      afterSnapshot,
      request.expectedChanges,
    );

    log.info(
      `Atomic execution done: ${request.executionId} ` +
      `(exec=${execResult.success}, verify=${verification.passed})`,
    );

    return {
      executionId: request.executionId,
      executionSuccess: execResult.success,
      executionError: execResult.error,
      verification,
      evidencePath: verification.evidencePath,
    };
  }
}

export function toPostVerifierSnapshot(
  snapshot: Record<string, unknown>,
): PostVerifierSnapshot {
  const sections = snapshot.sections as PostVerifierSnapshot['sections'] | undefined;
  return {
    product: String(snapshot.product ?? 'unknown'),
    version: String(snapshot.version ?? 'latest'),
    capturedAt: String(snapshot.capturedAt ?? new Date().toISOString()),
    sections: sections ?? {},
  };
}
