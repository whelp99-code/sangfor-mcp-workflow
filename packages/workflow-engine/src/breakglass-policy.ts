/**
 * Break-Glass Policy — 비상 접근 승인 관리
 *
 * 정상 승인 프로세스를 우회하는 비상 접근(break-glass)을
 * 관리하는 모듈. 만료 시간, 감사 로그, 자동 해제 지원.
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('breakglass-policy');

// ─── Break-Glass Types ─────────────────────────────────────────────────────

export type BreakGlassStatus = 'pending' | 'approved' | 'expired' | 'revoked' | 'used';

export interface BreakGlassRequest {
  id: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: BreakGlassStatus;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt: string;
  revokedBy?: string;
  revokedAt?: string;
  metadata: Record<string, unknown>;
}

export interface BreakGlassAuditEntry {
  requestId: string;
  action: 'requested' | 'approved' | 'denied' | 'expired' | 'revoked' | 'used';
  actor: string;
  at: string;
  details: string;
}

export interface BreakGlassConfig {
  /** break-glass 유효 시간 (분) */
  defaultDurationMinutes: number;
  /** 최대 유효 시간 (분) */
  maxDurationMinutes: number;
  /** 승인 필요 여부 (false면 요청 즉시 활성) */
  approvalRequired: boolean;
  /** 자동 만료 체크 간격 (ms) */
  expirationCheckIntervalMs: number;
}

const DEFAULT_CONFIG: BreakGlassConfig = {
  defaultDurationMinutes: 60,
  maxDurationMinutes: 480, // 8시간
  approvalRequired: true,
  expirationCheckIntervalMs: 60_000, // 1분
};

// ─── Break-Glass Policy ────────────────────────────────────────────────────

