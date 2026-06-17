/**
 * 스냅샷 비교기 — 이전 점검 결과와 현재 결과 비교
 */

import { nowISO, createLogger, type Logger } from '@sangfor/workflow-shared';
import type {
  HealthCheckResult,
  HealthCheckItemResult,
  SnapshotDiff,
  Change,
  AlertSeverity,
} from '@sangfor/workflow-core';
import type {
  DeviceSnapshot,
  DevicePolicy,
  DeviceObject,
  LicenseInfo,
  AlarmEntry,
} from '@sangfor/workflow-engine';

const log = createLogger('snapshot-comparator');

// ─── 스냅샷 비교 ────────────────────────────────────────────────────────────

export function compareSnapshots(
  previous: HealthCheckResult,
  current: HealthCheckResult
): SnapshotDiff {
  log.info(`Comparing snapshots: ${previous.checkId} vs ${current.checkId}`);

  const changes: Change[] = [];
  const anomalies: any[] = [];

  // 각 점검 항목 비교
  for (const currentItem of current.items) {
    const previousItem = previous.items.find((i) => i.itemId === currentItem.itemId);

    if (!previousItem) {
      // 새로 추가된 항목
      changes.push({
        path: `items.${currentItem.itemId}`,
        previousValue: undefined,
        currentValue: currentItem,
        changeType: 'added',
        severity: 'info',
      });
      continue;
    }

    // 상태 변경 감지
    if (previousItem.status !== currentItem.status) {
      const severity = getStatusChangeSeverity(previousItem.status, currentItem.status);
      changes.push({
        path: `items.${currentItem.itemId}.status`,
        previousValue: previousItem.status,
        currentValue: currentItem.status,
        changeType: 'modified',
        severity,
      });
    }

    // 데이터 변경 감지
    const dataChanges = compareData(
      previousItem.collectedData,
      currentItem.collectedData,
      `items.${currentItem.itemId}.data`
    );
    changes.push(...dataChanges);
  }

  // 이전에 있던 항목이 현재 없는 경우
  for (const previousItem of previous.items) {
    const currentItem = current.items.find((i) => i.itemId === previousItem.itemId);
    if (!currentItem) {
      changes.push({
        path: `items.${previousItem.itemId}`,
        previousValue: previousItem,
        currentValue: undefined,
        changeType: 'removed',
        severity: 'warning',
      });
    }
  }

  // 이상 패턴 감지
  anomalies.push(...detectAnomalies(previous, current));

  const summary = {
    totalChanges: changes.length,
    criticalChanges: changes.filter((c) => c.severity === 'critical').length,
    newAlerts: current.alerts.length - previous.alerts.length,
  };

  log.info(`Comparison completed: ${summary.totalChanges} changes, ${summary.criticalChanges} critical`);

  return {
    comparedAt: nowISO(),
    previousCheckId: previous.checkId,
    currentCheckId: current.checkId,
    changes,
    anomalies,
    summary,
  };
}

// ─── 데이터 비교 ────────────────────────────────────────────────────────────

function compareData(
  previous: any,
  current: any,
  basePath: string
): Change[] {
  const changes: Change[] = [];

  if (!previous && !current) {
    return changes;
  }

  if (!previous || !current) {
    changes.push({
      path: basePath,
      previousValue: previous,
      currentValue: current,
      changeType: previous ? 'removed' : 'added',
      severity: 'info',
    });
    return changes;
  }

  if (typeof previous !== typeof current) {
    changes.push({
      path: basePath,
      previousValue: previous,
      currentValue: current,
      changeType: 'modified',
      severity: 'warning',
    });
    return changes;
  }

  if (typeof previous === 'object') {
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const key of allKeys) {
      const subChanges = compareData(previous[key], current[key], `${basePath}.${key}`);
      changes.push(...subChanges);
    }
  } else if (previous !== current) {
    changes.push({
      path: basePath,
      previousValue: previous,
      currentValue: current,
      changeType: 'modified',
      severity: 'info',
    });
  }

  return changes;
}

