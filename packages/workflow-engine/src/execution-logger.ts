/**
 * Execution Logger — 실행 이력 관리 + Evidence Writer (PR-26)
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

// ═══════════════════════════════════════════════════════════════════════════════
// EvidenceWriter — 실행 결과 evidence Markdown 생성 (PR-26)
// ═══════════════════════════════════════════════════════════════════════════════

const evidenceLog = createLogger('evidence-writer');

/** Evidence 데이터 구조 */
export interface EvidenceData {
  executionId: string;
  requestOriginal: string;
  product: string;
  version: string;
  snapshotSummary: string;
  playbookRationale: string;
  precheckResult: string;
  approvalStatus: string;
  stepResults: EvidenceStepResult[];
  postcheckResult: string;
  beforeAfterDiff: string;
  failureCause: string;
  followUpAction: string;
}

export interface EvidenceStepResult {
  stepName: string;
  toolName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

export class EvidenceWriter {
  private logger: ExecutionLogger;

  constructor(logger: ExecutionLogger) {
    this.logger = logger;
  }

  /**
   * 실행 ID로 evidence Markdown을 생성
   */
  generateEvidenceMarkdown(data: EvidenceData): string {
    const lines: string[] = [];

    lines.push(`# 실행 Evidence 보고서`);
    lines.push('');
    lines.push(`## 기본 정보`);
    lines.push('');
    lines.push(`| 항목 | 값 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 실행 ID | \`${data.executionId}\` |`);
    lines.push(`| 요청 원문 | ${data.requestOriginal} |`);
    lines.push(`| 제품 | ${data.product} |`);
    lines.push(`| 버전 | ${data.version} |`);
    lines.push(`| 생성 시간 | ${nowISO()} |`);
    lines.push('');

    lines.push(`## 스냅샷 요약`);
    lines.push('');
    lines.push(data.snapshotSummary);
    lines.push('');

    lines.push(`## Playbook 근거`);
    lines.push('');
    lines.push(data.playbookRationale);
    lines.push('');

    lines.push(`## Pre-check 결과`);
    lines.push('');
    lines.push(data.precheckResult);
    lines.push('');

    lines.push(`## 승인 상태`);
    lines.push('');
    lines.push(`| 상태 |`);
    lines.push(`|------|`);
    lines.push(`| ${data.approvalStatus} |`);
    lines.push('');

    lines.push(`## 단계별 실행 결과`);
    lines.push('');
    lines.push(`| 단계 | Tool | 상태 | 소요시간(ms) | 오류 |`);
    lines.push(`|------|------|------|-------------|------|`);
    for (const step of data.stepResults) {
      const statusEmoji = step.status === 'pass' ? '✅' : step.status === 'fail' ? '❌' : '⏭️';
      lines.push(
        `| ${step.stepName} | ${step.toolName} | ${statusEmoji} ${step.status} | ${step.duration} | ${step.error ?? '-'} |`,
      );
    }
    lines.push('');

    lines.push(`## Post-check 결과`);
    lines.push('');
    lines.push(data.postcheckResult);
    lines.push('');

    lines.push(`## 전후 Diff`);
    lines.push('');
    lines.push(data.beforeAfterDiff);
    lines.push('');

    lines.push(`## 실패 원인`);
    lines.push('');
    lines.push(data.failureCause || '없음');
    lines.push('');

    lines.push(`## 후속 조치`);
    lines.push('');
    lines.push(data.followUpAction || '없음');
    lines.push('');

    lines.push('---');
    lines.push(`*이 보고서는 자동 생성되었습니다. (${nowISO()})*`);

    return lines.join('\n');
  }

  /**
   * ExecutionLogger에서 데이터를 수집하고 evidence를 파일로 저장
   */
  saveEvidence(
    executionId: string,
    data: EvidenceData,
    outputDir: string = './outputs/evidence',
  ): string {
    mkdirSync(outputDir, { recursive: true });

    const markdown = this.generateEvidenceMarkdown(data);
    const filePath = join(outputDir, `evidence_${executionId}_${Date.now()}.md`);

    writeFileSync(filePath, markdown, 'utf-8');

    evidenceLog.info(`Evidence 파일 저장: ${filePath}`);
    return filePath;
  }

  /**
   * ExecutionLogger에서 실행 로그를 기반으로 EvidenceData를 생성
   */
  collectFromLogs(
    executionId: string,
    metadata: {
      requestOriginal: string;
      product: string;
      version: string;
      snapshotSummary: string;
      playbookRationale: string;
      precheckResult: string;
      approvalStatus: string;
      postcheckResult: string;
      beforeAfterDiff: string;
      failureCause: string;
      followUpAction: string;
    },
  ): EvidenceData {
    const logs = this.logger.getLogs(executionId);

    const stepResults: EvidenceStepResult[] = logs.map((l) => ({
      stepName: l.stepId,
      toolName: l.toolName,
      status: l.error ? 'fail' : 'pass',
      duration: l.duration ?? 0,
      error: l.error,
    }));

    return {
      executionId,
      ...metadata,
      stepResults,
    };
  }
}
