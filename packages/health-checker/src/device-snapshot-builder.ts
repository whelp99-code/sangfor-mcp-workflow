/**
 * 제품별 수집 결과 → DeviceSnapshot + HealthCheckResult 변환
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowId, nowISO } from '@sangfor/workflow-shared';
import type { HealthAlert, HealthCheckItemResult, HealthCheckResult } from '@sangfor/workflow-core';
import type { DeviceSnapshot, AlarmEntry, DeviceObject, RawRef } from '@sangfor/workflow-engine';
import {
  CC_CHECK_ITEMS,
  EPP_CHECK_ITEMS,
  IAG_CHECK_ITEMS,
} from './default-configs.js';
import type { DeviceCollection, DeviceMenuCapture } from './device-collection-types.js';

export function newDeviceId(product: string): string {
  return nowId(`${product.toLowerCase()}-device`);
}

/** @deprecated newDeviceId('CC') 사용 */
export const newCcDeviceId = (): string => newDeviceId('CC');

export function collectionTimestamp(): string {
  return nowISO();
}

function findMenu(collection: DeviceCollection, ...pathPrefix: string[]): DeviceMenuCapture | undefined {
  return collection.menus.find((m) =>
    pathPrefix.every((p, i) => m.menuPath[i]?.toLowerCase().includes(p.toLowerCase())),
  );
}

function findMenuById(collection: DeviceCollection, id: string): DeviceMenuCapture | undefined {
  return collection.menus.find((m) => m.id === id);
}

