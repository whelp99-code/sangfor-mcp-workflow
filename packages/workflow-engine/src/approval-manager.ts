/**
 * Approval Manager — 사용자 승인 관리
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { Workflow, ApprovalRequest, WorkflowStatus } from './types.js';

const log = createLogger('approval-manager');

export class ApprovalManager {
  private pendingApprovals: Map<string, Workflow> = new Map();
  private approvalHistory: Array<{
    workflowId: string;
    action: 'approved' | 'rejected';
    by: string;
    at: string;
    reason?: string;
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
}
