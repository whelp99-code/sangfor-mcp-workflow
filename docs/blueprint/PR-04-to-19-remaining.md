# PR-04 ~ PR-19: 나머지 PR 지시서

**Phase**: 2-6  
**총 PR 수**: 16개  
**예상 기간**: 12주

---

## PR-04: 벤더 솔루션 DB 스키마 설계 (Phase 2)

### 목표
멀티 벤더 솔루션 데이터베이스 스키마 설계

### 상세
```typescript
// vendor-schema.ts
interface VendorDB {
  vendors: Vendor[];
  products: Product[];
  solutions: Solution[];
  comparisons: Comparison[];
}

interface Vendor {
  id: string;
  name: string;
  country: string;
  website: string;
  supportContact: string;
}

interface Product {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  version: string;
  features: string[];
  pricing: PricingInfo;
  lastUpdated: string;
}
```

### 파일 변경
- `packages/workflow-engine/src/vendor-schema.ts`
- `data/vendor-db-schema.json`

### 완료 조건
- [ ] 스키마 설계 완료
- [ ] JSON 스키마 검증
- [ ] 문서화 완료

---

## PR-05 ~ PR-07: 벤더별 솔루션 데이터 수집 (Phase 2)

### 목표
CrowdStrike, SentinelOne, Microsoft 솔루션 데이터 수집

### 데이터 수집 소스
| 벤더 | 소스 | 수집 방법 |
|------|------|----------|
| **CrowdStrike** | 공식 문서, 가격 페이지 | 웹 크롤링 |
| **SentinelOne** | 공식 문서, 가격 페이지 | 웹 크롤링 |
| **Microsoft** | 공식 문서, 가격 페이지 | 웹 크롤링 |

### 수집 데이터 구조
```json
{
  "vendor": "CrowdStrike",
  "products": [
    {
      "name": "Falcon Insight",
      "category": "EDR",
      "features": ["EDR", "Threat Intelligence", "IT Hygiene"],
      "pricing": {
        "model": "per-device",
        "basePrice": 80000,
        "currency": "KRW"
      }
    }
  ]
}
```

### 파일 변경
- `data/vendors/crowdstrike.json`
- `data/vendors/sentinelone.json`
- `data/vendors/microsoft.json`
- `scripts/collect-vendor-data.ts`

### 완료 조건
- [ ] 3개 벤더 데이터 수집 완료
- [ ] 데이터 형식 검증
- [ ] JSON 파일 저장

---

## PR-08 ~ PR-10: 비교 엔진 구현 (Phase 3)

### 목표
벤더별 솔루션 비교 알고리즘 구현

### 비교 항목
| 항목 | 가중치 | 설명 |
|------|--------|------|
| **기능** | 30% | 지원 기능 수 및 범위 |
| **가격** | 25% | 총 소유 비용 (TCO) |
| **지원** | 20% | 국내 지원, 기술 지원 |
| **확장성** | 15% | 향후 확장 가능성 |
| **신뢰성** | 10% | 시장 점유율, 리뷰 |

### 비교 알고리즘
```typescript
class ComparisonEngine {
  compare(solutions: VendorSolution[]): ComparisonResult {
    const scores = solutions.map(s => ({
      solution: s,
      score: this.calculateScore(s)
    }));
    
    return {
      ranked: scores.sort((a, b) => b.score - a.score),
      summary: this.generateSummary(scores)
    };
  }
  
  private calculateScore(solution: VendorSolution): number {
    return (
      solution.featureScore * 0.3 +
      solution.priceScore * 0.25 +
      solution.supportScore * 0.2 +
      solution.scalabilityScore * 0.15 +
      solution.reliabilityScore * 0.1
    );
  }
}
```

### 파일 변경
- `packages/workflow-engine/src/comparison-engine.ts`
- `packages/workflow-engine/src/price-comparator.ts`
- `packages/workflow-engine/src/feature-comparator.ts`
- `tests/comparison-engine.test.ts`

### 완료 조건
- [ ] 비교 알고리즘 구현
- [ ] 가격 비교 모듈 구현
- [ ] 기능 비교 모듈 구현
- [ ] 단위 테스트 통과

---

## PR-11 ~ PR-13: 추천 엔진 구현 (Phase 4)

### 목표
고객 환경 분석 후 최적 솔루션 추천

