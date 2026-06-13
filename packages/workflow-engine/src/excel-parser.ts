/**
 * Excel Parser — ITAC Excel 체크리스트 파싱
 *
 * Result 컬럼이 있는 항목만 추출 (실제 감사에서 지적된 항목)
 */

import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('excel-parser');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ExcelRow {
  no: number;
  category: string;
  solution: string;
  item: string;
  detail: string;
  result: number | string;
  internet: string;
  office: string;
  production: string;
  server: string;
  reason: string;
}

export interface ParseResult {
  rows: ExcelRow[];
  products: string[];
  byProduct: Record<string, ExcelRow[]>;
  compliance: number;
  totalItems: number;
  passedItems: number;
}

// ─── Solution → 제품 매핑 ──────────────────────────────────────────────────

const SOLUTION_TO_PRODUCT: Record<string, string> = {
  'Anti-Spam': 'IAG',
  'Anti-Virus': 'ENDPOINT_SECURE',
  'Software Control': 'ENDPOINT_SECURE',
  'Device Control': 'ENDPOINT_SECURE',
  'Data Loss Prevention': 'IAG',
  'Network Access Contro': 'IAG',
  'Log Management': 'CYBER_COMMAND',
  'Security Monitoring': 'CYBER_COMMAND',
  'Backup Management': 'SYSTEM',
  'System Management': 'ENDPOINT_SECURE',
  'Policy and Procedure': 'SYSTEM',
};

// ─── Excel 파싱 ─────────────────────────────────────────────────────────────

export function parseExcelWithResultFilter(data: any[][]): ExcelRow[] {
  const rows: ExcelRow[] = [];

  for (let i = 4; i < data.length; i++) {
    const row = data[i];

    // Result 컬럼 확인 (인덱스 9)
    const result = row[9];
    if (!result && result !== 0) continue; // Result 없으면 스킵

    rows.push({
      no: row[0],
      category: row[1],
      solution: row[2],
      item: row[3],
      detail: row[4],
      result: result,
      internet: row[5],
      office: row[6],
      production: row[7],
      server: row[8],
      reason: row[10],
    });
  }

  return rows;
}

export function mapSolutionToProduct(solution: string): string {
  return SOLUTION_TO_PRODUCT[solution] || 'UNKNOWN';
}

export function analyzeExcelData(rows: ExcelRow[]): ParseResult {
  // 제품별 분류
  const byProduct: Record<string, ExcelRow[]> = {};
  const products = new Set<string>();

  for (const row of rows) {
    const product = mapSolutionToProduct(row.solution);
    if (product === 'SYSTEM') continue; // SYSTEM 제외

    if (!byProduct[product]) byProduct[product] = [];
    byProduct[product].push(row);
    products.add(product);
  }

  // Compliance 계산
  const passedItems = rows.filter((r) => r.result === 1 || r.result === 'O').length;
  const compliance = rows.length > 0 ? Math.round((passedItems / rows.length) * 100) : 0;

  return {
    rows,
    products: Array.from(products),
    byProduct,
    compliance,
    totalItems: rows.length,
    passedItems,
  };
}

// ─── Excel 파일 읽기 ────────────────────────────────────────────────────────

export async function parseExcelFile(filePath: string): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  log.info(`Parsing Excel: ${filePath}`);
  log.info(`Total rows: ${data.length}`);

  const rows = parseExcelWithResultFilter(data as unknown[][]);
  const result = analyzeExcelData(rows);

  log.info(`Extracted ${rows.length} items (Result filter applied)`);
  log.info(`Products: ${result.products.join(', ')}`);
  log.info(`Compliance: ${result.compliance}%`);

  return result;
}
