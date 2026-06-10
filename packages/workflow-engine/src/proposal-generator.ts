/**
 * Proposal Generator — 고객 제안서 자동 생성
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { ComplianceAnalysis } from './compliance-tracker.js';
import type { ImprovementRoadmap } from './roadmap-generator.js';

const log = createLogger('proposal-generator');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface CustomerProposal {
  id: string;
  customer: string;
  date: string;
  title: string;
  currentStatus: ComplianceAnalysis;
  improvementPlan: ImprovementRoadmap;
  expectedBenefits: {
    complianceImprovement: string;
    securityEnhancement: string;
    costOptimization: string;
  };
  sangforProducts: {
    product: string;
    features: string[];
    pricing: string;
    implementation: string;
  }[];
  timeline: string;
  totalCost: string;
  summary: string;
}

// ─── 제안서 생성기 ──────────────────────────────────────────────────────────

export class ProposalGenerator {
  generate(
    customer: string,
    currentAnalysis: ComplianceAnalysis,
    roadmap: ImprovementRoadmap
  ): CustomerProposal {
    log.info(`Generating proposal for ${customer}`);

    return {
      id: nowId('proposal'),
      customer,
      date: nowISO(),
      title: `${customer} 보안 개선 제안서`,
      currentStatus: currentAnalysis,
      improvementPlan: roadmap,
      expectedBenefits: this.calculateBenefits(currentAnalysis, roadmap),
      sangforProducts: this.getSangforProducts(roadmap),
      timeline: roadmap.estimatedDuration,
      totalCost: roadmap.estimatedCost,
      summary: this.generateSummary(currentAnalysis, roadmap),
    };
  }

  generateMarkdown(proposal: CustomerProposal): string {
    const lines: string[] = [];

    lines.push(`# ${proposal.customer} 보안 개선 제안서`);
    lines.push('');
    lines.push(`작성일: ${new Date(proposal.date).toLocaleDateString('ko-KR')}`);
    lines.push('');

    lines.push('## 1. 현황 분석');
    lines.push('');
    lines.push(`- 현재 Compliance: ${proposal.currentStatus.currentCompliance}%`);
    lines.push(`- 미준수 항목: ${proposal.currentStatus.failedItems}개`);
    lines.push(`- 개선 기회: ${proposal.currentStatus.improvementOpportunity}%`);
    lines.push('');

    lines.push('## 2. 개선 계획');
    lines.push('');
    for (const phase of proposal.improvementPlan.phases) {
      lines.push(`### Phase ${phase.phase}: ${phase.title}`);
      lines.push(`- 솔루션: ${phase.sangforProduct}`);
      lines.push(`- 개선 항목: ${phase.items.length}개`);
      lines.push(`- 예상 Compliance: ${phase.expectedCompliance}%`);
      lines.push(`- 기간: ${phase.timeline}`);
      lines.push('');
    }

    lines.push('## 3. 기대 효과');
    lines.push('');
    lines.push(`- Compliance 향상: ${proposal.expectedBenefits.complianceImprovement}`);
    lines.push(`- 보안 강화: ${proposal.expectedBenefits.securityEnhancement}`);
    lines.push(`- 비용 최적화: ${proposal.expectedBenefits.costOptimization}`);
    lines.push('');

    lines.push('## 4. Sangfor 솔루션');
    lines.push('');
    for (const product of proposal.sangforProducts) {
      lines.push(`### ${product.product}`);
      lines.push(`- 주요 기능: ${product.features.join(', ')}`);
      lines.push(`- 가격: ${product.pricing}`);
      lines.push(`- 구현: ${product.implementation}`);
      lines.push('');
    }

    lines.push('## 5. 일정 및 비용');
    lines.push('');
    lines.push(`- 전체 기간: ${proposal.timeline}`);
    lines.push(`- 예상 비용: ${proposal.totalCost}`);
    lines.push('');

    lines.push('## 6. 결론');
    lines.push('');
    lines.push(proposal.summary);

    return lines.join('\n');
  }

  private calculateBenefits(analysis: ComplianceAnalysis, roadmap: ImprovementRoadmap) {
    const improvement = roadmap.targetCompliance - analysis.currentCompliance;
    return {
      complianceImprovement: `${analysis.currentCompliance}% → ${roadmap.targetCompliance}% (${improvement}%p 향상)`,
      securityEnhancement: `${roadmap.phases.length}개 보안 영역 강화`,
      costOptimization: `침해 사고 예방으로 연간 ${improvement * 100}만원 절감`,
    };
  }

  private getSangforProducts(roadmap: ImprovementRoadmap) {
    const products = new Map<string, string[]>();
    for (const phase of roadmap.phases) {
      if (!products.has(phase.sangforProduct)) {
        products.set(phase.sangforProduct, []);
      }
      products.get(phase.sangforProduct)!.push(...phase.sangforFeatures);
    }

    return Array.from(products.entries()).map(([product, features]) => ({
      product,
      features: [...new Set(features)],
      pricing: '벤더 견적 필요',
      implementation: '전문 엔지니어 구축 지원',
    }));
  }

  private generateSummary(analysis: ComplianceAnalysis, roadmap: ImprovementRoadmap): string {
    return `${analysis.customer}의 현재 Compliance ${analysis.currentCompliance}%를 ` +
      `${roadmap.targetCompliance}%까지 개선하기 위한 ${roadmap.phases.length}단계 제안입니다. ` +
      `Sangfor 보안 솔루션을 통해 ${roadmap.estimatedDuration} 내에 구현 가능합니다.`;
  }
}