### 추천 로직
```typescript
class RecommendationEngine {
  recommend(
    requirements: Requirement[],
    customerProfile: CustomerProfile
  ): Recommendation[] {
    // 1. 요구사항 분석
    const categories = this.analyzeCategories(requirements);
    
    // 2. 카테고리별 솔루션 검색
    const solutions = categories.map(c => 
      this.solutionMapper.findByCategory(c)
    );
    
    // 3. 고객 환경 고려
    const filtered = this.filterByEnvironment(solutions, customerProfile);
    
    // 4. 최적 조합 생성
    const optimized = this.optimizeCombination(filtered);
    
    return optimized;
  }
  
  private filterByEnvironment(
    solutions: SolutionMapping[],
    profile: CustomerProfile
  ): SolutionMapping[] {
    return solutions.filter(s => {
      // 예산 고려
      if (s.pricing.basePrice > profile.budget) return false;
      
      // 기존 시스템 호환성
      if (!this.isCompatible(s, profile.existingSystems)) return false;
      
      return true;
    });
  }
}
```

### 파일 변경
- `packages/workflow-engine/src/recommendation-engine.ts`
- `packages/workflow-engine/src/environment-analyzer.ts`
- `packages/workflow-engine/src/solution-optimizer.ts`
- `tests/recommendation-engine.test.ts`

### 완료 조건
- [ ] 추천 알고리즘 구현
- [ ] 고객 환경 분석 모듈 구현
- [ ] 최적 솔루션 조합 생성
- [ ] 단위 테스트 통과

---

## PR-14 ~ PR-16: 지속적 학습 (Phase 5)

### 목표
인터넷 벤더 자료 수집 및 RAG 학습

### 수집 소스
| 소스 | URL | 수집 방법 |
|------|-----|----------|
| **CrowdStrike** | crowdstrike.com | 웹 크롤링 |
| **SentinelOne** | sentinelone.com | 웹 크롤링 |
| **Microsoft** | microsoft.com | 웹 크롤링 |
| **Gartner** | gartner.com | 리뷰 수집 |
| **G2** | g2.com | 사용자 리뷰 |

### 학습 파이프라인
```typescript
class VendorLearner {
  async learn(): Promise<void> {
    // 1. 웹 크롤링
    const pages = await this.crawlVendorSites();
    
    // 2. 데이터 추출
    const extracted = this.extractProductInfo(pages);
    
    // 3. RAG 학습
    await this.ingestToRAG(extracted);
    
    // 4. DB 업데이트
    await this.updateVendorDB(extracted);
  }
}
```

### 파일 변경
- `packages/workflow-engine/src/vendor-crawler.ts`
- `packages/workflow-engine/src/rag-learner.ts`
- `packages/workflow-engine/src/db-updater.ts`
- `scripts/learn-vendor-data.ts`

### 완료 조건
- [ ] 웹 크롤러 구현
- [ ] RAG 학습 파이프라인 구현
- [ ] DB 자동 업데이트 구현
- [ ] 크론 작업 설정

---

## PR-17 ~ PR-19: 고도화 (Phase 6)

### 목표
비교 보고서 및 추천 사유서 생성

### 보고서 구조
```typescript
interface ComparisonReport {
  title: string;
  customer: string;
  date: string;
  requirements: Requirement[];
  solutions: VendorSolution[];
  comparison: ComparisonResult;
  recommendation: Recommendation;
  appendix: Appendix;
}
```

### 파일 변경
- `packages/workflow-engine/src/comparison-report.ts`
- `packages/workflow-engine/src/recommendation-doc.ts`
- `packages/workflow-engine/src/custom-guide.ts`
- `templates/comparison-report.md`
- `templates/recommendation-doc.md`

### 완료 조건
- [ ] 비교 보고서 생성 구현
- [ ] 추천 사유서 생성 구현
- [ ] 고객 맞춤 가이드 생성 구현
- [ ] 템플릿 디자인 완료

---

## 전체 일정 요약

| PR | Phase | 기간 | 의존성 |
|----|-------|------|--------|
| PR-01 | 1 | 3일 | - |
| PR-02 | 1 | 5일 | PR-01 |
| PR-03 | 1 | 3일 | PR-01 |
| PR-04 | 2 | 3일 | PR-02 |
| PR-05 | 2 | 5일 | PR-04 |
| PR-06 | 2 | 5일 | PR-04 |
| PR-07 | 2 | 5일 | PR-04 |
| PR-08 | 3 | 5일 | PR-05,06,07 |
| PR-09 | 3 | 3일 | PR-08 |
| PR-10 | 3 | 3일 | PR-08 |
| PR-11 | 4 | 5일 | PR-08 |
| PR-12 | 4 | 3일 | PR-11 |
| PR-13 | 4 | 3일 | PR-11 |
| PR-14 | 5 | 5일 | PR-11 |
| PR-15 | 5 | 5일 | PR-14 |
| PR-16 | 5 | 3일 | PR-14 |
| PR-17 | 6 | 5일 | PR-11 |
| PR-18 | 6 | 3일 | PR-17 |
| PR-19 | 6 | 3일 | PR-17 |

**총 예상 기간**: 72일 (약 14주)