export class BreakGlassPolicy {
  private requests: Map<string, BreakGlassRequest> = new Map();
  private auditLog: BreakGlassAuditEntry[] = [];
  private config: BreakGlassConfig;
  private expirationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<BreakGlassConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 자동 만료 체크 타이머 시작
    this.startExpirationCheck();
  }

  /**
   * Break-glass 요청 생성
   */
  requestBreakGlass(
    reason: string,
    requestedBy: string,
    durationMinutes?: number,
  ): BreakGlassRequest {
    // duration 검증
    const duration = this.validateDuration(durationMinutes);

    const requestId = nowId('breakglass');
    const requestedAt = nowISO();
    const expiresAt = new Date(
      Date.now() + duration * 60_000,
    ).toISOString();

    const request: BreakGlassRequest = {
      id: requestId,
      reason,
      requestedBy,
      requestedAt,
      status: this.config.approvalRequired ? 'pending' : 'approved',
      expiresAt,
      metadata: {
        durationMinutes: duration,
        approvalRequired: this.config.approvalRequired,
      },
    };

    // 승인 불필요 시 즉시 활성화
    if (!this.config.approvalRequired) {
      request.approvedBy = 'auto-approved';
      request.approvedAt = requestedAt;
    }

    this.requests.set(requestId, request);

    // 감사 로그 기록
    this.addAuditEntry(requestId, 'requested', requestedBy, `사유: ${reason}`);

    log.info(
      `Break-glass request created: ${requestId} ` +
      `by ${requestedBy} (expires: ${expiresAt}, ` +
      `approval: ${this.config.approvalRequired})`,
    );

    return request;
  }

  /**
   * Break-glass 승인 처리
   */
  approveBreakGlass(requestId: string, approvedBy: string): BreakGlassRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Break-glass request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(
        `Cannot approve break-glass request ${requestId}: ` +
        `current status is ${request.status}`,
      );
    }

    // 만료 여부 확인
    if (this.isExpired(request)) {
      request.status = 'expired';
      this.addAuditEntry(requestId, 'expired', 'system', '승인 전 만료됨');
      throw new Error(`Break-glass request ${requestId} has expired`);
    }

    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = nowISO();

    this.addAuditEntry(
      requestId, 'approved', approvedBy,
      `승인 완료 (만료: ${request.expiresAt})`,
    );

    log.info(`Break-glass approved: ${requestId} by ${approvedBy}`);

    return request;
  }

  /**
   * Break-glass 요청 거절
   */
  denyBreakGlass(requestId: string, deniedBy: string, reason: string): BreakGlassRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Break-glass request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(
        `Cannot deny break-glass request ${requestId}: ` +
        `current status is ${request.status}`,
      );
    }

    request.status = 'revoked';
    request.revokedBy = deniedBy;
    request.revokedAt = nowISO();
    request.metadata = { ...request.metadata, denyReason: reason };

    this.addAuditEntry(requestId, 'denied', deniedBy, `거절 사유: ${reason}`);

    log.info(`Break-glass denied: ${requestId} by ${deniedBy} — ${reason}`);

    return request;
  }

  /**
   * 활성 break-glass 세션 조회
   */
  isBreakGlassActive(): boolean {
    const now = new Date();
    const allRequests = Array.from(this.requests.values());
    for (const request of allRequests) {
      if (
        request.status === 'approved' &&
        new Date(request.expiresAt) > now
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * 특정 요청의 활성 상태 확인
   */
  isRequestActive(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request) return false;
    return request.status === 'approved' && !this.isExpired(request);
  }

  /**
   * 활성 break-glass 세션 목록
   */
  getActiveSessions(): BreakGlassRequest[] {
    const now = new Date();
    return Array.from(this.requests.values()).filter(
      r => r.status === 'approved' && new Date(r.expiresAt) > now,
    );
  }

  /**
   * 만료된 세션 정리
   */
  expireStaleSessions(): number {
    let expired = 0;
    const now = new Date();

    const allRequests = Array.from(this.requests.values());
    for (const request of allRequests) {
      if (request.status === 'approved' && new Date(request.expiresAt) <= now) {
        request.status = 'expired';
        this.addAuditEntry(request.id, 'expired', 'system', '자동 만료 처리');
        expired++;
      }
    }

    if (expired > 0) {
      log.info(`Expired ${expired} stale break-glass sessions`);
    }

    return expired;
  }

  /**
   * Break-glass 세션 강제 해지
   */
  revokeBreakGlass(requestId: string, revokedBy: string, reason: string): BreakGlassRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Break-glass request not found: ${requestId}`);
    }

    if (request.status !== 'approved' && request.status !== 'pending') {
      throw new Error(
        `Cannot revoke break-glass request ${requestId}: ` +
        `current status is ${request.status}`,
      );
    }

    request.status = 'revoked';
    request.revokedBy = revokedBy;
    request.revokedAt = nowISO();
    request.metadata = { ...request.metadata, revokeReason: reason };

    this.addAuditEntry(requestId, 'revoked', revokedBy, `해지 사유: ${reason}`);

    log.info(`Break-glass revoked: ${requestId} by ${revokedBy} — ${reason}`);

    return request;
  }

  /**
   * 감사 로그 조회
   */
  getAuditLog(requestId?: string): BreakGlassAuditEntry[] {
    if (requestId) {
      return this.auditLog.filter(e => e.requestId === requestId);
    }
    return [...this.auditLog];
  }

  /**
   * 모든 요청 조회
   */
  getAllRequests(): BreakGlassRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * 특정 요청 조회
   */
  getRequest(requestId: string): BreakGlassRequest | null {
    return this.requests.get(requestId) ?? null;
  }

  /**
   * 리소스 정리 (타이머 해제)
   */
  dispose(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────────────────────────

  private validateDuration(durationMinutes?: number): number {
    if (durationMinutes === undefined) {
      return this.config.defaultDurationMinutes;
    }

    if (durationMinutes <= 0) {
      throw new Error('Duration must be greater than 0 minutes');
    }

    if (durationMinutes > this.config.maxDurationMinutes) {
      throw new Error(
        `Duration ${durationMinutes} minutes exceeds maximum ` +
        `allowed ${this.config.maxDurationMinutes} minutes`,
      );
    }

    return durationMinutes;
  }

  private isExpired(request: BreakGlassRequest): boolean {
    return new Date(request.expiresAt) <= new Date();
  }

  private addAuditEntry(
    requestId: string,
    action: BreakGlassAuditEntry['action'],
    actor: string,
    details: string,
  ): void {
    this.auditLog.push({
      requestId,
      action,
      actor,
      at: nowISO(),
      details,
    });
  }

  private startExpirationCheck(): void {
    this.expirationTimer = setInterval(() => {
      this.expireStaleSessions();
    }, this.config.expirationCheckIntervalMs);
  }
}
