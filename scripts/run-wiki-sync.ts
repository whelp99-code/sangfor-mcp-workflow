#!/usr/bin/env tsx
/**
 * Obsidian 동기화 실행 스크립트
 *
 * 사용법:
 *   pnpm run wiki:sync -- --vault ~/Documents/Obsidian\ Vault/
 *   pnpm run wiki:sync -- --vault ~/Documents/Obsidian\ Vault/ --auto-approve
 */

import { runAutoWikiPipeline } from '@sangfor/wiki-sync';
import { existsSync } from 'node:fs';

async function main() {
  const args = process.argv.slice(2);

  const vaultIndex = args.indexOf('--vault');
  const autoApproveIndex = args.indexOf('--auto-approve');
  const githubIndex = args.indexOf('--github');

  if (vaultIndex === -1) {
    console.error('사용법: pnpm run wiki:sync -- --vault <path> [--auto-approve] [--github <repo-url>]');
    process.exit(1);
  }

  const vaultPath = args[vaultIndex + 1];
  const autoApprove = autoApproveIndex !== -1;
  const githubWikiRepo = githubIndex !== -1 ? args[githubIndex + 1] : undefined;

  // Obsidian vault 확인
  if (!existsSync(vaultPath)) {
    console.error(`❌ Obsidian vault를 찾을 수 없습니다: ${vaultPath}`);
    process.exit(1);
  }

  console.log(`\n📚 Obsidian 동기화 시작`);
  console.log(`  Vault: ${vaultPath}`);
  console.log(`  자동 승인: ${autoApprove ? '예' : '아니오'}`);
  console.log(`  GitHub Wiki: ${githubWikiRepo || '미설정'}\n`);

  try {
    const result = await runAutoWikiPipeline({
      obsidianVaultPath: vaultPath,
      githubWikiRepo,
      autoApprove,
      notifyOnProposal: true,
      batchSize: 10,
    });

    console.log('\n✅ 동기화 완료');
    console.log(`  파이프라인 ID: ${result.pipelineId}`);
    console.log(`  처리된 피드백: ${result.feedbackProcessed}개`);
    console.log(`  추출된 교훈: ${result.lessonsExtracted}개`);
    console.log(`  생성된 제안: ${result.proposalsCreated}개`);
    console.log(`  승인된 제안: ${result.proposalsApproved}개`);
    console.log(`  적용된 업데이트: ${result.wikiUpdatesApplied}개`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  에러:');
      result.errors.forEach((err) => console.log(`  - ${err.feedbackId}: ${err.error}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 동기화 실패:', error);
    process.exit(1);
  }
}

main();
