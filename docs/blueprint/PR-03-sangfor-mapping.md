# PR-03: Sangfor 제품 매핑 강화

**Phase**: 1 (기반 구축)  
**우선순위**: 🔴 높음  
**예상 기간**: 3일  
**담당**: workflow-engine

---

## 1. 목표

Sangfor 제품별 상세 매핑 정보 강화

### 현재 상태
- Solution → 제품 코드 단순 매핑
- 제품별 기능 정보 부족

### 목표 상태
- 제품별 상세 기능 정보
- 메뉴 경로 매핑
- 설정 방법 정보

---

## 2. Sangfor 제품 매핑 상세

### 2.1 제품별 기능 매핑
```typescript
interface SangforProductMapping {
  productCode: string;        // "ENDPOINT_SECURE", "IAG", "CYBER_COMMAND"
  productName: string;        // "Endpoint Secure", "IAG", "Cyber Command"
  version: string;
  features: ProductFeature[];
  menuPaths: MenuPath[];
  configurations: Configuration[];
}

interface ProductFeature {
  id: string;
  name: string;
  category: string;
  description: string;
  auditItems: string[];       // 대응 감사항목
}

interface MenuPath {
  feature: string;
  path: string[];             // ["Defense", "Malware Scan"]
  screenshot?: string;
}

interface Configuration {
  feature: string;
  steps: string[];
  references: string[];
}
```

### 2.2 Endpoint Secure 매핑 예시
```json
{
  "productCode": "ENDPOINT_SECURE",
  "productName": "Endpoint Secure",
  "version": "v6.0.4",
  "features": [
    {
      "id": "epp-antivirus",
      "name": "Anti-Virus",
      "category": "Anti-Virus",
      "description": "악성코드 탐지 및 차단",
      "auditItems": ["③Malware Infection Prevention"]
    },
    {
      "id": "epp-edr",
      "name": "EDR",
      "category": "Anti-Virus",
      "description": "엔드포인트 탐지 및 대응",
      "auditItems": ["③Malware Infection Prevention"]
    },
    {
      "id": "epp-device-control",
      "name": "Device Control",
      "category": "Device Control",
      "description": "저장 매체 제어",
      "auditItems": ["⑤Information Leakage Prevention"]
    },
    {
      "id": "epp-app-control",
      "name": "Application Control",
      "category": "Software Control",
      "description": "소프트웨어 실행 제어",
      "auditItems": ["③Malware Infection Prevention"]
    }
  ],
  "menuPaths": [
    {
      "feature": "Anti-Virus",
      "path": ["Defense", "Malware Scan"]
    },
    {
      "feature": "Device Control",
      "path": ["Policies", "Behavior Control"]
    },
    {
      "feature": "Application Control",
      "path": ["Policies", "App Control"]
    }
  ],
  "configurations": [
    {
      "feature": "Anti-Virus",
      "steps": [
        "Defense > Malware Scan 이동",
        "스캔 정책 설정",
        "실시간 보호 활성화",
        "스캔 스케줄 설정"
      ],
      "references": [
        "Sangfor Endpoint Secure User Manual v6.0.4"
      ]
    }
  ]
}
```

---

## 3. 구현 상세

### 3.1 매핑 데이터 구조
```
data/
├── sangfor-products/
│   ├── endpoint-secure.json
│   ├── iag.json
│   └── cyber-command.json
└── sangfor-mappings.json
```

### 3.2 매핑 로직
```typescript
class SangforMapper {
  private products: Map<string, SangforProductMapping>;
  
  constructor() {
    this.products = this.loadProducts();
  }
  
  // 감사항목으로 제품 매핑
  findByAuditItem(auditItem: string): SangforProductMapping[] {
    const results: SangforProductMapping[] = [];
    
    for (const product of this.products.values()) {
      const hasFeature = product.features.some(f => 
        f.auditItems.includes(auditItem)
      );
      if (hasFeature) results.push(product);
    }
    
    return results;
  }
  
  // 제품별 메뉴 경로 조회
  getMenuPath(productCode: string, feature: string): string[] | undefined {
    const product = this.products.get(productCode);
    if (!product) return undefined;
    
    const menuPath = product.menuPaths.find(m => m.feature === feature);
    return menuPath?.path;
  }
  
  // 제품별 설정 방법 조회
  getConfiguration(productCode: string, feature: string): Configuration | undefined {
    const product = this.products.get(productCode);
    if (!product) return undefined;
    
    return product.configurations.find(c => c.feature === feature);
  }
}
```

---

## 4. 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `data/sangfor-products/endpoint-secure.json` | 신규 생성 |
| `data/sangfor-products/iag.json` | 신규 생성 |
| `data/sangfor-products/cyber-command.json` | 신규 생성 |
| `data/sangfor-mappings.json` | 신규 생성 |
| `packages/workflow-engine/src/sangfor-mapper.ts` | 신규 생성 |
| `packages/workflow-engine/src/index.ts` | export 추가 |
| `tests/sangfor-mapper.test.ts` | 신규 생성 |

---

## 5. 검증 방법

```bash
# 1. 제품 데이터 로드 확인
node -e "
const mapper = new SangforMapper();
console.log('제품 수:', mapper.products.size);
"

# 2. 감사항목 매핑 테스트
node -e "
const mapper = new SangforMapper();
const products = mapper.findByAuditItem('③Malware Infection Prevention');
console.log('매핑된 제품:', products.map(p => p.productName));
"

# 3. 메뉴 경로 조회 테스트
node -e "
const mapper = new SangforMapper();
const path = mapper.getMenuPath('ENDPOINT_SECURE', 'Anti-Virus');
console.log('메뉴 경로:', path);
"
```

---

## 6. 완료 조건

- [ ] Sangfor 3개 제품 매핑 데이터 구축
- [ ] 제품별 기능 정보 포함
- [ ] 메뉴 경로 매핑 포함
- [ ] 설정 방법 정보 포함
- [ ] 감사항목 → 제품 매핑 동작 확인
- [ ] 단위 테스트 통과
