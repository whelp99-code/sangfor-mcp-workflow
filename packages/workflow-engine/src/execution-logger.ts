/**
 * Execution Logger — 실행 이력 관리
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { ExecutionLog } from './types.js';

const log = createLogger('execution-logger');

export class ExecutionLogger {
  private logs: Map<string, ExecutionLog[]> = new Map();

  // 로그 기록
  log(entry: Omit<ExecutionLog, 'id'>): ExecutionLog {
    const fullEntry: ExecutionLog = {
      id: nowId('log'),
      ...entry,
    };

    const workflowLogs = this.logs.get(entry.workflowId) || [];
    workflowLogs.push(fullEntry);
    this.logs.set(entry.workflowId, workflowLogs);

    log.debug(
      `[${entry.workflowId}] ${entry.toolName} - ${entry.error ? 'FAILED' : 'OK'} (${entry.duration ?? 0}ms)`
    );

    return fullEntry;
  }

  // 워크플로우별 로그 조회
  getLogs(workflowId: string): ExecutionLog[] {
    return this.logs.get(workflowId) || [];
  }

  // 전체 로그 조회
  getAllLogs(): ExecutionLog[] {
    const allLogs: ExecutionLog[] = [];
    for (const logs of this.logs.values()) {
      allLogs.push(...logs);
    }
    return allLogs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  // tool별 로그 조회
  getLogsByTool(toolName: string): ExecutionLog[] {
    return this.getAllLogs().filter((l) => l.toolName === toolName);
  }

  // 에러 로그만 조회
  getErrorLogs(workflowId?: string): ExecutionLog[] {
    const logs = workflowId ? this.getLogs(workflowId) : this.getAllLogs();
    return logs.filter((l) => l.error);
  }

  // 통계
  getStats(workflowId: string): {
    total: number;
    succeeded: number;
    failed: number;
    totalDuration: number;
    avgDuration: number;
  } {
    const logs = this.getLogs(workflowId);
    const succeeded = logs.filter((l) => !l.error).length;
    const failed = logs.filter((l) => l.error).length;
    const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

    return {
      total: logs.length,
      succeeded,
      failed,
      totalDuration,
      avgDuration: logs.length > 0 ? totalDuration / logs.length : 0,
    };
  }

  // 로그 초기화
  clear(workflowId?: string): void {
    if (workflowId) {
      this.logs.delete(workflowId);
    } else {
      this.logs.clear();
    }
  }

  // 로그 내보내기 (JSON)
  export(workflowId: string): string {
    const logs = this.getLogs(workflowId);
    return JSON.stringify(logs, null, 2);
  }
}
