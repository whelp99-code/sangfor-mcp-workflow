/**
 * Incident Detector — HealthCheck 결과에서 incident 탐지
 *
 * health-checker의 정기 점검 결과를 분석하여
 * incident 후보를 생성하는 모듈.
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('incident-detector');

// ─── Incident Types ────────────────────────────────────────────────────────

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'detected' | 'investigating' | 'remediating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  affectedDevices: string[];
  detectedAt: string;
  status: IncidentStatus;
  sourceCheckId: string;
  alerts: IncidentAlert[];
  rootCauseCandidates: RootCauseCandidate[];
  metadata: Record<string, unknown>;
}

export interface IncidentAlert {
  alertId: string;
  itemName: string;
  severity: string;
  message: string;
  condition: string;
  actualValue: unknown;
}

export interface RootCauseCandidate {
  id: string;
  hypothesis: string;
  confidence: number; // 0-1
  evidence: string[];
  suggestedAction: string;
}

// ─── HealthCheck 입력 타입 (workflow-core 호환) ─────────────────────────────

export interface HealthCheckResultInput {
  checkId: string;
  product: string;
  targetUrl: string;
  checkedAt: string;
  items: Array<{
    itemId: string;
    name: string;
    status: 'pass' | 'warning' | 'critical' | 'error';
    collectedData?: unknown;
    error?: string;
  }>;
  alerts: Array<{
    itemId: string;
    itemName: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    actualValue: unknown;
    condition: {
      field: string;
      operator: string;
      value: string | number | boolean;
      severity: 'info' | 'warning' | 'critical';
    };
  }>;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    critical: number;
  };
}

// ─── Incident Detector ─────────────────────────────────────────────────────

export class IncidentDetector {

  /**
   * HealthCheck 결과에서 incident 탐지
   */
  detectIncidents(healthCheckResult: HealthCheckResultInput): Incident[] {
    const incidents: Incident[] = [];

    log.info(
      `Detecting incidents from health check: ${healthCheckResult.checkId} ` +
      `(${healthCheckResult.alerts.length} alerts)`,
    );

    // critical alerts → incident
    const criticalAlerts = healthCheckResult.alerts.filter(
      (a) => a.severity === 'critical',
    );

    if (criticalAlerts.length > 0) {
      const incident = this.createIncidentFromAlerts(
        criticalAlerts,
        healthCheckResult,
        'critical',
      );
      incidents.push(incident);
    }

    // warning alerts → incident (복수 warning이면 medium severity)
    const warningAlerts = healthCheckResult.alerts.filter(
      (a) => a.severity === 'warning',
    );

    if (warningAlerts.length >= 3) {
      // 다수 warning → medium incident
      const incident = this.createIncidentFromAlerts(
        warningAlerts,
        healthCheckResult,
        'medium',
      );
      incidents.push(incident);
    } else if (warningAlerts.length > 0) {
      const incident = this.createIncidentFromAlerts(
        warningAlerts,
        healthCheckResult,
        'low',
      );
      incidents.push(incident);
    }

    // error status items → incident
    const errorItems = healthCheckResult.items.filter(
      (i) => i.status === 'error',
    );

    if (errorItems.length > 0) {
      const incident = this.createIncidentFromErrors(
        errorItems,
        healthCheckResult,
      );
      incidents.push(incident);
    }

    // root cause candidates 생성
    for (const incident of incidents) {
      incident.rootCauseCandidates = this.generateRootCauseCandidates(incident);
    }

    log.info(
      `Incident detection complete: ${incidents.length} incidents from ` +
      `check ${healthCheckResult.checkId}`,
    );

    return incidents;
  }

  /**
   * alerts를 기반으로 severity 분류
   */
  classifySeverity(
    alerts: Array<{ severity: string }>,
  ): IncidentSeverity {
    if (alerts.some((a) => a.severity === 'critical')) return 'critical';
    if (alerts.filter((a) => a.severity === 'warning').length >= 3) return 'medium';
    if (alerts.some((a) => a.severity === 'warning')) return 'low';
    return 'low';
  }

  /**
   * Incident에서 root cause 후보 생성
   */
  generateRootCauseCandidates(incident: Incident): RootCauseCandidate[] {
    const candidates: RootCauseCandidate[] = [];

    // alert 패턴 기반 후보 생성
    for (const alert of incident.alerts) {
      if (alert.severity === 'critical') {
        candidates.push({
          id: nowId('rc'),
          hypothesis: `${alert.itemName}에서 critical 상태 감지 — ${alert.message}`,
          confidence: 0.8,
          evidence: [alert.message, `조건: ${alert.condition}`],
          suggestedAction: `${alert.itemName} 점검 및 설정 확인`,
        });
      }
    }

    // 에러 기반 후보
    const errorMsgs = incident.alerts
      .filter((a) => a.message.includes('error') || a.message.includes('Error'))
      .map((a) => a.message);

    if (errorMsgs.length > 0) {
      candidates.push({
        id: nowId('rc'),
        hypothesis: `시스템 오류 발생 — ${errorMsgs.length}개 에러 메시지`,
        confidence: 0.6,
        evidence: errorMsgs,
        suggestedAction: '시스템 로그 확인 및 에러 원인 분석',
      });
    }

    // 네트워크 관련 후보
    const networkAlerts = incident.alerts.filter(
      (a) =>
        a.message.toLowerCase().includes('network') ||
        a.message.toLowerCase().includes('connection') ||
        a.message.toLowerCase().includes('timeout'),
    );

    if (networkAlerts.length > 0) {
      candidates.push({
        id: nowId('rc'),
        hypothesis: '네트워크 연결 문제 가능성',
        confidence: 0.5,
        evidence: networkAlerts.map((a) => a.message),
        suggestedAction: '네트워크 연결 상태 및 방화벽 규칙 확인',
      });
    }

    // 기본 후보 (최소 1개 보장)
    if (candidates.length === 0) {
      candidates.push({
        id: nowId('rc'),
        hypothesis: '원인 미확인 — 추가 조사 필요',
        confidence: 0.1,
        evidence: [`Incident: ${incident.title}`],
        suggestedAction: '상세 로그 분석 및 장비 점검',
      });
    }

    return candidates;
  }

  // ─── 내부 헬퍼 ──────────────────────────────────────────────────────────

  private createIncidentFromAlerts(
    alerts: HealthCheckResultInput['alerts'],
    result: HealthCheckResultInput,
    severity: IncidentSeverity,
  ): Incident {
    const affectedDevices = [result.targetUrl];
    const alertDescriptions = alerts.map(
      (a) => `${a.itemName}: ${a.message}`,
    );

    const incidentAlerts: IncidentAlert[] = alerts.map((a) => ({
      alertId: nowId('alert'),
      itemName: a.itemName,
      severity: a.severity,
      message: a.message,
      condition: `${a.condition.field} ${a.condition.operator} ${a.condition.value}`,
      actualValue: a.actualValue,
    }));

    return {
      id: nowId('incident'),
      severity,
      title: `[${severity.toUpperCase()}] ${result.product} 장비 이상 감지 — ${alerts.length}건 alert`,
      description: alertDescriptions.join('\n'),
      affectedDevices,
      detectedAt: nowISO(),
      status: 'detected',
      sourceCheckId: result.checkId,
      alerts: incidentAlerts,
      rootCauseCandidates: [],
      metadata: {
        product: result.product,
        checkSummary: result.summary,
      },
    };
  }

  private createIncidentFromErrors(
    errorItems: HealthCheckResultInput['items'],
    result: HealthCheckResultInput,
  ): Incident {
    const incidentAlerts: IncidentAlert[] = errorItems.map((item) => ({
      alertId: nowId('alert'),
      itemName: item.name,
      severity: 'critical',
      message: item.error ?? `점검 항목 ${item.name} 실행 오류`,
      condition: 'item status = error',
      actualValue: 'error',
    }));

    return {
      id: nowId('incident'),
      severity: 'high',
      title: `[HIGH] ${result.product} 점검 실행 오류 — ${errorItems.length}개 항목 실패`,
      description: errorItems
        .map((i) => `${i.name}: ${i.error ?? 'unknown error'}`)
        .join('\n'),
      affectedDevices: [result.targetUrl],
      detectedAt: nowISO(),
      status: 'detected',
      sourceCheckId: result.checkId,
      alerts: incidentAlerts,
      rootCauseCandidates: [],
      metadata: {
        product: result.product,
        errorCount: errorItems.length,
      },
    };
  }
}
