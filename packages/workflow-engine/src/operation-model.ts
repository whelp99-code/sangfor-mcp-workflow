/**
 * Operation Model — 사용자 의도, 실행 계획, 증거 정책 타입
 *
 * 사용자의 자연어/구조화된 의도를 OperationPlan으로 변환하기 위한
 * 중간 표현(MIR) 타입 정의.
 */

// ─── User Intent ──────────────────────────────────────────────────────────

export type IntentAction = 'configure' | 'verify' | 'remediate' | 'discover';

export interface UserIntent {
  action: IntentAction;
  target: string;
  parameters: Record<string, string | number | boolean>;
  rawText: string;
}

// ─── Expected Change ──────────────────────────────────────────────────────

export interface ExpectedChange {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean;
}

// ─── Evidence Policy ───────────────────────────────────────────────────────

export interface EvidencePolicy {
  captureScreenshots: boolean;
  captureDiff: boolean;
  generateMarkdown: boolean;
}

// ─── Dry Run Plan ──────────────────────────────────────────────────────────

export interface DryRunPlan {
  planId: string;
  steps: Array<{
    stepId: string;
    title: string;
    adapter: string;
    action: string;
    estimatedDuration: string;
  }>;
  estimatedDuration: string;
  riskSummary: string;
}
