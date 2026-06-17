#!/usr/bin/env tsx
/**
 * Sangfor 실장비 학습 파이프라인 (EPP / IAG / CC)
 *
 * 1) 로그인 + 메뉴별 스크린샷/DOM 수집
 * 2) 구조화 DeviceSnapshot + HealthCheck 결과 생성
 * 3) Obsidian wiki 동기화
 *
 * 사용법:
 *   pnpm run device:learn -- --product CC --target https://10.80.1.107
 *   pnpm run device:learn -- --product EPP
 *   pnpm run device:learn -- --product IAG --method menu   # 기본: 메뉴 클릭 (sangfor-screenshot)
 *   pnpm run device:learn -- --product EPP --method hash     # hash 라우트 직접 이동
 *   pnpm run device:learn -- --from-collection outputs/device-learn/CC_collection_*.json
 */

import 'dotenv/config';

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDeviceSnapshotFromCollection,
  buildHealthCheckFromCollection,
  saveDeviceCollection,
  PRODUCT_COLLECTION_CONFIGS,
  type DeviceCollection,
  type SangforProduct,
} from '@sangfor/health-checker';
import { syncDeviceInventory } from '@sangfor/wiki-sync';
import { openSangforBrowser } from './lib/sangfor-browser.js';
import { loginSangforConsole } from './lib/sangfor-console-login.js';
import { collectDeviceForLearn, type CaptureMethod } from './lib/device-learn-collector.js';

const DEFAULT_VAULT = join(process.env.HOME ?? '', 'Documents', 'Obsidian Vault');

const CREDENTIAL_ENV: Record<SangforProduct, { user: string; pass: string }> = {
  EPP: { user: 'EPP_USERNAME', pass: 'EPP_PASSWORD' },
  IAG: { user: 'IAG_USERNAME', pass: 'IAG_PASSWORD' },
  CC: { user: 'CC_USERNAME', pass: 'CC_PASSWORD' },
};

function readArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function parseProduct(): SangforProduct {
  const raw = (readArg('--product') ?? process.env.SANGFOR_PRODUCT ?? 'CC').toUpperCase();
  if (raw !== 'EPP' && raw !== 'IAG' && raw !== 'CC') {
    throw new Error(`--product는 EPP, IAG, CC 중 하나여야 합니다: ${raw}`);
  }
  return raw;
}

function parseCaptureMethod(): CaptureMethod {
  const raw = (readArg('--method') ?? process.env.DEVICE_CAPTURE_METHOD ?? 'menu').toLowerCase();
  if (raw !== 'menu' && raw !== 'hash') {
    throw new Error('--method는 menu 또는 hash 여야 합니다.');
  }
  return raw;
}

function loadCollection(path: string): DeviceCollection {
  return JSON.parse(readFileSync(path, 'utf-8')) as DeviceCollection;
}

function credentials(product: SangforProduct): { username: string; password: string } {
  const envKeys = CREDENTIAL_ENV[product];
  const username = process.env[envKeys.user] ?? 'admin';
  const password = process.env[envKeys.pass] ?? '';
  if (!password) {
    throw new Error(`${envKeys.pass}가 .env에 설정되어야 합니다.`);
  }
  return { username, password };
}

async function finalizeFromCollection(
  collection: DeviceCollection,
  outputDir: string,
  vaultPath: string,
  login?: Record<string, unknown>,
) {
  const collectionPath = saveDeviceCollection(collection, outputDir);
  const okCount = collection.menus.filter((m) => m.status === 'ok').length;

  console.log('\n구조화 snapshot + health-check...');
  const deviceSnapshot = buildDeviceSnapshotFromCollection(collection);
  const healthResult = buildHealthCheckFromCollection(collection);

  const snapshotPath = join(outputDir, `device_snapshot_${collection.collectedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(snapshotPath, JSON.stringify(deviceSnapshot, null, 2));

  const healthDir = join(outputDir, 'health-checks');
  mkdirSync(healthDir, { recursive: true });
  const healthPath = join(healthDir, `health_${collection.collectedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(healthPath, JSON.stringify(healthResult, null, 2));

  console.log(`  ✓ DeviceSnapshot: ${snapshotPath}`);
  console.log(`  ✓ HealthCheck: ${healthResult.summary.passed}/${healthResult.summary.total} 통과`);

  console.log('\nObsidian wiki 동기화...');
  let notePath: string | undefined;
  if (!existsSync(vaultPath)) {
    console.log(`  ⚠️  Vault 없음 — wiki 동기화 스킵: ${vaultPath}`);
  } else {
    notePath = syncDeviceInventory({ vaultPath, collection, deviceSnapshot, healthResult });
    console.log(`  ✓ Obsidian 노트: ${notePath}`);
  }

  const reportPath = join(outputDir, 'learn-report.json');
  writeFileSync(reportPath, JSON.stringify({
    product: collection.product,
    targetUrl: collection.targetUrl,
    version: collection.version,
    login,
    menusCollected: okCount,
    menusTotal: collection.menus.length,
    healthSummary: healthResult.summary,
    paths: { collection: collectionPath, deviceSnapshot: snapshotPath, healthCheck: healthPath, notePath },
    finishedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`\n✅ ${collection.product} 학습 완료 — ${reportPath}\n`);
}

async function main() {
  const product = parseProduct();
  const config = PRODUCT_COLLECTION_CONFIGS[product];
  const targetUrl = readArg('--target') ?? process.env[`${product}_TARGET_URL`] ?? config.defaultTarget;
  const vaultPath = readArg('--vault') ?? process.env.OBSIDIAN_VAULT ?? DEFAULT_VAULT;
  const outputDir = readArg('--output') ?? join(process.cwd(), 'outputs', 'device-learn', product);
  const fromCollection = readArg('--from-collection');

  mkdirSync(outputDir, { recursive: true });

  if (fromCollection) {
    console.log('\n📂 기존 수집 데이터로 snapshot/wiki 처리...');
    return finalizeFromCollection(loadCollection(fromCollection), outputDir, vaultPath);
  }

  const { username, password } = credentials(product);

  const captureMethod = parseCaptureMethod();

  console.log(`\n🔍 ${product} 실장비 학습 시작`);
  console.log(`  Target: ${targetUrl}`);
  console.log(`  Method: ${captureMethod}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Vault:  ${vaultPath}\n`);

  const useHeaded = product === 'CC' || product === 'EPP' || product === 'IAG' || readArg('--headed') !== undefined;
  const browserSession = await openSangforBrowser({
    product,
    headless: !useHeaded,
    targetHost: new URL(targetUrl).hostname,
  });
  const page = browserSession.page;

  try {
    console.log('1/4 로그인...');
    const login = await loginSangforConsole(page, {
      product,
      targetUrl,
      username,
      password,
    });
    if (!login.loggedIn) {
      throw new Error(login.error ?? `${product} 로그인 실패`);
    }
    console.log(`  ✓ 로그인 성공: ${login.url}`);

    console.log('\n2/4 메뉴별 스크린샷/DOM 수집...');
    const collection = await collectDeviceForLearn({
      product,
      targetUrl,
      outputDir,
      page,
      method: captureMethod,
    });
    const okCount = collection.menus.filter((m) => m.status === 'ok').length;
    if (okCount === 0) {
      throw new Error(`${product} 메뉴 수집 실패 — 성공한 메뉴가 없습니다.`);
    }
    await finalizeFromCollection(collection, outputDir, vaultPath, login);
  } finally {
    await browserSession.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('\n❌ 학습 실패:', err);
  process.exit(1);
});