// ─── 상태 변경 심각도 ────────────────────────────────────────────────────────

function getStatusChangeSeverity(
  previousStatus: string,
  currentStatus: string
): AlertSeverity {
  // 정상 → 이상
  if (previousStatus === 'pass' && currentStatus !== 'pass') {
    return currentStatus === 'critical' ? 'critical' : 'warning';
  }

  // 이상 → 정상
  if (previousStatus !== 'pass' && currentStatus === 'pass') {
    return 'info';
  }

  // 이상 → 더 심각
  if (previousStatus === 'warning' && currentStatus === 'critical') {
    return 'critical';
  }

  // 심각 → 덜 심각
  if (previousStatus === 'critical' && currentStatus === 'warning') {
    return 'info';
  }

  return 'info';
}

// ─── 이상 패턴 감지 ─────────────────────────────────────────────────────────

function detectAnomalies(
  previous: HealthCheckResult,
  current: HealthCheckResult
): any[] {
  const anomalies: any[] = [];

  // 알림 급증 감지
  if (current.alerts.length > previous.alerts.length * 2) {
    anomalies.push({
      type: 'alert_spike',
      message: `Alert count increased from ${previous.alerts.length} to ${current.alerts.length}`,
      severity: 'warning',
    });
  }

  // 모든 항목 실패 감지
  if (current.summary.passed === 0 && current.summary.total > 0) {
    anomalies.push({
      type: 'total_failure',
      message: 'All health check items failed',
      severity: 'critical',
    });
  }

  // 새로운 critical 알림 감지
  const newCriticalAlerts = current.alerts.filter(
    (a) =>
      a.severity === 'critical' &&
      !previous.alerts.some(
        (pa) => pa.itemId === a.itemId && pa.condition.field === a.condition.field
      )
  );

  if (newCriticalAlerts.length > 0) {
    anomalies.push({
      type: 'new_critical_alerts',
      message: `${newCriticalAlerts.length} new critical alerts detected`,
      severity: 'critical',
      alerts: newCriticalAlerts,
    });
  }

  return anomalies;
}

// ─── 트렌드 분석 ────────────────────────────────────────────────────────────

export function analyzeTrend(
  history: HealthCheckResult[],
  itemId: string
): {
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  details: string;
} {
  if (history.length < 2) {
    return { trend: 'stable', changeRate: 0, details: 'Insufficient data' };
  }

  const statusValues: Record<string, number> = {
    pass: 0,
    warning: 1,
    critical: 2,
    error: 3,
  };

  const itemStatuses = history
    .map((h) => h.items.find((i) => i.itemId === itemId))
    .filter(Boolean)
    .map((i) => statusValues[i!.status] ?? 3);

  if (itemStatuses.length < 2) {
    return { trend: 'stable', changeRate: 0, details: 'Insufficient data' };
  }

  const first = itemStatuses[0];
  const last = itemStatuses[itemStatuses.length - 1];
  const changeRate = (last - first) / itemStatuses.length;

  if (changeRate < -0.1) {
    return { trend: 'improving', changeRate, details: 'Status improving over time' };
  } else if (changeRate > 0.1) {
    return { trend: 'degrading', changeRate, details: 'Status degrading over time' };
  } else {
    return { trend: 'stable', changeRate, details: 'Status stable' };
  }
}

// ─── Device Snapshot Diff ─────────────────────────────────────────────────

export interface SnapshotChangeEntry {
  category: 'policy' | 'object' | 'license' | 'alarm' | 'network' | 'authSource' | 'version';
  action: 'added' | 'removed' | 'modified';
  itemId: string;
  itemName: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  severity: AlertSeverity;
}

export interface SnapshotDrift {
  category: string;
  description: string;
  severity: AlertSeverity;
  details: string;
}

