/**
 * Obsidian 동기화 — 피드백 → 교훈 → Obsidian 노트 자동 생성
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { nowId, nowISO, createLogger, type Logger } from '@sangfor/workflow-shared';
import type { WikiUpdateProposal, ObsidianNote } from '@sangfor/workflow-core';

const log = createLogger('obsidian-sync');

// ─── Obsidian 노트 파싱 ─────────────────────────────────────────────────────

export function parseObsidianNote(filePath: string): ObsidianNote {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let frontmatter: Record<string, any> = {};
  let bodyStartIndex = 0;

  // Frontmatter 파싱 (--- 사이)
  if (lines[0] === '---') {
    const endIndex = lines.indexOf('---', 1);
    if (endIndex > 0) {
      const frontmatterLines = lines.slice(1, endIndex);
      frontmatter = parseFrontmatter(frontmatterLines);
      bodyStartIndex = endIndex + 1;
    }
  }

  // Body 파싱
  const body = lines.slice(bodyStartIndex).join('\n').trim();

  // 태그 추출 (frontmatter + body)
  const frontmatterTags = frontmatter.tags || [];
  const bodyTags = extractTags(body);
  const tags = [...new Set([...frontmatterTags, ...bodyTags])];

  // 링크 추출
  const links = extractLinks(content);

  // 제목 추출 (frontmatter에서 또는 첫 번째 # 헤딩에서)
  const title =
    frontmatter.title ||
    lines.find((l) => l.startsWith('# '))?.substring(2) ||
    basename(filePath, '.md');

  return {
    title,
    frontmatter,
    body,
    tags,
    links,
    filePath,
  };
}

function parseFrontmatter(lines: string[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // 배열 파싱 [tag1, tag2]
      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/"/g, ''));
      } else {
        result[key] = value.replace(/"/g, '');
      }
    }
  }

  return result;
}

function extractTags(content: string): string[] {
  const tagRegex = /#([a-zA-Z0-9_]+)/g;
  const tags: string[] = [];
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1]);
  }

  return [...new Set(tags)];
}

function extractLinks(content: string): string[] {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return [...new Set(links)];
}

// ─── Obsidian 노트 생성 ─────────────────────────────────────────────────────

export function createObsidianNote(
  vaultPath: string,
  title: string,
  content: string,
  tags: string[] = [],
  frontmatter: Record<string, any> = {}
): string {
  const filePath = join(vaultPath, `${title}.md`);

  // 디렉토리 생성
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Frontmatter 생성
  const frontmatterLines = [
    '---',
    `title: "${title}"`,
    `created: "${nowISO()}"`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    ...Object.entries(frontmatter).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `"${v}"`).join(', ')}]`;
      }
      return `${key}: "${value}"`;
    }),
    '---',
  ];

  // 전체 내용
  const fullContent = [...frontmatterLines, '', content].join('\n');

  writeFileSync(filePath, fullContent);
  log.info(`Created Obsidian note: ${filePath}`);

  return filePath;
}

// ─── Obsidian 노트 업데이트 ─────────────────────────────────────────────────

export function updateObsidianNote(
  filePath: string,
  updates: {
    title?: string;
    body?: string;
    tags?: string[];
    frontmatter?: Record<string, any>;
  }
): void {
  const note = parseObsidianNote(filePath);

  // Frontmatter 업데이트
  if (updates.frontmatter) {
    note.frontmatter = { ...note.frontmatter, ...updates.frontmatter };
  }

  // 태그 업데이트
  if (updates.tags) {
    note.tags = [...new Set([...note.tags, ...updates.tags])];
    note.frontmatter.tags = note.tags;
  }

  // Body 업데이트
  if (updates.body) {
    note.body = updates.body;
  }

  // 제목 업데이트
  if (updates.title) {
    note.title = updates.title;
    note.frontmatter.title = updates.title;
  }

  // Frontmatter 문자열 생성
  const frontmatterLines = [
    '---',
    ...Object.entries(note.frontmatter).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `"${v}"`).join(', ')}]`;
      }
      return `${key}: "${value}"`;
    }),
    '---',
  ];

  // 전체 내용
  const fullContent = [...frontmatterLines, '', note.body].join('\n');

  writeFileSync(filePath, fullContent);
  log.info(`Updated Obsidian note: ${filePath}`);
}

// ─── 교훈 노트 생성 ─────────────────────────────────────────────────────────

export function createLessonNote(
  vaultPath: string,
  lesson: {
    title: string;
    product: string;
    severity: string;
    background: string;
    lessonText: string;
    application: string;
    feedbackId?: string;
  }
): string {
  const tags = ['lesson', lesson.product.toLowerCase(), lesson.severity];
  const frontmatter: Record<string, any> = {
    product: lesson.product,
    severity: lesson.severity,
    feedbackId: lesson.feedbackId || '',
  };

  const content = `# ${lesson.title}

## 배경
${lesson.background}

## 교훈
${lesson.lessonText}

## 적용 방안
${lesson.application}

${lesson.feedbackId ? `## 관련 피드백\n피드백 ID: ${lesson.feedbackId}` : ''}
`;

  return createObsidianNote(vaultPath, lesson.title, content, tags, frontmatter);
}

// ─── 위키 업데이트 적용 ─────────────────────────────────────────────────────

export function applyWikiUpdateToObsidian(
  vaultPath: string,
  proposal: WikiUpdateProposal
): { success: boolean; filePath?: string; error?: string } {
  try {
    // 기존 노트가 있는지 확인
    const existingNotePath = findNoteByTitle(vaultPath, proposal.lessonTitle);

    if (existingNotePath) {
      // 기존 노트 업데이트
      updateObsidianNote(existingNotePath, {
        body: proposal.lessonBody,
        frontmatter: {
          lastUpdated: nowISO(),
          proposalId: proposal.id,
        },
      });
      return { success: true, filePath: existingNotePath };
    } else {
      // 새 노트 생성
      const filePath = createObsidianNote(vaultPath, proposal.lessonTitle, proposal.lessonBody, [
        'lesson',
        'auto-generated',
      ], {
        proposalId: proposal.id,
        source: 'auto-wiki-pipeline',
      });
      return { success: true, filePath };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── 유틸리티 ───────────────────────────────────────────────────────────────

function findNoteByTitle(vaultPath: string, title: string): string | null {
  if (!existsSync(vaultPath)) {
    return null;
  }

  const files = readdirSync(vaultPath).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const filePath = join(vaultPath, file);
    const note = parseObsidianNote(filePath);

    if (note.title === title || file === `${title}.md`) {
      return filePath;
    }
  }

  return null;
}

export function listObsidianNotes(vaultPath: string): ObsidianNote[] {
  if (!existsSync(vaultPath)) {
    return [];
  }

  const files = readdirSync(vaultPath).filter((f) => f.endsWith('.md'));

  return files.map((file) => {
    const filePath = join(vaultPath, file);
    return parseObsidianNote(filePath);
  });
}

export function searchObsidianNotes(
  vaultPath: string,
  query: string
): ObsidianNote[] {
  const notes = listObsidianNotes(vaultPath);
  const lowerQuery = query.toLowerCase();

  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.body.toLowerCase().includes(lowerQuery) ||
      note.tags.some((t) => t.toLowerCase().includes(lowerQuery))
  );
}
