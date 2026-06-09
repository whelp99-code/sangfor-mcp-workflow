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
