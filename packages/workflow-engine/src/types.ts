/**
 * 워크플로우 엔진 타입 정의
 */

import { type ProductCode, type RiskLevel } from '@sangfor/workflow-shared';

// ─── 고객 프로필 ────────────────────────────────────────────────────────────

export interface CustomerProfile {
  customerName: string;
  products: ProductCode[];
  requirements: Requirement[];
  environment: 'lab' | 'poc' | 'customer' | 'production';
  riskLevel: RiskLevel;
  similarCases: SimilarCase[];
  metadata: Record<string, any>;
}

export interface Requirement {
  id: string;
  text: string;
  product: ProductCode;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SimilarCase {
  id: string;
  customerName: string;
  products: ProductCode[];
  requirements: string[];
  outcome: string;
  relevance: number; // 0-1
}

// ─── 워크플로우 정의 ────────────────────────────────────────────────────────

export type WorkflowStatus =
  | 'draft'       // 생성됨 (승인 대기)
  | 'approved'    // 승인됨
  | 'rejected'    // 거절됨
  | 'running'     // 실행 중
  | 'completed'   // 완료
  | 'failed'      // 실패
  | 'cancelled'   // 취소됨
  | 'paused';     // 일시정지

export type StepStatus =
  | 'pending'
  | 'waiting'     // 의존성 대기
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface RetryPolicy {
  maxRetries: number;
  backoff: 'none' | 'linear' | 'exponential';
  retryOn: ('timeout' | 'error' | 'rate_limit')[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  toolName: string;
  toolArgs: Record<string, any>;
  dependsOn: string[];     // 이전 step IDs
  optional: boolean;       // 실패 시 스킵 가능 여부
  retryPolicy: RetryPolicy;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: string;
  duration?: number;       // 실행 시간 (ms)
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  customerProfile: CustomerProfile;
  steps: WorkflowStep[];
  reasoning: string;         // AI가 왜 이 워크플로우를 선택했는지
  estimatedDuration: string;
  estimatedCost: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

// ─── 실행 이력 ──────────────────────────────────────────────────────────────

export interface ExecutionLog {
  id: string;
  workflowId: string;
  stepId: string;
  toolName: string;
  toolArgs: Record<string, any>;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  result?: any;
  error?: string;
  retryCount: number;
  metadata: Record<string, any>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: WorkflowStatus;
  startedAt: string;
  completedAt: string;
  duration: number;
  stepsExecuted: number;
  stepsSucceeded: number;
  stepsFailed: number;
  stepsSkipped: number;
  outputs: Record<string, any>;
  errors: Array<{ stepId: string; error: string }>;
  executionLogs: ExecutionLog[];
}

// ─── tool 정의 ──────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  category: string;
  tags: string[];
  estimatedDuration: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  handler: (args: any) => Promise<any>;
}

export interface ToolDependency {
  sourceTool: string;    // 이 tool의 결과를 사용하는 tool
  targetTool: string;    // 이 tool이 필요로 하는 tool
  required: boolean;     // 필수 의존성 여부
  fieldMapping: Record<string, string>;
}

// ─── 승인 관리 ──────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  workflowId: string;
  workflow: Workflow;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ─── 에러 처리 ──────────────────────────────────────────────────────────────

export type ErrorAction = 'retry' | 'skip' | 'abort' | 'fallback';

export interface ErrorDecision {
  action: ErrorAction;
  reason: string;
  retryDelay?: number;
  fallbackTool?: string;
}

// ─── 입력/출력 ──────────────────────────────────────────────────────────────

export interface ProjectInput {
  customerName: string;
  excelFilePath: string;
  requirements?: string[];
  environment?: 'lab' | 'poc' | 'customer' | 'production';
  products?: ProductCode[];
  outputDir?: string;
  dryRun?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  products: ProductCode[];
  steps: Array<{
    toolName: string;
    args?: Record<string, any>;
    optional?: boolean;
  }>;
  tags: string[];
}
