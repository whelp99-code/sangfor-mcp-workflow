/**
 * Compliance Monitor — 지속적 모니터링
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { ComplianceRecord, ComplianceAnalysis, ComplianceChange } from './compliance-tracker.js';
import { ComplianceTracker } from './compliance-tracker.js';
import { ComplianceChangeDetector } from './compliance-change-detector.js';

const log = createLogger('compliance-monitor');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface MonitoringAlert {
  id: string;
  customer: string;
  product: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  changes: ComplianceChange[];
  timestamp: string;
}

export interface DashboardData {
  customer: string;
  currentCompliance: number;
  trend: 'improving' | 'stable' | 'declining';
  recentChanges: ComplianceChange[];
  alerts: MonitoringAlert[];
  products: {
    product: string;
    compliance: number;
    trend: string;
  }[];
}

// ─── Compliance Monitor ─────────────────────────────────────────────────────

export class ComplianceMonitor {
  private tracker: ComplianceTracker;
  private detector: ComplianceChangeDetector;
  private alerts: MonitoringAlert[] = [];

  constructor() {
    this.tracker = new ComplianceTracker();
    this.detector = new ComplianceChangeDetector();
  }

  // 정기 점검
  async scheduledCheck(customer: string): Promise<ComplianceAnalysis | null> {
    log.info(`Running scheduled check for ${customer}`);

    const latest = this.tracker.getLatestRecord(customer);
    if (!latest) {
      log.warn(`No records found for ${customer}`);
      return null;
    }

    // TODO: Excel 파일 다시 읽기 및 재분석
    // 현재는 최신 기록 반환
    return {
      customer: latest.customer,
      product: latest.product,
      date: nowISO(),
      totalItems: latest.totalItems,
      passedItems: latest.passedItems,
      partiallyPassed: latest.partiallyPassed,
      failedItems: latest.failedItems,
      currentCompliance: latest.compliance,
      potentialCompliance: 100,
      improvementOpportunity: 100 - latest.compliance,
      items: latest.items,
    };
  }

  // 변화 감지 및 알림
  detectAndAlert(customer: string, current: ComplianceAnalysis): MonitoringAlert[] {
    const changes = this.tracker.detectChanges(customer, current);
    const newAlerts: MonitoringAlert[] = [];

    if (changes.length > 0) {
      const criticalChanges = changes.filter(c => c.change < -0.1);
      const improvements = changes.filter(c => c.change > 0.1);

      if (criticalChanges.length > 0) {
        const alert: MonitoringAlert = {
          id: nowId('alert'),
          customer,
          product: current.product,
          type: 'critical',
          message: `Compliance 악화 감지: ${criticalChanges.length}건`,
          changes: criticalChanges,
          timestamp: nowISO(),
        };
        newAlerts.push(alert);
        this.alerts.push(alert);
      }

      if (improvements.length > 0) {
        const alert: MonitoringAlert = {
          id: nowId('alert'),
          customer,
          product: current.product,
          type: 'info',
          message: `Compliance 개선: ${improvements.length}건`,
          changes: improvements,
          timestamp: nowISO(),
        };
        newAlerts.push(alert);
        this.alerts.push(alert);
      }
    }

    return newAlerts;
  }

  // 대시보드 데이터 조회
  getDashboardData(customer: string): DashboardData {
    const records = this.tracker.getRecords(customer);
    const latest = this.tracker.getLatestRecord(customer);
    const trend = this.tracker.getTrend(customer, latest?.product || '');

    // 제품별 데이터
    const productMap = new Map<string, ComplianceRecord[]>();
    for (const record of records) {
      if (!productMap.has(record.product)) {
        productMap.set(record.product, []);
      }
      productMap.get(record.product)!.push(record);
    }

    const products = Array.from(productMap.entries()).map(([product, recs]) => {
      const latestRec = recs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return {
        product,
        compliance: latestRec.compliance,
        trend: this.tracker.getTrend(customer, product).trend,
      };
    });

    return {
      customer,
      currentCompliance: latest?.compliance || 0,
      trend: trend.trend,
      recentChanges: [],
      alerts: this.alerts.filter(a => a.customer === customer),
      products,
    };
  }

  // 알림 조회
  getAlerts(customer?: string): MonitoringAlert[] {
    if (customer) {
      return this.alerts.filter(a => a.customer === customer);
    }
    return this.alerts;
  }
}
