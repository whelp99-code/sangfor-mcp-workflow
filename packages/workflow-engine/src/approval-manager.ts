/**
 * Approval Manager — 사용자 승인 관리
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type {
  Workflow,
  ApprovalRequest,
  WorkflowStatus,
  OperationPlan,
  OperationApprovalRequest,
  OperationRisk,
  ApprovalRequirement,
  RiskLevel,
} from './types.js';

const log = createLogger('approval-manager');

export class ApprovalManager {
  private pendingApprovals: Map<string, Workflow> = new Map();
  private operationApprovals: Map<string, OperationApprovalRequest> = new Map();
  private approvalHistory: Array<{
    workflowId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
  }> = [];
  private operationHistory: Array<{
    operationId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
    riskLevel: RiskLevel;
    riskCategories: string[];
  }> = [];

  // 승인 요청
  requestApproval(workflow: Workflow): ApprovalRequest {
    this.pendingApprovals.set(workflow.id, workflow);
    workflow.status = 'draft';
    workflow.updatedAt = nowISO();

    log.info(`Approval requested for workflow: ${workflow.id}`);

    return {
      workflowId: workflow.id,
      workflow,
      requestedAt: nowISO(),
      status: 'pending',
    };
  }

  // 승인 처리
  approve(workflowId: string, approvedBy: string): Workflow {
    const workflow = this.pendingApprovals.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = 'approved';
    workflow.approvedAt = nowISO();
    workflow.approvedBy = approvedBy;
    workflow.updatedAt = nowISO();

    this.pendingApprovals.delete(workflowId);
    this.approvalHistory.push({
      workflowId,
      action: 'approved',
      by: approvedBy,
      at: nowISO(),
    });

    log.info(`Workflow approved: ${workflowId} by ${approvedBy}`);
    return workflow;
  }

  // 거절 처리
  reject(workflowId: string, reason: string, rejectedBy?: string): Workflow {
    const workflow = this.pendingApprovals.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = 'rejected';
    workflow.updatedAt = nowISO();
    workflow.metadata = { ...workflow.metadata, rejectionReason: reason };

    this.pendingApprovals.delete(workflowId);
    this.approvalHistory.push({
      workflowId,
      action: 'rejected',
      by: rejectedBy || 'system',
      at: nowISO(),
      reason,
    });

    log.info(`Workflow rejected: ${workflowId} - ${reason}`);
    return workflow;
  }

  // 수정 요청 (다시 draft로)
  requestModification(workflowId: string, feedback: string): Workflow {
    const workflow = this.pendingApprovals.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = 'draft';
    workflow.updatedAt = nowISO();
    workflow.metadata = { ...workflow.metadata, modificationFeedback: feedback };

    log.info(`Modification requested for workflow: ${workflowId}`);
    return workflow;
  }

  // 승인 대기 목록
  listPendingApprovals(): Workflow[] {
    return Array.from(this.pendingApprovals.values());
  }

  // 승인 대기 확인
  isPending(workflowId: string): boolean {
    return this.pendingApprovals.has(workflowId);
  }

  // 승인 이력 조회
  getApprovalHistory(): Array<{
    workflowId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
  }> {
    return [...this.approvalHistory];
  }

  // 워크플로우 ID로 승인 이력 조회
  getApprovalHistoryByWorkflow(workflowId: string): Array<{
    workflowId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
  }> {
    return this.approvalHistory.filter((h) => h.workflowId === workflowId);
  }

  // 승인 통계
  getStats(): {
    pending: number;
    totalApproved: number;
    totalRejected: number;
  } {
    return {
      pending: this.pendingApprovals.size,
      totalApproved: this.approvalHistory.filter((h) => h.action === 'approved').length,
      totalRejected: this.approvalHistory.filter((h) => h.action === 'rejected').length,
    };
  }

  // ─── PR-24: Operation Approval 메서드 ─────────────────────────────────────

  /**
   * OperationPlan 승인 요청
   */
  requestOperationApproval(plan: OperationPlan): OperationApprovalRequest {
    // config_change, service_impact가 승인 없이 실행되지 않도록 검증
    this.validateApprovalRequired(plan);

    const request: OperationApprovalRequest = {
      operationId: plan.id,
      plan,
      requestedAt: nowISO(),
      status: 'pending',
    };

    this.operationApprovals.set(plan.id, request);
    log.info(`Operation approval requested: ${plan.id} (risk: ${plan.risk.level})`);

    return request;
  }

  /**
   * Operation 승인 처리
   */
  approveOperation(operationId: string, approvedBy: string): void {
    const request = this.operationApprovals.get(operationId);
    if (!request) {
      throw new Error(`Operation approval request not found: ${operationId}`);
    }

    request.status = 'approved';
    request.approvedBy = approvedBy;

    // history 기록 (risk 정보 포함)
    this.operationHistory.push({
      operationId,
      action: 'approved',
      by: approvedBy,
      at: nowISO(),
      riskLevel: request.plan.risk.level,
      riskCategories: request.plan.risk.categories,
    });

    log.info(`Operation approved: ${operationId} by ${approvedBy}`);
  }

  /**
   * Operation 거절 처리 — 반려된 plan이 실행 큐에 남지 않도록 cleanup
   */
  rejectOperation(operationId: string, reason: string, rejectedBy: string): void {
    const request = this.operationApprovals.get(operationId);
    if (!request) {
      throw new Error(`Operation approval request not found: ${operationId}`);
    }

    request.status = 'rejected';
    request.rejectedBy = rejectedBy;
    request.reason = reason;

    // history 기록 (risk 정보 포함)
    this.operationHistory.push({
      operationId,
      action: 'rejected',
      by: rejectedBy,
      at: nowISO(),
      reason,
      riskLevel: request.plan.risk.level,
      riskCategories: request.plan.risk.categories,
    });

    // 반려된 plan은 pending 큐에서 제거 (cleanup)
    this.operationApprovals.delete(operationId);

    log.info(`Operation rejected: ${operationId} by ${rejectedBy} — ${reason}`);
  }

  /**
   * 승인 대기 중인 Operation 목록
   */
  getOperationApprovalQueue(): OperationPlan[] {
    return Array.from(this.operationApprovals.values())
      .filter(r => r.status === 'pending')
      .map(r => r.plan);
  }

  /**
   * 위험도 기반 승인 필요 여부 판단
   */
  riskBasedApprovalRequirement(risk: OperationRisk): ApprovalRequirement {
    const requiresApproval = risk.level === 'high'
      || risk.level === 'critical'
      || risk.categories.includes('config_change')
      || risk.categories.includes('service_impact');

    let approverRole: string = 'admin';
    if (risk.level === 'critical') {
      approverRole = 'security_officer';
    } else if (risk.level === 'high') {
      approverRole = 'admin';
    } else if (requiresApproval) {
      approverRole = 'team_lead';
    }

    return {
      required: requiresApproval,
      reason: requiresApproval
        ? `위험 수준 ${risk.level}, 카테고리: ${risk.categories.join(', ')} — 승인 필요`
        : '저위험 작업 — 승인 불필요',
      approverRole,
    };
  }

  /**
   * config_change, service_impact가 승인 없이 실행되지 않도록 검증
   */
  validateApprovalRequired(plan: OperationPlan): void {
    const needsApproval = plan.risk.level === 'high'
      || plan.risk.level === 'critical'
      || plan.risk.categories.includes('config_change')
      || plan.risk.categories.includes('service_impact');
    if (!needsApproval) {
      return; // 승인 불필요 작업
    }

    // 승인이 필요한데 아직 승인되지 않은 경우
    const existingRequest = this.operationApprovals.get(plan.id);
    if (existingRequest && existingRequest.status === 'approved') {
      return; // 이미 승인됨
    }

    log.info(`승인 필요 작업 감지: ${plan.id} — risk: ${plan.risk.level}, categories: ${plan.risk.categories.join(', ')}`);
  }

  /**
   * Operation 승인 이력 조회 (risk 정보 포함)
   */
  getOperationApprovalHistory(): Array<{
    operationId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
    riskLevel: RiskLevel;
    riskCategories: string[];
  }> {
    return [...this.operationHistory];
  }

  /**
   * OperationId로 승인 이력 조회
   */
  getOperationApprovalHistoryById(operationId: string): Array<{
    operationId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
    riskLevel: RiskLevel;
    riskCategories: string[];
  }> {
    return this.operationHistory.filter(h => h.operationId === operationId);
  }

  /**
   * 반려된 operation cleanup (실행 큐에서 제거)
   */
  cleanupRejectedOperations(): number {
    let cleaned = 0;
    for (const [id, request] of this.operationApprovals) {
      if (request.status === 'rejected') {
        this.operationApprovals.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log.info(`반려된 operation ${cleaned}개 정리 완료`);
    }
    return cleaned;
  }
}
