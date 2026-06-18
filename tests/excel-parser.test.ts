import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseExcelFile } from '@sangfor/workflow-engine';

const checklistPath = join(process.cwd(), 'test-data/checklist.xlsx');

describe('Excel parser', () => {
  it('parses sample checklist with Result filter', async () => {
    const result = await parseExcelFile(checklistPath);

    expect(result.rows.length).toBe(10);
    expect(result.totalItems).toBe(10);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products).toContain('ENDPOINT_SECURE');
    expect(result.products).toContain('IAG');
    expect(result.compliance).toBeGreaterThan(0);
    expect(result.compliance).toBeLessThanOrEqual(100);
  });

  it('maps solutions to products', async () => {
    const result = await parseExcelFile(checklistPath);
    const solutions = new Set(result.rows.map((row) => row.solution));

    expect(solutions.has('Anti-Virus')).toBe(true);
    expect(solutions.has('Data Loss Prevention')).toBe(true);
    expect(solutions.has('Log Management')).toBe(true);
  });
});
