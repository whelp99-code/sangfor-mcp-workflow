/**
 * Monitoring Dashboard — 실시간 워크플로우 상태 모니터링
 */

import { nowISO, createLogger } from '@sangfor/workflow-shared';
import type { Workflow, WorkflowExecutionResult, ExecutionLog } from './types.js';

const log = createLogger('monitoring-dashboard');

// ─── 대시보드 데이터 타입 ────────────────────────────────────────────────────

export interface DashboardStats {
  totalWorkflows: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  pendingApproval: number;
  totalStepsExecuted: number;
  totalStepsSucceeded: number;
  totalStepsFailed: number;
  avgExecutionTime: number;
  uptime: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  status: string;
  progress: number; // 0-100
  currentStep?: string;
  startedAt?: string;
  estimatedCompletion?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpu: number;
  memory: number;
  activeConnections: number;
  queueSize: number;
  lastCheck: string;
}

// ─── 모니터링 대시보드 ──────────────────────────────────────────────────────

export class MonitoringDashboard {
  private workflows: Map<string, Workflow> = new Map();
  private executionResults: Map<string, WorkflowExecutionResult> = new Map();
  private startTime: Date = new Date();

  // 워크플로우 등록
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  // 실행 결과 등록
  registerExecutionResult(result: WorkflowExecutionResult): void {
    this.executionResults.set(result.workflowId, result);
  }

  // 대시보드 통계 조회
  getStats(): DashboardStats {
    const workflows = Array.from(this.workflows.values());
    const results = Array.from(this.executionResults.values());

    const totalStepsExecuted = results.reduce((sum, r) => sum + r.stepsExecuted, 0);
    const totalStepsSucceeded = results.reduce((sum, r) => sum + r.stepsSucceeded, 0);
    const totalStepsFailed = results.reduce((sum, r) => sum + r.stepsFailed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalWorkflows: workflows.length,
      runningWorkflows: workflows.filter((w) => w.status === 'running').length,
      completedWorkflows: workflows.filter((w) => w.status === 'completed').length,
      failedWorkflows: workflows.filter((w) => w.status === 'failed').length,
      pendingApproval: workflows.filter((w) => w.status === 'draft').length,
      totalStepsExecuted,
      totalStepsSucceeded,
      totalStepsFailed,
      avgExecutionTime: results.length > 0 ? totalDuration / results.length : 0,
      uptime: this.formatUptime(),
    };
  }

  // 워크플로우 요약 목록
  getWorkflowSummaries(): WorkflowSummary[] {
    return Array.from(this.workflows.values()).map((w) => {
      const completedSteps = w.steps.filter((s) => s.status === 'completed').length;
      const progress = w.steps.length > 0 ? Math.round((completedSteps / w.steps.length) * 100) : 0;
      const currentStep = w.steps.find((s) => s.status === 'running');

      return {
        id: w.id,
        name: w.name,
        status: w.status,
        progress,
        currentStep: currentStep?.name,
        startedAt: w.createdAt,
        estimatedCompletion: w.estimatedDuration,
      };
    });
  }

  // 실행 이력 조회
  getExecutionHistory(workflowId?: string): ExecutionLog[] {
    if (workflowId) {
      const result = this.executionResults.get(workflowId);
      return result?.executionLogs || [];
    }

    // 전체 이력
    const allLogs: ExecutionLog[] = [];
    for (const result of this.executionResults.values()) {
      allLogs.push(...result.executionLogs);
    }
    return allLogs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  // 시스템 상태 확인
  getSystemHealth(): SystemHealth {
    const runningCount = this.workflows.size;

    return {
      status: runningCount < 10 ? 'healthy' : runningCount < 20 ? 'degraded' : 'unhealthy',
      cpu: Math.random() * 30 + 10, // Mock
      memory: Math.random() * 40 + 30, // Mock
      activeConnections: runningCount,
      queueSize: 0,
      lastCheck: nowISO(),
    };
  }

  // 워크플로우 상세 조회
  getWorkflowDetail(workflowId: string): {
    workflow: Workflow;
    execution?: WorkflowExecutionResult;
    timeline: Array<{ time: string; event: string; details?: string }>;
  } | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const execution = this.executionResults.get(workflowId);

    // 타임라인 생성
    const timeline: Array<{ time: string; event: string; details?: string }> = [];
    timeline.push({ time: workflow.createdAt, event: '워크플로우 생성' });

    if (workflow.approvedAt) {
      timeline.push({ time: workflow.approvedAt, event: '승인됨', details: `승인자: ${workflow.approvedBy}` });
    }

    if (execution) {
      timeline.push({ time: execution.startedAt, event: '실행 시작' });
      for (const log of execution.executionLogs) {
        timeline.push({
          time: log.startedAt,
          event: `${log.toolName} 실행`,
          details: log.error ? `실패: ${log.error}` : `성공 (${log.duration}ms)`,
        });
      }
      timeline.push({ time: execution.completedAt, event: '실행 완료' });
    }

    return { workflow, execution, timeline };
  }

  // 가동 시간 포맷
  private formatUptime(): string {
    const now = new Date();
    const diff = now.getTime() - this.startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}시간 ${minutes}분`;
  }

  // 실시간 이벤트 스트림 (SSE용)
  getEventStream(): Array<{ type: string; data: any; timestamp: string }> {
    // 최근 이벤트 반환
    const events: Array<{ type: string; data: any; timestamp: string }> = [];

    for (const workflow of this.workflows.values()) {
      events.push({
        type: 'workflow_status',
        data: { id: workflow.id, status: workflow.status },
        timestamp: workflow.updatedAt,
      });
    }

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
