/**
 * GitHub Wiki 동기화 — Obsidian → GitHub Wiki 자동 반영
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowId, nowISO, createLogger, type Logger } from '@sangfor/workflow-shared';
import type { WikiUpdateProposal } from '@sangfor/workflow-core';

const log = createLogger('github-wiki-sync');

// ─── GitHub Wiki 동기화 ─────────────────────────────────────────────────────

export interface GitHubWikiConfig {
  repoUrl: string;
  localPath: string;
  branch?: string;
  commitMessage?: string;
}

export function cloneGitHubWiki(config: GitHubWikiConfig): string {
  const { repoUrl, localPath, branch = 'main' } = config;

  if (existsSync(localPath)) {
    log.info(`Wiki repo already exists: ${localPath}`);
    // Pull latest changes
    try {
      execFileSync('git', ['pull', 'origin', branch], {
        cwd: localPath,
        stdio: 'pipe',
      });
      log.info('Pulled latest changes');
    } catch (error) {
      log.warn(`Failed to pull: ${error}`);
    }
    return localPath;
  }

  // Clone repository
  mkdirSync(localPath, { recursive: true });
  execFileSync('git', ['clone', repoUrl, localPath], { stdio: 'pipe' });
  log.info(`Cloned wiki repo: ${repoUrl}`);

  return localPath;
}

export function applyWikiUpdateToGitHub(
  config: GitHubWikiConfig,
  proposal: WikiUpdateProposal
): { success: boolean; commitHash?: string; error?: string } {
  try {
    const { localPath, branch = 'main', commitMessage } = config;

    // Wiki 페이지 파일 경로
    const pageName = proposal.lessonTitle.replace(/\s+/g, '-');
    const filePath = join(localPath, `${pageName}.md`);

    // 기존 페이지 확인
    const existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

    // 새 내용 생성
    const newContent = generateWikiPageContent(proposal, existingContent);

    // 파일 작성
    writeFileSync(filePath, newContent);
    log.info(`Updated wiki page: ${pageName}`);

    // Git commit & push
    execFileSync('git', ['add', '.'], { cwd: localPath, stdio: 'pipe' });

    const message =
      commitMessage || `Update wiki: ${proposal.lessonTitle}\n\nProposal ID: ${proposal.id}`;
    execFileSync('git', ['commit', '-m', message], {
      cwd: localPath,
      stdio: 'pipe',
    });

    execFileSync('git', ['push', 'origin', branch], {
      cwd: localPath,
      stdio: 'pipe',
    });

    // Commit hash 가져오기
    const commitHash = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: localPath,
      stdio: 'pipe',
    })
      .toString()
      .trim();

    log.info(`Pushed to GitHub Wiki: ${commitHash}`);

    return { success: true, commitHash };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Wiki 페이지 내용 생성 ──────────────────────────────────────────────────

function generateWikiPageContent(
  proposal: WikiUpdateProposal,
  existingContent: string
): string {
  const sections = [
    `# ${proposal.lessonTitle}`,
    '',
    `> 자동 생성됨: ${nowISO()}`,
    `> Proposal ID: ${proposal.id}`,
    '',
    '## 교훈',
    proposal.lessonBody,
    '',
  ];

  // 기존 내용이 있으면 보존
  if (existingContent) {
    sections.push('## 기존 내용');
    sections.push(existingContent);
    sections.push('');
  }

  sections.push('---');
  sections.push('*이 페이지는 자동으로 생성되었습니다.*');

  return sections.join('\n');
}

// ─── Wiki 페이지 목록 조회 ──────────────────────────────────────────────────

export function listGitHubWikiPages(config: GitHubWikiConfig): string[] {
  const { localPath } = config;

  if (!existsSync(localPath)) {
    return [];
  }

  const { readdirSync } = require('node:fs');
  return readdirSync(localPath)
    .filter((f: string) => f.endsWith('.md'))
    .map((f: string) => f.replace('.md', ''));
}

// ─── Wiki 페이지 검색 ──────────────────────────────────────────────────────

export function searchGitHubWikiPages(
  config: GitHubWikiConfig,
  query: string
): Array<{ name: string; content: string; matches: string[] }> {
  const pages = listGitHubWikiPages(config);
  const results: Array<{ name: string; content: string; matches: string[] }> = [];
  const lowerQuery = query.toLowerCase();

  for (const page of pages) {
    const filePath = join(config.localPath, `${page}.md`);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const matches = lines.filter((line) => line.toLowerCase().includes(lowerQuery));

    if (matches.length > 0) {
      results.push({ name: page, content, matches });
    }
  }

  return results;
}

// ─── 동기화 상태 관리 ────────────────────────────────────────────────────────

export interface SyncState {
  lastSyncAt: string;
  lastCommitHash: string;
  syncedPages: number;
  errors: string[];
}

export function getSyncState(config: GitHubWikiConfig): SyncState | null {
  const statePath = join(config.localPath, '.sync-state.json');

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function saveSyncState(config: GitHubWikiConfig, state: SyncState): void {
  const statePath = join(config.localPath, '.sync-state.json');
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}
