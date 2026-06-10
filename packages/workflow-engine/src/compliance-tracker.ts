/**
 * Compliance Tracker — Compliance 추이 관리 시스템
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const log = createLogger('compliance-tracker');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ComplianceRecord {
  id: string;
  date: string;
  customer: string;
  product: string;
  compliance: number;
  totalItems: number;
  passedItems: number;
  partiallyPassed: number;
  failedItems: number;
  items: ComplianceItem[];
  filePath?: string;
  metadata: Record<string, any>;
}

export interface ComplianceItem {
  id: string;
  category: string;
  solution: string;
  item: string;
  result: number;
  improved: boolean;
  solutionApplied?: string;
}

export interface ComplianceChange {
  itemId: string;
  category: string;
  item: string;
  previousResult: number;
  currentResult: number;
  change: number;
  reason: string;
}

export interface ComplianceTrend {
  customer: string;
  product: string;
  period: string;
  records: ComplianceRecord[];
  trend: 'improving' | 'stable' | 'declining';
  changeRate: number;
  summary: string;
}

export interface ComplianceAnalysis {
  customer: string;
  product: string;
  date: string;
  totalItems: number;
  passedItems: number;
  partiallyPassed: number;
  failedItems: number;
  currentCompliance: number;
  potentialCompliance: number;
  improvementOpportunity: number;
  items: ComplianceItem[];
}

// ─── Compliance Tracker ─────────────────────────────────────────────────────

export class ComplianceTracker {
  private records: Map<string, ComplianceRecord[]> = new Map();
  private dataPath: string;

  constructor(dataPath: string = 'data/compliance/records.json') {
    this.dataPath = dataPath;
    this.loadFromDisk();
  }

  // 이력 저장
  saveRecord(record: ComplianceRecord): void {
    const key = `${record.customer}-${record.product}`;
    const records = this.records.get(key) || [];
    records.push(record);
    this.records.set(key, records);
    this.persistToDisk();
    log.info(`Saved compliance record: ${record.customer}-${record.product} = ${record.compliance}%`);
  }

  // 이력 조회
  getRecords(customer: string, product?: string): ComplianceRecord[] {
    if (product) {
      return this.records.get(`${customer}-${product}`) || [];
    }
    const allRecords: ComplianceRecord[] = [];
    for (const [key, records] of this.records) {
      if (key.startsWith(customer)) {
        allRecords.push(...records);
      }
    }
    return allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // 최신 기록 조회
  getLatestRecord(customer: string, product?: string): ComplianceRecord | null {
    const records = this.getRecords(customer, product);
    return records.length > 0 ? records[0] : null;
  }

  // 변화 감지
  detectChanges(customer: string, current: ComplianceAnalysis): ComplianceChange[] {
    const previous = this.getLatestRecord(customer, current.product);
    if (!previous) return [];

    const changes: ComplianceChange[] = [];
    for (const currentItem of current.items) {
      const previousItem = previous.items.find(i => i.id === currentItem.id);
      if (previousItem) {
        const change = currentItem.result - previousItem.result;
        if (Math.abs(change) > 0.01) {
          changes.push({
            itemId: currentItem.id,
            category: currentItem.category,
            item: currentItem.item,
            previousResult: previousItem.result,
            currentResult: currentItem.result,
            change,
            reason: change > 0 ? '개선' : '악화',
          });
        }
      }
    }
    return changes;
  }

  // 추이 분석
  getTrend(customer: string, product: string, period: string = 'monthly'): ComplianceTrend {
    const records = this.getRecords(customer, product);
    const sorted = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sorted.length < 2) {
      return {
        customer,
        product,
        period,
        records: sorted,
        trend: 'stable',
        changeRate: 0,
        summary: '데이터 부족',
      };
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const changeRate = (last.compliance - first.compliance) / sorted.length;

    let trend: 'improving' | 'stable' | 'declining';
    if (changeRate > 0.05) trend = 'improving';
    else if (changeRate < -0.05) trend = 'declining';
    else trend = 'stable';

    return {
      customer,
      product,
      period,
      records: sorted,
      trend,
      changeRate,
      summary: `Compliance ${trend === 'improving' ? '개선' : trend === 'declining' ? '악화' : '안정'} 추이: ${first.compliance}% → ${last.compliance}%`,
    };
  }

  // 디스크 영속화
  private persistToDisk(): void {
    try {
      const data = Object.fromEntries(this.records);
      writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      log.error(`Failed to persist: ${error}`);
    }
  }

  // 디스크에서 로드
  private loadFromDisk(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf-8'));
        for (const [key, records] of Object.entries(data)) {
          this.records.set(key, records as ComplianceRecord[]);
        }
        log.info(`Loaded ${this.records.size} compliance records`);
      }
    } catch (error) {
      log.warn(`Failed to load: ${error}`);
    }
  }
}