export interface DeviceSnapshotDiff {
  comparedAt: string;
  beforeDeviceId: string;
  afterDeviceId: string;
  changes: SnapshotChangeEntry[];
  drifts: SnapshotDrift[];
  summary: {
    totalChanges: number;
    criticalChanges: number;
    addedItems: number;
    removedItems: number;
    modifiedItems: number;
  };
}

/**
 * DeviceSnapshot 비교 — 정책/객체/라이선스 변경 감지
 */
export function compareDeviceSnapshots(
  before: DeviceSnapshot,
  after: DeviceSnapshot,
): DeviceSnapshotDiff {
  log.info(`Comparing device snapshots: ${before.deviceId} vs ${after.deviceId}`);

  const changes: SnapshotChangeEntry[] = [];
  const drifts: SnapshotDrift[] = [];

  // 버전 변경 감지
  if (before.version !== after.version) {
    changes.push({
      category: 'version',
      action: 'modified',
      itemId: 'version',
      itemName: 'Product Version',
      before: before.version,
      after: after.version,
      severity: 'warning',
    });
  }

  // 정책 변경 감지
  changes.push(...comparePolicies(before.policies, after.policies));

  // 객체 변경 감지
  changes.push(...compareObjects(before.objects, after.objects));

  // 라이선스 변경 감지
  changes.push(...compareLicenses(before.licenses, after.licenses));

  // 알람 변경 감지
  changes.push(...compareAlarms(before.alarms, after.alarms));

  // 드리프트 감지
  const criticalChanges = changes.filter(c => c.severity === 'critical');
  if (criticalChanges.length > 0) {
    drifts.push({
      category: 'critical_drift',
      description: `${criticalChanges.length} critical configuration changes detected`,
      severity: 'critical',
      details: criticalChanges.map(c => `${c.category}/${c.itemName}: ${c.action}`).join('; '),
    });
  }

  // 정책 비활성화 드리프트
  const disabledPolicies = changes.filter(
    c => c.category === 'policy' && c.action === 'modified' && c.after === false,
  );
  if (disabledPolicies.length > 0) {
    drifts.push({
      category: 'policy_disabled',
      description: `${disabledPolicies.length} policies were disabled`,
      severity: 'warning',
      details: disabledPolicies.map(c => c.itemName).join(', '),
    });
  }

  const summary = {
    totalChanges: changes.length,
    criticalChanges: criticalChanges.length,
    addedItems: changes.filter(c => c.action === 'added').length,
    removedItems: changes.filter(c => c.action === 'removed').length,
    modifiedItems: changes.filter(c => c.action === 'modified').length,
  };

  log.info(`Device snapshot comparison: ${summary.totalChanges} changes, ${summary.criticalChanges} critical`);

  return {
    comparedAt: nowISO(),
    beforeDeviceId: before.deviceId,
    afterDeviceId: after.deviceId,
    changes,
    drifts,
    summary,
  };
}

// ─── Policy Comparison ─────────────────────────────────────────────────────

function comparePolicies(before: DevicePolicy[], after: DevicePolicy[]): SnapshotChangeEntry[] {
  const changes: SnapshotChangeEntry[] = [];
  const beforeMap = new Map(before.map(p => [p.id, p]));
  const afterMap = new Map(after.map(p => [p.id, p]));

  // 추가된 정책
  for (const [id, policy] of afterMap) {
    if (!beforeMap.has(id)) {
      changes.push({
        category: 'policy',
        action: 'added',
        itemId: id,
        itemName: policy.name,
        before: null,
        after: policy.enabled,
        severity: 'info',
      });
    }
  }

  // 제거된 정책
  for (const [id, policy] of beforeMap) {
    if (!afterMap.has(id)) {
      changes.push({
        category: 'policy',
        action: 'removed',
        itemId: id,
        itemName: policy.name,
        before: policy.enabled,
        after: null,
        severity: 'warning',
      });
    }
  }

  // 수정된 정책
  for (const [id, beforePolicy] of beforeMap) {
    const afterPolicy = afterMap.get(id);
    if (!afterPolicy) continue;

    if (beforePolicy.enabled !== afterPolicy.enabled) {
      changes.push({
        category: 'policy',
        action: 'modified',
        itemId: id,
        itemName: beforePolicy.name,
        before: beforePolicy.enabled,
        after: afterPolicy.enabled,
        severity: afterPolicy.enabled ? 'info' : 'critical',
      });
    }
  }

  return changes;
}

