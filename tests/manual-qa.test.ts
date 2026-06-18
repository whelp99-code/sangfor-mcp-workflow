import { describe, it, expect } from 'vitest';
import { ManualQASystem } from '@sangfor/workflow-engine';

describe('ManualQASystem builtin fallback', () => {
  it('answers EPP USB policy from builtin knowledge when RAG is empty', async () => {
    const qa = new ManualQASystem(async () => []);
    const answer = await qa.askQuestion({
      question: 'EPP USB policy?',
      product: 'EPP',
    });

    expect(answer.confidence).toBeGreaterThan(0.8);
    expect(answer.answer).toContain('USB Device Control');
    expect(answer.sources[0]?.document).toBe('Sangfor EPP Admin Guide');
  });
});

describe('ComplianceTracker persistence', () => {
  it('creates data directory on first save', async () => {
    const { mkdtempSync, rmSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'compliance-test-'));
    const dataPath = join(dir, 'nested', 'records.json');

    const { ComplianceTracker } = await import('@sangfor/workflow-engine');
    const tracker = new ComplianceTracker(dataPath);
    tracker.saveRecord({
      id: 'rec-1',
      date: '2026-06-18',
      customer: 'TestCo',
      product: 'ALL',
      compliance: 70,
      totalItems: 10,
      passedItems: 7,
      partiallyPassed: 0,
      failedItems: 3,
      items: [],
      metadata: {},
    });

    expect(existsSync(dataPath)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
