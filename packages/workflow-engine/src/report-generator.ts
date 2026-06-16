/**
 * Report Generator — 비교 보고서 + 추천 사유서 + 고객 맞춤 가이드 생성
 */

import { createLogger, nowId, nowISO } from '@sangfor/workflow-shared';

const log = createLogger('report-generator');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ReportConfig {
  customerName: string;
  products: string[];
  requirements: string[];
  comparisonResults: any[];
  recommendations: any[];
}

export interface ComparisonReport {
  id: string;
  title: string;
  customer: string;
  date: string;
  executiveSummary: string;
  requirements: RequirementSection[];
  vendorComparisons: VendorComparisonSection[];
  recommendation: RecommendationSection;
  appendix: AppendixSection;
}

export interface RequirementSection {
  id: string;
  category: string;
  requirement: string;
  currentState: string;
  gapAnalysis: string;
  recommendedSolution: string;
}

export interface VendorComparisonSection {
  category: string;
  vendors: {
    vendor: string;
    product: string;
    score: number;
    pricing: string;
    pros: string[];
    cons: string[];
  }[];
  recommendation: string;
}

export interface RecommendationSection {
  primaryRecommendation: string;
  alternativeOptions: string[];
  implementationPlan: string;
  estimatedCost: string;
  timeline: string;
}

export interface AppendixSection {
  vendorDetails: any[];
  featureMatrix: any;
  pricingComparison: any;
}

// ─── 보고서 생성기 ──────────────────────────────────────────────────────────

export class ReportGenerator {
  // 비교 보고서 생성
  generateComparisonReport(config: ReportConfig): ComparisonReport {
    log.info(`Generating comparison report for: ${config.customerName}`);

    const report: ComparisonReport = {
      id: nowId('report'),
      title: `${config.customerName} 보안 솔루션 비교 보고서`,
      customer: config.customerName,
      date: nowISO(),
      executiveSummary: this.generateExecutiveSummary(config),
      requirements: this.generateRequirementSections(config),
      vendorComparisons: this.generateVendorComparisons(config),
      recommendation: this.generateRecommendation(config),
      appendix: this.generateAppendix(config),
    };

    return report;
  }

  // 추천 사유서 생성
  generateRecommendationDoc(config: ReportConfig): string {
    const lines: string[] = [];

    lines.push(`# ${config.customerName} 보안 솔루션 추천 사유서`);
    lines.push('');
    lines.push(`작성일: ${new Date().toLocaleDateString('ko-KR')}`);
    lines.push('');

    lines.push('## 1. 추천 솔루션');
    lines.push('');

    for (const rec of config.recommendations) {
      lines.push(`### ${rec.category}`);
      lines.push(`- 추천 제품: ${rec.vendor} ${rec.product}`);
      lines.push(`- 적합도: ${rec.fitScore}점`);
      lines.push(`- 추천 사유:`);
      for (const reason of rec.reasons) {
        lines.push(`  - ${reason}`);
      }
      lines.push('');
    }

    lines.push('## 2. 비교 분석');
    lines.push('');

    for (const comp of config.comparisonResults) {
      lines.push(`### ${comp.category}`);
      lines.push('| 순위 | 벤더 | 제품 | 적합도 |');
      lines.push('|------|------|------|--------|');
      for (const rec of comp.recommendations) {
        lines.push(`| ${rec.rank} | ${rec.vendor} | ${rec.product} | ${rec.fitScore}점 |`);
      }
      lines.push('');
    }

    lines.push('## 3. 결론');
    lines.push('');
    lines.push('고객의 요구사항과 환경을 분석한 결과, 위 솔루션들을 추천합니다.');

    return lines.join('\n');
  }

