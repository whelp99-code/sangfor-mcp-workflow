#!/usr/bin/env tsx
/**
 * 프로젝트 파이프라인 실행 스크립트
 *
 * 사용법:
 *   pnpm run pipeline:run -- --excel ./path/to/checklist.xlsx --customer "고객사명"
 */

import { runProjectPipeline } from '@sangfor/workflow-core';
import { join } from 'node:path';

async function main() {
  const args = process.argv.slice(2);

  // 인자 파싱
  const excelIndex = args.indexOf('--excel');
  const customerIndex = args.indexOf('--customer');
  const outputIndex = args.indexOf('--output');
  const dryRunIndex = args.indexOf('--dry-run');

  if (excelIndex === -1 || customerIndex === -1) {
    console.error('사용법: pnpm run pipeline:run -- --excel <path> --customer <name>');
    process.exit(1);
  }

  const excelFilePath = args[excelIndex + 1];
  const customerName = args[customerIndex + 1];
  const outputDir = outputIndex !== -1 ? args[outputIndex + 1] : join(process.cwd(), 'outputs', customerName);
  const dryRun = dryRunIndex !== -1;

  console.log(`\n🚀 프로젝트 파이프라인 시작`);
  console.log(`  고객사: ${customerName}`);
  console.log(`  Excel: ${excelFilePath}`);
  console.log(`  출력: ${outputDir}`);
  console.log(`  드라이런: ${dryRun}\n`);

  try {
    const result = await runProjectPipeline({
      customerName,
      excelFilePath,
      outputDir,
      dryRun,
      captureScreenshots: !dryRun,
    });

    console.log('\n✅ 파이프라인 완료');
    console.log(`  파이프라인 ID: ${result.pipelineId}`);
    console.log(`  실행 시간: ${result.startedAt} → ${result.completedAt}`);
    console.log(`  에러: ${result.errors.length}개`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  에러 목록:');
      result.errors.forEach((err) => console.log(`  - ${err}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 파이프라인 실패:', error);
    process.exit(1);
  }
}

main();
