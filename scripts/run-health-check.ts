#!/usr/bin/env tsx
/**
 * 실장비 점검 실행 스크립트
 *
 * 사용법:
 *   pnpm run health:check -- --product EPP --target https://10.80.1.106
 *   pnpm run health:check -- --product IAG
 *   pnpm run health:check -- --all
 */

import {
  runHealthCheck,
  createDefaultHealthCheckConfig,
  saveHealthCheckSnapshot,
  PRODUCT_URLS,
  PRODUCT_CREDENTIALS,
} from '@sangfor/health-checker';
import { join } from 'node:path';

async function main() {
  const args = process.argv.slice(2);

  const productIndex = args.indexOf('--product');
  const targetIndex = args.indexOf('--target');
  const outputIndex = args.indexOf('--output');
  const allIndex = args.indexOf('--all');

  const outputDir =
    outputIndex !== -1 ? args[outputIndex + 1] : join(process.cwd(), 'outputs', 'health-checks');

  // 전체 제품 점검
  if (allIndex !== -1) {
    console.log('\n🏥 전체 실장비 점검 시작\n');

    for (const product of ['EPP', 'IAG', 'CC'] as const) {
      await checkProduct(product, outputDir);
    }

    console.log('\n✅ 전체 점검 완료\n');
    process.exit(0);
  }

  // 특정 제품 점검
  if (productIndex === -1) {
    console.error('사용법: pnpm run health:check -- --product <EPP|IAG|CC> [--target <url>]');
    process.exit(1);
  }

  const product = args[productIndex + 1] as 'EPP' | 'IAG' | 'CC';
  await checkProduct(product, outputDir);

  console.log('\n✅ 점검 완료\n');
  process.exit(0);
}

async function checkProduct(product: 'EPP' | 'IAG' | 'CC', outputDir: string) {
  console.log(`\n📋 ${product} 점검 시작`);

  const config = createDefaultHealthCheckConfig(
    product,
    PRODUCT_URLS[product],
    PRODUCT_CREDENTIALS[product],
    outputDir
  );

  try {
    const result = await runHealthCheck(config);

    console.log(`  ✓ 점검 완료: ${result.summary.passed}/${result.summary.total} 통과`);
    console.log(`  ⚠️  경고: ${result.summary.warnings}개`);
    console.log(`  🚨 위험: ${result.summary.critical}개`);

    if (result.alerts.length > 0) {
      console.log('\n  알림:');
      result.alerts.forEach((alert) => {
        const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`    ${icon} ${alert.message}`);
      });
    }

    // 스냅샷 저장
    const snapshotPath = saveHealthCheckSnapshot(result, outputDir);
    console.log(`\n  📁 스냅샷 저장: ${snapshotPath}`);
  } catch (error) {
    console.error(`  ❌ ${product} 점검 실패:`, error);
  }
}

main();
