#!/usr/bin/env tsx
/**
 * CC (Cyber Command) 실장비 학습 파이프라인
 *
 * 1) 로그인 + 메뉴별 스크린샷/DOM 수집
 * 2) 구조화 DeviceSnapshot + HealthCheck 결과 생성
 * 3) Obsidian wiki 동기화
 *
 * 사용법:
 *   pnpm run cc:learn -- --target https://10.80.1.107
 *   pnpm run cc:learn -- --from-collection outputs/cc-device-learn/CC_collection_*.json
 */

import 'dotenv/config';

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDeviceSnapshotFromCollection,
  buildHealthCheckFromCollection,
  saveCcDeviceCollection,
  saveHealthCheckSnapshot,
  type CcDeviceCollection,
} from '@sangfor/health-checker';
import { syncCcDeviceInventory } from '@sangfor/wiki-sync';
import { openSangforBrowser } from './lib/sangfor-browser.js';
import { loginSangforConsole } from './lib/sangfor-console-login.js';
import { captureDeviceMenus } from './lib/device-menu-capture.js';

const DEFAULT_TARGET = 'https://10.80.1.107';
const DEFAULT_VAULT = join(process.env.HOME ?? '', 'Documents', 'Obsidian Vault');

function readArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function loadCollection(path: string): CcDeviceCollection {
  return JSON.parse(readFileSync(path, 'utf-8')) as CcDeviceCollection;
}

async function finalizeFromCollection(
  collection: CcDeviceCollection,
  outputDir: string,
  vaultPath: string,
  login?: Record<string, unknown>,
) {
  const collectionPath = saveCcDeviceCollection(collection, outputDir);
  const okCount = collection.menus.filter((m) => m.status === 'ok').length;

  console.log('\n구조화 snapshot + health-check...');
  const deviceSnapshot = buildDeviceSnapshotFromCollection(collection);
  const healthResult = buildHealthCheckFromCollection(collection);

  const snapshotPath = join(outputDir, `device_snapshot_${collection.collectedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(snapshotPath, JSON.stringify(deviceSnapshot, null, 2));

  const healthDir = join(outputDir, 'health-checks');
  const healthPath = saveHealthCheckSnapshot(healthResult, healthDir);

  console.log(`  ✓ DeviceSnapshot: ${snapshotPath}`);
  console.log(`  ✓ HealthCheck: ${healthResult.summary.passed}/${healthResult.summary.total} 통과`);

  console.log('\nObsidian wiki 동기화...');
  let notePath: string | undefined;
  if (!existsSync(vaultPath)) {
    console.log(`  ⚠️  Vault 없음 — wiki 동기화 스킵: ${vaultPath}`);
  } else {
    notePath = syncCcDeviceInventory({ vaultPath, collection, deviceSnapshot, healthResult });
    console.log(`  ✓ Obsidian 노트: ${notePath}`);
  }

  const reportPath = join(outputDir, 'learn-report.json');
  writeFileSync(reportPath, JSON.stringify({
    targetUrl: collection.targetUrl,
    version: collection.version,
    login,
    menusCollected: okCount,
    menusTotal: collection.menus.length,
    healthSummary: healthResult.summary,
    paths: { collection: collectionPath, deviceSnapshot: snapshotPath, healthCheck: healthPath, notePath },
    finishedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`\n✅ CC 학습 완료 — ${reportPath}\n`);
}

async function main() {
  const targetUrl = readArg('--target') ?? process.env.CC_TARGET_URL ?? DEFAULT_TARGET;
  const vaultPath = readArg('--vault') ?? process.env.OBSIDIAN_VAULT ?? DEFAULT_VAULT;
  const outputDir = readArg('--output') ?? join(process.cwd(), 'outputs', 'cc-device-learn');
  const fromCollection = readArg('--from-collection');

  mkdirSync(outputDir, { recursive: true });

  if (fromCollection) {
    console.log('\n📂 기존 수집 데이터로 snapshot/wiki 처리...');
    return finalizeFromCollection(loadCollection(fromCollection), outputDir, vaultPath);
  }

  const username = process.env.CC_USERNAME ?? 'admin';
  const password = process.env.CC_PASSWORD ?? '';
  if (!password) {
    throw new Error('CC_PASSWORD가 .env에 설정되어야 합니다.');
  }

  console.log('\n🔍 CC (Cyber Command) 실장비 학습 시작');
  console.log(`  Target: ${targetUrl}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Vault:  ${vaultPath}\n`);

  const browserSession = await openSangforBrowser({
    product: 'CC',
    headless: false,
    targetHost: new URL(targetUrl).hostname,
  });
  const page = browserSession.page;

  try {
    console.log('1/4 로그인...');
    const login = await loginSangforConsole(page, {
      product: 'CC',
      targetUrl,
      username,
      password,
    });
    if (!login.loggedIn) {
      throw new Error(login.error ?? 'CC 로그인 실패');
    }
    console.log(`  ✓ 로그인 성공: ${login.url}`);

    console.log('\n2/4 메뉴별 스크린샷/DOM 수집...');
    const collection = await captureDeviceMenus({
      product: 'CC',
      targetUrl,
      outputDir,
      page,
    });
    await finalizeFromCollection(collection, outputDir, vaultPath, login);
  } finally {
    await browserSession.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('\n❌ CC 학습 실패:', err);
  process.exit(1);
});
