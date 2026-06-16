/**
 * Obsidian 동기화 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseObsidianNote,
  createObsidianNote,
  updateObsidianNote,
  createLessonNote,
  listObsidianNotes,
  searchObsidianNotes,
} from '@sangfor/wiki-sync';

const TEST_VAULT = join(__dirname, '..', '.test-vault');

describe('Obsidian Sync', () => {
  beforeEach(() => {
    if (existsSync(TEST_VAULT)) {
      rmSync(TEST_VAULT, { recursive: true });
    }
    mkdirSync(TEST_VAULT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_VAULT)) {
      rmSync(TEST_VAULT, { recursive: true });
    }
  });

  it('should create an Obsidian note', () => {
    const filePath = createObsidianNote(
      TEST_VAULT,
      'Test Note',
      '# Test Note\n\nThis is a test note.',
      ['test', 'example'],
      { product: 'EPP' }
    );

    expect(existsSync(filePath)).toBe(true);

    const note = parseObsidianNote(filePath);
    expect(note.title).toBe('Test Note');
    expect(note.tags).toContain('test');
    expect(note.tags).toContain('example');
    expect(note.frontmatter.product).toBe('EPP');
  });

  it('should create a lesson note', () => {
    const filePath = createLessonNote(TEST_VAULT, {
      title: 'USB 정책 교훈',
      product: 'EPP',
      severity: 'high',
      background: 'USB 정책 적용 후 일부 에이전트에서 정책이 반영되지 않는 현상 발견',
      lessonText: '에이전트 재시작 후 정책이 적용됨을 확인',
      application: '정책 적용 시 에이전트 재시작 가이드 추가',
      feedbackId: 'fb_001',
    });

    expect(existsSync(filePath)).toBe(true);

    const note = parseObsidianNote(filePath);
    expect(note.title).toBe('USB 정책 교훈');
    expect(note.tags).toContain('lesson');
    expect(note.tags).toContain('epp');
    expect(note.tags).toContain('high');
    expect(note.frontmatter.product).toBe('EPP');
  });

  it('should list Obsidian notes', () => {
    createObsidianNote(TEST_VAULT, 'Note 1', 'Content 1', ['tag1']);
    createObsidianNote(TEST_VAULT, 'Note 2', 'Content 2', ['tag2']);
    createObsidianNote(TEST_VAULT, 'Note 3', 'Content 3', ['tag3']);

    const notes = listObsidianNotes(TEST_VAULT);
    expect(notes).toHaveLength(3);
  });

  it('should search Obsidian notes', () => {
    createObsidianNote(TEST_VAULT, 'EPP 정책', 'USB 정책 관련 내용', ['epp']);
    createObsidianNote(TEST_VAULT, 'IAG 설정', 'URL 필터링 설정', ['iag']);
    createObsidianNote(TEST_VAULT, 'EPP 에이전트', '에이전트 배포 가이드', ['epp']);

    const results = searchObsidianNotes(TEST_VAULT, 'EPP');
    expect(results).toHaveLength(2);
    expect(results[0].title).toContain('EPP');
  });

  it('should update an Obsidian note', () => {
    const filePath = createObsidianNote(
      TEST_VAULT,
      'Update Test',
      'Original content',
      ['original']
    );

    updateObsidianNote(filePath, {
      body: 'Updated content',
      tags: ['updated'],
      frontmatter: { status: 'updated' },
    });

    const note = parseObsidianNote(filePath);
    expect(note.body).toBe('Updated content');
    expect(note.tags).toContain('updated');
    expect(note.frontmatter.status).toBe('updated');
  });
});