// ─── Object Comparison ─────────────────────────────────────────────────────

function compareObjects(before: DeviceObject[], after: DeviceObject[]): SnapshotChangeEntry[] {
  const changes: SnapshotChangeEntry[] = [];
  const beforeMap = new Map(before.map(o => [o.id, o]));
  const afterMap = new Map(after.map(o => [o.id, o]));

  for (const [id, obj] of afterMap) {
    if (!beforeMap.has(id)) {
      changes.push({
        category: 'object',
        action: 'added',
        itemId: id,
        itemName: obj.name,
        before: null,
        after: obj.name,
        severity: 'info',
      });
    }
  }

  for (const [id, obj] of beforeMap) {
    if (!afterMap.has(id)) {
      changes.push({
        category: 'object',
        action: 'removed',
        itemId: id,
        itemName: obj.name,
        before: obj.name,
        after: null,
        severity: 'warning',
      });
    }
  }

  return changes;
}

// ─── License Comparison ────────────────────────────────────────────────────

function compareLicenses(before: LicenseInfo[], after: LicenseInfo[]): SnapshotChangeEntry[] {
  const changes: SnapshotChangeEntry[] = [];
  const beforeMap = new Map(before.map(l => [l.key, l]));
  const afterMap = new Map(after.map(l => [l.key, l]));

  for (const [key, license] of afterMap) {
    const beforeLicense = beforeMap.get(key);
    if (!beforeLicense) {
      changes.push({
        category: 'license',
        action: 'added',
        itemId: key,
        itemName: license.type,
        before: null,
        after: license.status,
        severity: 'info',
      });
    } else if (beforeLicense.status !== license.status) {
      changes.push({
        category: 'license',
        action: 'modified',
        itemId: key,
        itemName: license.type,
        before: beforeLicense.status,
        after: license.status,
        severity: license.status === 'expired' ? 'critical' : 'warning',
      });
    }
  }

  for (const [key, license] of beforeMap) {
    if (!afterMap.has(key)) {
      changes.push({
        category: 'license',
        action: 'removed',
        itemId: key,
        itemName: license.type,
        before: license.status,
        after: null,
        severity: 'critical',
      });
    }
  }

  return changes;
}

// ─── Alarm Comparison ──────────────────────────────────────────────────────

function compareAlarms(before: AlarmEntry[], after: AlarmEntry[]): SnapshotChangeEntry[] {
  const changes: SnapshotChangeEntry[] = [];
  const beforeIds = new Set(before.map(a => a.id));
  const afterIds = new Set(after.map(a => a.id));

  // 새로운 알람
  for (const alarm of after) {
    if (!beforeIds.has(alarm.id)) {
      changes.push({
        category: 'alarm',
        action: 'added',
        itemId: alarm.id,
        itemName: alarm.message,
        before: null,
        after: alarm.severity,
        severity: alarm.severity === 'critical' ? 'critical' : 'info',
      });
    }
  }

  // 해결된 알람
  for (const alarm of before) {
    if (!afterIds.has(alarm.id)) {
      changes.push({
        category: 'alarm',
        action: 'removed',
        itemId: alarm.id,
        itemName: alarm.message,
        before: alarm.severity,
        after: null,
        severity: 'info',
      });
    }
  }

  return changes;
}
