/**
 * Roadmap Generator — 개선 로드맵 자동 생성
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { ComplianceAnalysis, ComplianceItem } from './compliance-tracker.js';

const log = createLogger('roadmap-generator');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ImprovementRoadmap {
  id: string;
  customer: string;
  currentCompliance: number;
  targetCompliance: number;
  phases: ImprovementPhase[];
  estimatedDuration: string;
  estimatedCost: string;
  summary: string;
  createdAt: string;
}

export interface ImprovementPhase {
  phase: number;
  title: string;
  items: string[];
  solution: string;
  expectedCompliance: number;
  timeline: string;
  prerequisites: string[];
  sangforProduct: string;
  sangforFeatures: string[];
}

// ─── Sangfor 제품 매핑 ──────────────────────────────────────────────────────

const SANGFOR_PRODUCT_MAP: Record<string, { product: string; features: string[] }> = {
  'Anti-Virus': { product: 'Endpoint Secure', features: ['EDR', 'Anti-Virus', 'Device Control'] },
  'Software Control': { product: 'Endpoint Secure', features: ['Application Control', 'USB Control'] },
  'Device Control': { product: 'Endpoint Secure', features: ['Device Control', 'USB Control'] },
  'Anti-Spam': { product: 'IAG', features: ['Anti-Spam', 'Email Filtering'] },
  'Data Loss Prevention': { product: 'IAG', features: ['DLP', 'Data Filtering'] },
  'Network Access Contro': { product: 'IAG', features: ['NGFW', 'URL Filtering'] },
  'Log Management': { product: 'Cyber Command', features: ['SIEM', 'Log Analytics'] },
  'Security Monitoring': { product: 'Cyber Command', features: ['NDR', 'Threat Detection'] },
};

// ─── 로드맵 생성기 ──────────────────────────────────────────────────────────

export class RoadmapGenerator {
  generateRoadmap(
    customer: string,
    currentAnalysis: ComplianceAnalysis,
    targetCompliance: number = 87
  ): ImprovementRoadmap {
    log.info(`Generating roadmap for ${customer}: ${currentAnalysis.currentCompliance}% → ${targetCompliance}%`);

    const phases: ImprovementPhase[] = [];
    let expectedCompliance = currentAnalysis.currentCompliance;
    let phaseNumber = 1;

    // 미통과 항목을 카테고리별로 분류
    const failedByCategory = this.groupFailedByCategory(currentAnalysis);

    // Sangfor 제품별로 그룹화
    const groupedByProduct = this.groupBySangforProduct(failedByCategory);

    // Phase별 계획 생성
    for (const [product, items] of Object.entries(groupedByProduct)) {
      if (expectedCompliance >= targetCompliance) break;

      const improvement = this.calculateImprovement(items, currentAnalysis.totalItems);
      expectedCompliance = Math.min(100, Math.round(expectedCompliance + improvement));

      const productInfo = SANGFOR_PRODUCT_MAP[product] || { product: 'Unknown', features: [] };

      phases.push({
        phase: phaseNumber++,
        title: `${productInfo.product} 적용`,
        items: items.map(i => i.item),
        solution: productInfo.product,
        expectedCompliance,
        timeline: `${Math.ceil(items.length / 3)}주`,
        prerequisites: phaseNumber > 2 ? [`Phase ${phaseNumber - 2} 완료`] : [],
        sangforProduct: productInfo.product,
        sangforFeatures: productInfo.features,
      });
    }

    const totalWeeks = phases.reduce((sum, p) => sum + parseInt(p.timeline), 0);

    return {
      id: nowId('roadmap'),
      customer,
      currentCompliance: currentAnalysis.currentCompliance,
      targetCompliance,
      phases,
      estimatedDuration: `${totalWeeks}주`,
      estimatedCost: this.estimateCost(phases),
      summary: this.generateSummary(currentAnalysis.currentCompliance, targetCompliance, phases),
      createdAt: nowISO(),
    };
  }

  private groupFailedByCategory(analysis: ComplianceAnalysis): Record<string, ComplianceItem[]> {
    const grouped: Record<string, ComplianceItem[]> = {};
    for (const item of analysis.items) {
      if (item.result < 1) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      }
    }
    return grouped;
  }

  private groupBySangforProduct(failedByCategory: Record<string, ComplianceItem[]>): Record<string, ComplianceItem[]> {
    const grouped: Record<string, ComplianceItem[]> = {};
    for (const [category, items] of Object.entries(failedByCategory)) {
      const productInfo = SANGFOR_PRODUCT_MAP[category];
      if (productInfo) {
        const product = productInfo.product;
        if (!grouped[product]) grouped[product] = [];
        grouped[product].push(...items);
      }
    }
    return grouped;
  }

  private calculateImprovement(items: ComplianceItem[], totalItems: number): number {
    return (items.length / totalItems) * 100;
  }

  private estimateCost(phases: ImprovementPhase[]): string {
    const totalProducts = new Set(phases.map(p => p.sangforProduct)).size;
    return `약 ${totalProducts * 5000}만원 ~ ${totalProducts * 10000}만원`;
  }

  private generateSummary(current: number, target: number, phases: ImprovementPhase[]): string {
    return `현재 Compliance ${current}%에서 ${target}%까지 ${phases.length}단계로 개선합니다. ` +
      `총 ${phases.length}개 Sangfor 제품 적용으로 ${target - current}%p 향상 예상.`;
  }
}
