/**
 * Vendor Comparator — 벤더별 솔루션 비교 엔진
 */

import { createLogger } from '@sangfor/workflow-shared';

const log = createLogger('vendor-comparator');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface VendorProduct {
  vendor: string;
  product: string;
  category: string;
  features: string[];
  pricing: { model: string; range: string };
  strengths: string[];
  weaknesses: string[];
  targetMarket: string[];
  website: string;
  marketShare?: string;
  gartnerQuadrant?: string;
}

export interface ComparisonResult {
  category: string;
  requirement: string;
  recommendations: VendorRecommendation[];
  summary: string;
}

export interface VendorRecommendation {
  rank: number;
  vendor: string;
  product: string;
  fitScore: number;
  reasons: string[];
  pricing: string;
  pros: string[];
  cons: string[];
}

// ─── 벤더 비교 ──────────────────────────────────────────────────────────────

export class VendorComparator {
  private vendorDB: any;

  constructor(vendorDB: any) {
    this.vendorDB = vendorDB;
  }

  // 카테고리별 벤더 비교
  compareByCategory(category: string, requirement: string): ComparisonResult {
    const categoryData = this.vendorDB.categories.find(
      (c: any) => c.id === category || c.name.toLowerCase().includes(category.toLowerCase())
    );

    if (!categoryData) {
      return {
        category,
        requirement,
        recommendations: [],
        summary: `카테고리 '${category}'에 대한 벤더 데이터를 찾을 수 없습니다.`,
      };
    }

    const recommendations = categoryData.vendors
      .slice(0, 5)
      .map((v: any, i: number) => ({
        rank: i + 1,
        vendor: v.vendor,
        product: v.product,
        fitScore: this.calculateFitScore(v, requirement),
        reasons: this.generateReasons(v, requirement),
        pricing: v.pricing?.range || '가격 정보 없음',
        pros: v.strengths || [],
        cons: v.weaknesses || [],
      }));

    return {
      category: categoryData.name,
      requirement,
      recommendations,
      summary: this.generateSummary(categoryData, recommendations),
    };
  }

  // 감사항목별 솔루션 추천
  recommendForAuditItem(auditItem: string): ComparisonResult[] {
    const results: ComparisonResult[] = [];

    for (const category of this.vendorDB.categories) {
      const hasMatch = category.vendors.some(
        (v: any) =>
          v.features?.some((f: string) => auditItem.includes(f)) ||
          v.strengths?.some((s: string) => auditItem.includes(s))
      );

      if (hasMatch) {
        results.push(this.compareByCategory(category.id, auditItem));
      }
    }

    return results;
  }

  // Sangfor vs 타 벤더 비교
  compareSangforVsCompetitors(category: string): {
    sangfor: VendorProduct | null;
    competitors: VendorProduct[];
    analysis: string;
  } {
    const categoryData = this.vendorDB.categories.find((c: any) => c.id === category);

    if (!categoryData) {
      return { sangfor: null, competitors: [], analysis: '카테고리 데이터 없음' };
    }

    const sangfor = categoryData.vendors.find((v: any) => v.vendor === 'Sangfor');
    const competitors = categoryData.vendors.filter((v: any) => v.vendor !== 'Sangfor').slice(0, 3);

    const analysis = this.generateSangforAnalysis(sangfor, competitors);

    return { sangfor, competitors, analysis };
  }

  // 적합도 점수 계산
  private calculateFitScore(vendor: any, requirement: string): number {
    let score = 50; // 기본 점수

    // 기능 매칭
    const featureMatch = vendor.features?.filter((f: string) =>
      requirement.toLowerCase().includes(f.toLowerCase())
    ).length || 0;
    score += featureMatch * 10;

    // 시장 점유율
    if (vendor.marketShare) {
      const share = parseFloat(vendor.marketShare);
      if (share > 10) score += 15;
      else if (share > 5) score += 10;
      else if (share > 2) score += 5;
    }

    // Gartner 평가
    if (vendor.gartnerQuadrant === 'Leader') score += 15;
    else if (vendor.gartnerQuadrant === 'Challenger') score += 10;

    return Math.min(100, score);
  }

  // 추천 이유 생성
  private generateReasons(vendor: any, requirement: string): string[] {
    const reasons: string[] = [];

    if (vendor.gartnerQuadrant === 'Leader') {
      reasons.push('Gartner 리더 그룹');
    }

    if (vendor.marketShare && parseFloat(vendor.marketShare) > 5) {
      reasons.push(`시장 점유율 ${vendor.marketShare}`);
    }

    const matchingFeatures = vendor.features?.filter((f: string) =>
      requirement.toLowerCase().includes(f.toLowerCase())
    ) || [];

    if (matchingFeatures.length > 0) {
      reasons.push(`필요 기능 지원: ${matchingFeatures.join(', ')}`);
    }

    if (vendor.strengths?.length > 0) {
      reasons.push(`강점: ${vendor.strengths[0]}`);
    }

    return reasons;
  }

  // 요약 생성
  private generateSummary(category: any, recommendations: VendorRecommendation[]): string {
    const topVendor = recommendations[0];
    if (!topVendor) return '추천할 벤더가 없습니다.';

    return `${category.name} 카테고리에서 ${topVendor.vendor} ${topVendor.product}을 추천합니다. ` +
      `적합도 ${topVendor.fitScore}점, ${topVendor.reasons.join(', ')}.`;
  }

  // Sangfor 분석 생성
  private generateSangforAnalysis(sangfor: any, competitors: any[]): string {
    if (!sangfor) return 'Sangfor 제품 데이터가 없습니다.';

    const competitorNames = competitors.map((c) => `${c.vendor} ${c.product}`).join(', ');

    return `Sangfor ${sangfor.product}의 주요 강점: ${sangfor.strengths?.join(', ')}. ` +
      `주요 경쟁사: ${competitorNames}. ` +
      `Sangfor는 APAC 지역에서 강세를 보이며, 가격 경쟁력이 있습니다.`;
  }
}
