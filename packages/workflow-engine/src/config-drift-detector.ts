/**
 * Config Drift Detector — 설정 드립트 감지
 *
 * DesiredState와 DeviceSnapshot을 비교하여
 * 설정 불일치(drift)를 감지하고 심각도를 분류합니다.
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { DeviceSnapshot, DesiredState } from './device-model.js';

const log = createLogger('config-drift-detector');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type DriftSeverity = 'info' | 'warning' | 'critical';

export interface DriftEntry {
  field: string;
  desiredValue: string | number | boolean | null;
  currentValue: string | number | boolean | null;
  severity: DriftSeverity;
  category: string;
}

export interface DriftReport {
  id: string;
  deviceId: string;
  product: string;
  detectedAt: string;
  drifts: DriftEntry[];
  severity: DriftSeverity;
  summary: string;
}

// ─── 심각도 분류 규칙 ────────────────────────────────────────────────────────

/** 보안 관련 필드 패턴 — critical */
const SECURITY_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /auth/i,
  /cert/i,
  /ssl/i,
  /tls/i,
  /encrypt/i,
  /permission/i,
  /access.?control/i,
];

/** 정책 관련 필드 패턴 — warning */
const POLICY_FIELD_PATTERNS = [
  /policy/i,
  /rule/i,
  /firewall/i,
  /filter/i,
  /block/i,
  /allow/i,
  /deny/i,
  /threshold/i,
];

/**
 * 드립트 심각도 분류
 * - 보안 관련 필드: critical
 * - 정책 관련 필드: warning
 * - 기타: info
 */
export function classifySeverity(field: string, desiredValue: string | number | boolean | null, currentValue: string | number | boolean | null): DriftSeverity {
  // 값이 모두 null이면 info
  if (desiredValue === null && currentValue === null) {
    return 'info';
  }

  // 보안 필드 패턴 매칭
  for (const pattern of SECURITY_FIELD_PATTERNS) {
    if (pattern.test(field)) {
      return 'critical';
    }
  }

  // 정책 필드 패턴 매칭
  for (const pattern of POLICY_FIELD_PATTERNS) {
    if (pattern.test(field)) {
      return 'warning';
    }
  }

  // boolean 값 변경은 warning
  if (typeof desiredValue === 'boolean' && typeof currentValue === 'boolean' && desiredValue !== currentValue) {
    return 'warning';
  }

  return 'info';
}

// ─── Config Drift Detector ──────────────────────────────────────────────────

export class ConfigDriftDetector {
  /**
   * DesiredState와 DeviceSnapshot을 비교하여 DriftReport 생성
   *
   * 비교 방식:
   * 1. DesiredState.settings의 각 키에 대해 현재 값을 policies/rules에서 탐색
   * 2. 값이 다르면 DriftEntry 생성
   * 3. 매칭되는 현재 값이 없으면 currentValue=null로 기록
   */
  detectDrift(desired: DesiredState, current: DeviceSnapshot): DriftReport {
    const reportId = nowId('drift');
    log.info(`Detecting drift for device ${current.deviceId} (product: ${desired.product})`);

    const drifts: DriftEntry[] = [];

    for (const [field, desiredValue] of Object.entries(desired.settings)) {
      const currentValue = this.resolveCurrentValue(field, current);
      const category = this.categorizeField(field);

      // 값이 동일하면 드립트 아님
      if (this.valuesEqual(desiredValue, currentValue)) {
        continue;
      }

      const severity = classifySeverity(field, desiredValue, currentValue);

      drifts.push({
        field,
        desiredValue,
        currentValue,
        severity,
        category,
      });
    }

    // 전체 보고서 심각도 = 가장 높은 심각도
    const reportSeverity = this.highestSeverity(drifts);

    const summary = this.buildSummary(drifts, current.deviceId);

    log.info(`Drift detection complete: ${drifts.length} drifts found (severity: ${reportSeverity})`);

    return {
      id: reportId,
      deviceId: current.deviceId,
      product: desired.product,
      detectedAt: nowISO(),
      drifts,
      severity: reportSeverity,
      summary,
    };
  }

  /**
   * 현재 장치 스냅샷에서 필드 값 탐색
   * policies.rules → objects.properties → network 순서로 탐색
   */
  private resolveCurrentValue(
    field: string,
    snapshot: DeviceSnapshot,
  ): string | number | boolean | null {
    // 1. policies.rules에서 탐색
    for (const policy of snapshot.policies) {
      if (field in policy.rules) {
        return policy.rules[field];
      }
    }

    // 2. objects.properties에서 탐색
    for (const obj of snapshot.objects) {
      if (field in obj.properties) {
        return obj.properties[field];
      }
    }

    // 3. 매칭되는 값 없음
    return null;
  }

  /**
   * 값 동등 비교 (null-safe)
   */
  private valuesEqual(
    a: string | number | boolean | null,
    b: string | number | boolean | null,
  ): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a === b;
  }

  /**
   * 필드명 기반 카테고리 분류
   */
  private categorizeField(field: string): string {
    if (SECURITY_FIELD_PATTERNS.some(p => p.test(field))) return 'security';
    if (POLICY_FIELD_PATTERNS.some(p => p.test(field))) return 'policy';
    if (/network|ip|dns|route|interface/i.test(field)) return 'network';
    if (/license|subscription/i.test(field)) return 'license';
    if (/log|audit|syslog/i.test(field)) return 'logging';
    return 'general';
  }

  /**
   * 가장 높은 심각도 반환
   */
  private highestSeverity(drifts: DriftEntry[]): DriftSeverity {
    if (drifts.some(d => d.severity === 'critical')) return 'critical';
    if (drifts.some(d => d.severity === 'warning')) return 'warning';
    return 'info';
  }

  /**
   * 요약 문자열 생성
   */
  private buildSummary(drifts: DriftEntry[], deviceId: string): string {
    if (drifts.length === 0) {
      return `장치 ${deviceId}: 설정 불일치 없음 — desired state와 일치`;
    }

    const criticalCount = drifts.filter(d => d.severity === 'critical').length;
    const warningCount = drifts.filter(d => d.severity === 'warning').length;
    const infoCount = drifts.filter(d => d.severity === 'info').length;

    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`critical ${criticalCount}건`);
    if (warningCount > 0) parts.push(`warning ${warningCount}건`);
    if (infoCount > 0) parts.push(`info ${infoCount}건`);

    return `장치 ${deviceId}: ${drifts.length}건 설정 불일치 감지 (${parts.join(', ')})`;
  }
}
