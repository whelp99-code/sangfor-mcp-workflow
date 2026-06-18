import { nowId, nowISO } from '@sangfor/workflow-shared';
import type { ComplianceAnalysis, ComplianceRecord } from '@sangfor/workflow-engine';
import type { ParseResult } from '@sangfor/workflow-engine';

function normalizeResult(result: number | string): number {
  if (result === 1 || result === 'O' || result === 'o' || result === 'Y') return 1;
  if (result === 0.5 || result === '△' || result === 'P') return 0.5;
  return 0;
}

export function buildComplianceAnalysis(
  customer: string,
  parseResult: ParseResult,
  product = 'ALL',
): ComplianceAnalysis {
  const items = parseResult.rows.map((row, index) => ({
    id: `item-${index}`,
    category: String(row.category ?? ''),
    solution: String(row.solution ?? ''),
    item: String(row.item ?? ''),
    result: normalizeResult(row.result),
    improved: false,
  }));

  const passedItems = items.filter((item) => item.result === 1).length;
  const partiallyPassed = items.filter((item) => item.result === 0.5).length;
  const failedItems = items.filter((item) => item.result < 1).length;

  return {
    customer,
    product,
    date: nowISO(),
    totalItems: items.length,
    passedItems,
    partiallyPassed,
    failedItems,
    currentCompliance: parseResult.compliance,
    potentialCompliance: 100,
    improvementOpportunity: Math.max(0, 100 - parseResult.compliance),
    items,
  };
}

export function buildComplianceRecord(
  customer: string,
  analysis: ComplianceAnalysis,
  filePath?: string,
): ComplianceRecord {
  return {
    id: nowId('compliance'),
    date: analysis.date,
    customer,
    product: analysis.product,
    compliance: analysis.currentCompliance,
    totalItems: analysis.totalItems,
    passedItems: analysis.passedItems,
    partiallyPassed: analysis.partiallyPassed,
    failedItems: analysis.failedItems,
    items: analysis.items,
    filePath,
    metadata: {},
  };
}