  // 고객 맞춤 솔루션 가이드 생성
  generateCustomGuide(config: ReportConfig): string {
    const lines: string[] = [];

    lines.push(`# ${config.customerName} 맞춤 보안 솔루션 가이드`);
    lines.push('');
    lines.push(`작성일: ${new Date().toLocaleDateString('ko-KR')}`);
    lines.push('');

    lines.push('## 1. 고객 환경 분석');
    lines.push('');
    lines.push(`- 고객사: ${config.customerName}`);
    lines.push(`- 대상 제품: ${config.products.join(', ')}`);
    lines.push(`- 요구사항 수: ${config.requirements.length}개`);
    lines.push('');

    lines.push('## 2. 추천 솔루션 구성');
    lines.push('');

    for (const rec of config.recommendations) {
      lines.push(`### ${rec.category}`);
      lines.push(`- 추천 제품: ${rec.vendor} ${rec.product}`);
      lines.push(`- 가격 범위: ${rec.pricing}`);
      lines.push(`- 주요 기능:`);
      for (const pro of rec.pros) {
        lines.push(`  - ${pro}`);
      }
      lines.push('');
    }

    lines.push('## 3. 구현 로드맵');
    lines.push('');
    lines.push('| 단계 | 작업 | 기간 |');
    lines.push('|------|------|------|');
    lines.push('| 1단계 | 솔루션 선정 및 계약 | 2주 |');
    lines.push('| 2단계 | 환경 구축 및 설치 | 2주 |');
    lines.push('| 3단계 | 정책 설정 및 테스트 | 2주 |');
    lines.push('| 4단계 | 사용자 교육 및 운영 | 1주 |');
    lines.push('');

    lines.push('## 4. 예상 비용');
    lines.push('');
    lines.push('상세 견적은 벤더별 공식 견적을 받아야 합니다.');
    lines.push('');

    lines.push('## 5. 지원 및 유지보수');
    lines.push('');
    lines.push('- 기술 지원: 벤더별 지원 정책에 따름');
    lines.push('- 유지보수: 연간 라이선스 갱신');
    lines.push('- 교육: 벤더별 교육 프로그램 참여');

    return lines.join('\n');
  }

  // ─── 내부 메서드 ──────────────────────────────────────────────────────────

  private generateExecutiveSummary(config: ReportConfig): string {
    return `${config.customerName}의 보안 요구사항을 분석한 결과, ${config.requirements.length}개 항목에 대한 솔루션이 필요합니다. ` +
      `총 ${config.comparisonResults.length}개 카테고리에서 벤더 비교를 수행하였으며, 각 요구사항에 최적의 솔루션을 추천합니다.`;
  }

  private generateRequirementSections(config: ReportConfig): RequirementSection[] {
    return config.requirements.map((req, i) => ({
      id: `req-${i + 1}`,
      category: '보안',
      requirement: req,
      currentState: '현황 분석 필요',
      gapAnalysis: '갭 분석 필요',
      recommendedSolution: '추천 솔루션',
    }));
  }

  private generateVendorComparisons(config: ReportConfig): VendorComparisonSection[] {
    return config.comparisonResults.map((comp) => ({
      category: comp.category,
      vendors: comp.recommendations.map((rec: any) => ({
        vendor: rec.vendor,
        product: rec.product,
        score: rec.fitScore,
        pricing: rec.pricing,
        pros: rec.pros,
        cons: rec.cons,
      })),
      recommendation: comp.summary,
    }));
  }

  private generateRecommendation(config: ReportConfig): RecommendationSection {
    const topRec = config.recommendations[0];
    return {
      primaryRecommendation: topRec
        ? `${topRec.vendor} ${topRec.product} (적합도: ${topRec.fitScore}점)`
        : '추천 솔루션 없음',
      alternativeOptions: config.recommendations.slice(1, 3).map(
        (r) => `${r.vendor} ${r.product}`
      ),
      implementationPlan: '단계적 구현 계획 수립 필요',
      estimatedCost: '벤더 견적 필요',
      timeline: '약 4-6주',
    };
  }

  private generateAppendix(config: ReportConfig): AppendixSection {
    return {
      vendorDetails: config.comparisonResults,
      featureMatrix: {},
      pricingComparison: {},
    };
  }
}
