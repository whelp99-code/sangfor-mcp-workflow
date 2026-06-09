# PR-02: 솔루션 매핑 DB 구축

**Phase**: 1 (기반 구축)  
**우선순위**: 🔴 높음  
**예상 기간**: 5일  
**담당**: workflow-engine

---

## 1. 목표

감사항목별 솔루션 매핑 데이터베이스 구축

### 현재 상태
- Solution 컬럼 기반 단순 매핑
- Sangfor 제품만 지원

### 목표 상태
- 카테고리별 다중 벤더 솔루션 매핑
- 솔루션별 기능/가격/장단점 정보 포함

---

## 2. 데이터 구조 설계

### 2.1 솔루션 매핑 스키마
```typescript
interface SolutionMapping {
  id: string;
  category: string;           // "Anti-Virus", "Firewall", etc.
  requirement: string;        // 감사항목 설명
  solutions: VendorSolution[];
}

interface VendorSolution {
  vendor: string;             // "Sangfor", "CrowdStrike", etc.
  product: string;            // "Endpoint Secure", "Falcon", etc.
  version: string;            // "v6.0.4"
  features: string[];         // 지원 기능 목록
  pricing: PricingInfo;
  pros: string[];             // 장점
  cons: string[];             // 단점
  fitScore: number;           // 적합도 (0-100)
  officialUrl: string;        // 공식 문서 URL
  lastUpdated: string;        // 마지막 업데이트
}

interface PricingInfo {
  model: 'per-user' | 'per-device' | 'tiered' | 'custom';
  basePrice: number;
  currency: string;
  notes: string;
}
```

### 2.2 샘플 데이터
```json
{
  "id": "anti-virus-001",
  "category": "Anti-Virus",
  "requirement": "조직 내 모든 PC와 서버에 안티바이러스 및 EDR 솔루션 설치",
  "solutions": [
    {
      "vendor": "Sangfor",
      "product": "Endpoint Secure",
      "version": "v6.0.4",
      "features": ["EDR", "Anti-Virus", "Device Control", "Application Control"],
      "pricing": {
        "model": "per-device",
        "basePrice": 50000,
        "currency": "KRW",
        "notes": "연간 라이선스"
      },
      "pros": ["HCI 연동", "중앙 관리", "국내 지원"],
      "cons": ["글로벌 인지도 낮음"],
      "fitScore": 85,
      "officialUrl": "https://www.sangfor.com/product/endpoint-secure",
      "lastUpdated": "2026-06-10"
    },
    {
      "vendor": "CrowdStrike",
      "product": "Falcon",
      "version": "v6.0",
      "features": ["EDR", "Anti-Virus", "Threat Intelligence", "IT Hygiene"],
      "pricing": {
        "model": "per-device",
        "basePrice": 80000,
        "currency": "KRW",
        "notes": "연간 라이선스, 볼륨 할인"
      },
      "pros": ["글로벌 1위", "AI 기반 탐지", "클라우드 네이티브"],
      "cons": ["높은 비용", "국내 지원 제한"],
      "fitScore": 90,
      "officialUrl": "https://www.crowdstrike.com/products/endpoint-security/",
      "lastUpdated": "2026-06-10"
    }
  ]
}
```

---

## 3. 구현 상세

### 3.1 DB 스키마 (JSON 파일)
```
data/
├── solution-mappings.json      # 전체 매핑 데이터
├── vendor-products.json        # 벤더별 제품 정보
└── pricing-data.json           # 가격 정보
```

### 3.2 매핑 로직
```typescript
class SolutionMapper {
  private mappings: SolutionMapping[];
  
  constructor() {
    this.mappings = this.loadMappings();
  }
  
  // 카테고리로 솔루션 검색
  findByCategory(category: string): SolutionMapping | undefined {
    return this.mappings.find(m => m.category === category);
  }
  
  // 벤더별 솔루션 필터
  findByVendor(vendor: string): VendorSolution[] {
    return this.mappings
      .flatMap(m => m.solutions)
      .filter(s => s.vendor === vendor);
  }
  
  // 적합도 기반 추천
  getTopRecommendations(category: string, limit: number = 3): VendorSolution[] {
    const mapping = this.findByCategory(category);
    if (!mapping) return [];
    
    return mapping.solutions
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, limit);
  }
}
```

---

## 4. 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `data/solution-mappings.json` | 신규 생성 |
| `data/vendor-products.json` | 신규 생성 |
| `data/pricing-data.json` | 신규 생성 |
| `packages/workflow-engine/src/solution-mapper.ts` | 신규 생성 |
| `packages/workflow-engine/src/index.ts` | export 추가 |
| `tests/solution-mapper.test.ts` | 신규 생성 |

---

## 5. 검증 방법

```bash
# 1. 데이터 로드 확인
node -e "
const mappings = require('./data/solution-mappings.json');
console.log('매핑 수:', mappings.length);
console.log('카테고리:', [...new Set(mappings.map(m => m.category))]);
"

# 2. 솔루션 검색 테스트
node -e "
const { SolutionMapper } = require('./packages/workflow-engine/src/solution-mapper');
const mapper = new SolutionMapper();
const recommendations = mapper.getTopRecommendations('Anti-Virus');
console.log('추천 솔루션:', recommendations.map(r => r.product));
"
```

---

## 6. 완료 조건

- [ ] 솔루션 매핑 JSON 데이터 구축
- [ ] SolutionMapper 클래스 구현
- [ ] 카테고리별 검색 동작 확인
- [ ] 벤더별 필터링 동작 확인
- [ ] 적합도 기반 추천 동작 확인
- [ ] 단위 테스트 통과