function extractMetric(labels: string[], pattern: RegExp): number | undefined {
  for (const label of labels) {
    const match = label.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function evaluateConditions(
  checkItems: typeof CC_CHECK_ITEMS,
  collectedDataByItem: Record<string, Record<string, unknown>>,
  collection: DeviceCollection,
): HealthCheckResult {
  const checkId = nowId('check');
  const items: HealthCheckItemResult[] = [];
  const alerts: HealthAlert[] = [];

  for (const checkItem of checkItems) {
    const collectedData = collectedDataByItem[checkItem.id] ?? {};

    for (const condition of checkItem.alertConditions ?? []) {
      const field = condition.field.replace(/^data\./, '');
      const actualValue = collectedData[field];
      let triggered = false;

      switch (condition.operator) {
        case 'equals':
          triggered = actualValue === condition.value;
          break;
        case 'not_equals':
          triggered = actualValue !== condition.value;
          break;
        case 'greater_than':
          triggered = Number(actualValue) > Number(condition.value);
          break;
        default:
          break;
      }

      if (triggered) {
        alerts.push({
          itemId: checkItem.id,
          itemName: checkItem.name,
          severity: condition.severity,
          message: `${checkItem.name}: ${field}=${String(actualValue)} (조건: ${condition.operator} ${String(condition.value)})`,
          actualValue,
          condition,
        });
      }
    }

    const itemAlerts = alerts.filter((a) => a.itemId === checkItem.id);
    items.push({
      itemId: checkItem.id,
      name: checkItem.name,
      status: itemAlerts.some((a) => a.severity === 'critical')
        ? 'critical'
        : itemAlerts.some((a) => a.severity === 'warning')
          ? 'warning'
          : 'pass',
      collectedData,
    });
  }

  return {
    checkId,
    product: collection.product,
    targetUrl: collection.targetUrl,
    checkedAt: collection.collectedAt,
    items,
    alerts,
    summary: {
      total: items.length,
      passed: items.filter((i) => i.status === 'pass').length,
      warnings: items.filter((i) => i.status === 'warning').length,
      critical: items.filter((i) => i.status === 'critical').length,
    },
  };
}

function baseSnapshot(collection: DeviceCollection): Omit<DeviceSnapshot, 'alarms' | 'objects'> {
  const hostname = new URL(collection.targetUrl).hostname;
  const rawRefs: RawRef[] = collection.menus
    .filter((m) => m.screenshotPath)
    .map((m) => ({
      source: m.id,
      path: m.screenshotPath!,
      capturedAt: m.capturedAt,
    }));

  return {
    deviceId: collection.deviceId,
    product: collection.product,
    version: collection.version,
    collectedAt: collection.collectedAt,
    accessMethod: 'ui',
    licenses: [],
    policies: [],
    authSources: [{ id: 'local', name: 'Local', type: 'local', enabled: true }],
    network: {
      interfaces: [{ name: 'mgmt', ip: hostname, mask: '255.255.255.0', status: 'up' }],
      dns: [],
    },
    rawRefs,
  };
}

function buildCcOverviewMetrics(collection: DeviceCollection): Record<string, unknown> {
  const overview = findMenu(collection, 'dashboard', 'overview')
    ?? findMenu(collection, 'dashboard')
    ?? collection.menus[0];
  const labels = overview?.domSummary?.labels ?? [];
  const metrics = overview?.domSummary?.metrics ?? {};

  return {
    pendingRisks: metrics.pendingRisks ?? extractMetric(labels, /Pending Risks\s*(\d+)/i) ?? 0,
    pendingServers: metrics.pendingServers ?? extractMetric(labels, /Pending Servers[\s\S]*?(\d+)/i) ?? 0,
    pendingHosts: metrics.pendingHosts ?? extractMetric(labels, /Pending Hosts[\s\S]*?(\d+)/i) ?? 0,
    hotIncidents: metrics.hotIncidents ?? labels.filter((l) => /RAT|APT|Loader|Ransomware|Mine/i.test(l)).length,
    criticalThreats: metrics.hotIncidents ?? labels.filter((l) => /RAT|APT|Loader|Ransomware|Mine/i.test(l)).length,
    offlineSensors: 0,
    enabled: true,
    syncStatus: 'unknown',
    pageTitle: overview?.domSummary?.title ?? 'Cyber Command',
    url: overview?.url,
  };
}

function buildCcSnapshot(collection: DeviceCollection): DeviceSnapshot {
  const overviewData = buildCcOverviewMetrics(collection);
  const alarms: AlarmEntry[] = [];
  if (Number(overviewData.pendingRisks) > 0) {
    alarms.push({
      id: 'pending-risks',
      severity: Number(overviewData.pendingRisks) > 100 ? 'critical' : 'warning',
      message: `Pending Risks: ${overviewData.pendingRisks}`,
      triggeredAt: collection.collectedAt,
      resolved: false,
    });
  }

  const objects: DeviceObject[] = [];
  const riskyServerMatch = (findMenuById(collection, 'overview')?.domSummary?.labels ?? [])
    .join('\n')
    .match(/10\.80\.1\.\d+/g);
  if (riskyServerMatch) {
    for (const ip of [...new Set(riskyServerMatch)].slice(0, 10)) {
      objects.push({
        id: `host-${ip}`,
        name: ip,
        type: 'server',
        properties: { status: 'at-risk', source: 'overview-dom' },
      });
    }
  }

  return { ...baseSnapshot(collection), alarms, objects };
}

function buildCcHealthData(collection: DeviceCollection): Record<string, Record<string, unknown>> {
  const overviewData = buildCcOverviewMetrics(collection);
  return {
    cc_dashboard: {
      criticalThreats: overviewData.criticalThreats,
      pendingRisks: overviewData.pendingRisks,
      pendingServers: overviewData.pendingServers,
      pendingHosts: overviewData.pendingHosts,
    },
    cc_sensors: {
      offlineSensors: overviewData.offlineSensors,
      tableRows: findMenuById(collection, 'assets')?.domSummary?.gridRows ?? 0,
      pageLoaded: findMenuById(collection, 'assets')?.status === 'ok',
    },
    cc_event_collection: {
      enabled: findMenuById(collection, 'events')?.status === 'ok',
      sources: findMenuById(collection, 'events')?.domSummary?.gridRows ?? 0,
    },
    cc_ntp: {
      syncStatus: overviewData.syncStatus,
      systemPageLoaded: findMenuById(collection, 'system')?.status === 'ok',
    },
  };
}

function buildEppOverviewMetrics(collection: DeviceCollection): Record<string, unknown> {
  const dashboard = findMenuById(collection, 'dashboard') ?? collection.menus[0];
  const metrics = dashboard?.domSummary?.metrics ?? {};
  const labels = dashboard?.domSummary?.labels ?? [];

  return {
    criticalAlerts: metrics.criticalAlerts ?? extractMetric(labels, /Critical[\s\S]*?(\d+)/i) ?? 0,
    offlineAgents: metrics.offlineAgents ?? extractMetric(labels, /Offline[\s\S]*?(\d+)/i) ?? 0,
    enabled: dashboard?.status === 'ok',
    usbBlocked: findMenuById(collection, 'device_control')?.status === 'ok',
    pageTitle: dashboard?.domSummary?.title ?? 'Endpoint Secure',
  };
}

function buildEppSnapshot(collection: DeviceCollection): DeviceSnapshot {
  const overviewData = buildEppOverviewMetrics(collection);
  const alarms: AlarmEntry[] = [];
  if (Number(overviewData.criticalAlerts) > 0) {
    alarms.push({
      id: 'critical-alerts',
      severity: 'critical',
      message: `Critical alerts: ${overviewData.criticalAlerts}`,
      triggeredAt: collection.collectedAt,
      resolved: false,
    });
  }

  const agents = findMenuById(collection, 'agents');
  const objects: DeviceObject[] = [];
  if (agents?.domSummary?.gridRows) {
    objects.push({
      id: 'agent-summary',
      name: 'Endpoint Agents',
      type: 'agent-group',
      properties: {
        rows: agents.domSummary.gridRows,
        offlineAgents: Number(overviewData.offlineAgents ?? 0),
      },
    });
  }

  return { ...baseSnapshot(collection), alarms, objects };
}

function buildEppHealthData(collection: DeviceCollection): Record<string, Record<string, unknown>> {
  const overviewData = buildEppOverviewMetrics(collection);
  return {
    epp_dashboard: { criticalAlerts: overviewData.criticalAlerts },
    epp_agents: {
      offlineAgents: overviewData.offlineAgents,
      rows: findMenuById(collection, 'agents')?.domSummary?.gridRows ?? 0,
    },
    epp_malware_policy: {
      enabled: findMenuById(collection, 'malware_policy')?.status === 'ok',
    },
    epp_device_control: {
      usbBlocked: overviewData.usbBlocked,
    },
    epp_syslog: {
      enabled: findMenuById(collection, 'syslog')?.status === 'ok',
    },
  };
}

function buildIagOverviewMetrics(collection: DeviceCollection): Record<string, unknown> {
  const probe = collection.menus.find((m) => m.status === 'ok' && m.id === 'dashboard')
    ?? collection.menus.find((m) => m.status === 'ok')
    ?? collection.menus[0];
  const metrics = probe?.domSummary?.metrics ?? {};
  const labels = probe?.domSummary?.labels ?? [];

  return {
    criticalEvents: metrics.criticalAlerts ?? extractMetric(labels, /Critical[\s\S]*?(\d+)/i) ?? 0,
    enabled: probe?.status === 'ok',
    pageTitle: probe?.domSummary?.title ?? 'Internet Access Gateway',
  };
}

function buildIagSnapshot(collection: DeviceCollection): DeviceSnapshot {
  return { ...baseSnapshot(collection), alarms: [], objects: [] };
}

function buildIagHealthData(collection: DeviceCollection): Record<string, Record<string, unknown>> {
  const overviewData = buildIagOverviewMetrics(collection);
  const okPath = (...parts: string[]) =>
    collection.menus.some((m) => m.status === 'ok' && parts.every((p, i) => m.menuPath[i]?.includes(p)));

  return {
    iag_dashboard: { criticalEvents: overviewData.criticalEvents },
    iag_url_filter: {
      enabled: okPath('Access Mgt') || okPath('Online Activities'),
    },
    iag_dlp: {
      enabled: okPath('Activity Audit'),
    },
    iag_ssl_inspection: {
      enabled: okPath('Access Mgt') || okPath('Online Activities'),
    },
  };
}

export function buildDeviceSnapshotFromCollection(collection: DeviceCollection): DeviceSnapshot {
  switch (collection.product) {
    case 'CC':
      return buildCcSnapshot(collection);
    case 'EPP':
      return buildEppSnapshot(collection);
    case 'IAG':
      return buildIagSnapshot(collection);
  }
}

export function buildHealthCheckFromCollection(collection: DeviceCollection): HealthCheckResult {
  switch (collection.product) {
    case 'CC':
      return evaluateConditions(CC_CHECK_ITEMS, buildCcHealthData(collection), collection);
    case 'EPP':
      return evaluateConditions(EPP_CHECK_ITEMS, buildEppHealthData(collection), collection);
    case 'IAG':
      return evaluateConditions(IAG_CHECK_ITEMS, buildIagHealthData(collection), collection);
  }
}

export function saveDeviceCollection(collection: DeviceCollection, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const path = join(
    outputDir,
    `${collection.product}_collection_${collection.collectedAt.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(path, JSON.stringify(collection, null, 2));
  return path;
}

/** @deprecated saveDeviceCollection 사용 */
export function saveCcDeviceCollection(collection: DeviceCollection, outputDir: string): string {
  return saveDeviceCollection(collection, outputDir);
}
