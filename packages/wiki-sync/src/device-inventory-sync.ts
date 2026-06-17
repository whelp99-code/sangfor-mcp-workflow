/**
 * 실장비 DeviceSnapshot → Obsidian 인벤토리 노트 동기화
 */

import { join } from 'node:path';
import { createObsidianNote } from './obsidian-sync.js';
import type { DeviceSnapshot } from '@sangfor/workflow-engine';
import type { HealthCheckResult } from '@sangfor/workflow-core';
import type { DeviceCollection, SangforProduct } from '@sangfor/health-checker';

export interface DeviceInventorySyncOptions {
  vaultPath: string;
  collection: DeviceCollection;
  deviceSnapshot: DeviceSnapshot;
  healthResult: HealthCheckResult;
}

const PRODUCT_META: Record<SangforProduct, { label: string; folder: string; tags: string[] }> = {
  CC: {
    label: 'Cyber Command',
    folder: 'Cyber-Command',
    tags: ['sangfor', 'cyber-command', 'device-inventory', 'auto-collected'],
  },
  EPP: {
    label: 'Endpoint Secure',
    folder: 'EPP',
    tags: ['sangfor', 'epp', 'device-inventory', 'auto-collected'],
  },
  IAG: {
    label: 'Internet Access Gateway',
    folder: 'IAG',
    tags: ['sangfor', 'iag', 'device-inventory', 'auto-collected'],
  },
};

function menuSection(collection: DeviceCollection): string {
  const lines = ['## 메뉴별 수집', ''];
  for (const menu of collection.menus) {
    const icon = menu.status === 'ok' ? '✅' : '❌';
    lines.push(`### ${icon} ${menu.name}`);
    lines.push(`- 경로: ${menu.menuPath.join(' > ')}`);
    lines.push(`- URL: ${menu.url}`);
    if (menu.screenshotPath) {
      lines.push(`- 스크린샷: \`${menu.screenshotPath}\``);
    }
    if (menu.domSummary) {
      lines.push(`- 패널: ${menu.domSummary.panels}, 테이블/그리드: ${menu.domSummary.tables}/${menu.domSummary.gridRows}`);
      if (Object.keys(menu.domSummary.metrics).length > 0) {
        lines.push(`- 메트릭: ${JSON.stringify(menu.domSummary.metrics)}`);
      }
    }
    if (menu.error) {
      lines.push(`- 오류: ${menu.error}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function healthSection(result: HealthCheckResult): string {
  const lines = [
    '## Health Check',
    '',
    `| 항목 | 상태 |`,
    `|------|------|`,
  ];
  for (const item of result.items) {
    lines.push(`| ${item.name} | ${item.status} |`);
  }
  lines.push('');
  if (result.alerts.length > 0) {
    lines.push('### 알림');
    for (const alert of result.alerts) {
      lines.push(`- **${alert.severity}**: ${alert.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function snapshotSection(snapshot: DeviceSnapshot): string {
  return [
    '## 구조화 Snapshot',
    '',
    `- deviceId: \`${snapshot.deviceId}\``,
    `- version: ${snapshot.version}`,
    `- collectedAt: ${snapshot.collectedAt}`,
    `- objects: ${snapshot.objects.length}`,
    `- alarms: ${snapshot.alarms.length}`,
    `- rawRefs: ${snapshot.rawRefs.length}`,
    '',
  ].join('\n');
}

/**
 * 실장비 인벤토리 노트를 Obsidian vault에 생성/갱신
 */
export function syncDeviceInventory(options: DeviceInventorySyncOptions): string {
  const host = new URL(options.collection.targetUrl).hostname;
  const meta = PRODUCT_META[options.collection.product];
  const title = `${options.collection.product}-${host}-inventory`;
  const noteDir = join(options.vaultPath, 'Sangfor', meta.folder);

  const content = [
    `# ${meta.label} — ${host}`,
    '',
    `> 자동 수집: ${options.collection.collectedAt}`,
    '',
    snapshotSection(options.deviceSnapshot),
    healthSection(options.healthResult),
    menuSection(options.collection),
    '## 태그',
    '',
    meta.tags.map((t) => `#${t}`).join(' '),
  ].join('\n');

  return createObsidianNote(
    noteDir,
    title,
    content,
    meta.tags,
    {
      product: options.collection.product,
      target: host,
      version: options.collection.version,
      deviceId: options.deviceSnapshot.deviceId,
      checkId: options.healthResult.checkId,
    },
  );
}

/** @deprecated syncDeviceInventory 사용 */
export function syncCcDeviceInventory(options: DeviceInventorySyncOptions): string {
  return syncDeviceInventory(options);
}
