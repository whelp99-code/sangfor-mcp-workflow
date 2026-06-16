# PR-01: ComplianceTracker 인터페이스 설계

**Phase**: 1 (Compliance 추이 관리)  
**우선순위**: 🔴 높음  
**예상 기간**: 2일  
**담당**: workflow-engine

---

## 1. 목표

Compliance 추이 관리를 위한 인터페이스 설계

### 현재 상태
- Compliance 계산만 수행
- 이력 관리 없음
- 변화 추적 없음

### 목표 상태
- Compliance 이력 저장
- 변화 감지
- 추이 분석

---

## 2. 상세 구현

### 2.1 ComplianceTracker 인터페이스
```typescript
interface ComplianceTracker {
  // 이력 관리
  saveRecord(record: ComplianceRecord): void;
  getRecords(customer: string, product?: string): ComplianceRecord[];
  getLatestRecord(customer: string, product?: string): ComplianceRecord | null;
  
  // 변화 감지
  detectChanges(customer: string, current: ComplianceAnalysis): ComplianceChange[];
  
  // 추이 분석
  getTrend(customer: string, product: string, period: string): ComplianceTrend;
  
  // 예측
  predictCompliance(customer: string, roadmap: ImprovementRoadmap): number;
}

interface ComplianceRecord {
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
  metadata: Record<string, any>;
}

interface ComplianceItem {
  id: string;
  category: string;
  solution: string;
  item: string;
  result: number;
  improved: boolean;
  solutionApplied?: string;
}

interface ComplianceChange {
  itemId: string;
  category: string;
  item: string;
  previousResult: number;
  currentResult: number;
  change: number;
  reason: string;
}

interface ComplianceTrend {
  customer: string;
  product: string;
  period: string;
  records: ComplianceRecord[];
  trend: 'improving' | 'stable' | 'declining';
  changeRate: number;
  summary: string;
}
```

### 2.2 Compliance 분석 결과
```typescript
interface ComplianceAnalysis {
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
```

---

## 3. 테스트 케이스

### 3.1 단위 테스트
```typescript
describe('ComplianceTracker', () => {
  it('should save and retrieve compliance records', () => {
    const tracker = new ComplianceTracker();
    const record = createMockRecord();
    
    tracker.saveRecord(record);
    const retrieved = tracker.getLatestRecord('현대차');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.compliance).toBe(26);
  });
  
  it('should detect compliance changes', () => {
    const tracker = new ComplianceTracker();
    const previous = createMockRecord({ compliance: 26 });
    const current = createMockAnalysis({ compliance: 45 });
    
    tracker.saveRecord(previous);
    const changes = tracker.detectChanges('현대차', current);
    
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].change).toBeGreaterThan(0);
  });
  
  it('should analyze compliance trend', () => {
    const tracker = new ComplianceTracker();
    
    // 여러 시점의 기록 저장
    tracker.saveRecord(createMockRecord({ date: '2026-01-01', compliance: 20 }));
    tracker.saveRecord(createMockRecord({ date: '2026-02-01', compliance: 30 }));
    tracker.saveRecord(createMockRecord({ date: '2026-03-01', compliance: 45 }));
    
    const trend = tracker.getTrend('현대차', 'EPP', 'monthly');
    
    expect(trend.trend).toBe('improving');
    expect(trend.changeRate).toBeGreaterThan(0);
  });
});
```

---

## 4. 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `packages/workflow-engine/src/compliance-tracker.ts` | 신규 생성 |
| `packages/workflow-engine/src/types.ts` | 타입 추가 |
| `packages/workflow-engine/src/index.ts` | export 추가 |
| `tests/compliance-tracker.test.ts` | 신규 생성 |

---

## 5. 검증 방법

```bash
# 1. 단위 테스트
pnpm test -- --grep "ComplianceTracker"

# 2. 타입 검증
pnpm run build

# 3. 인터페이스 확인
node -e "
const { ComplianceTracker } = require('./packages/workflow-engine/src/compliance-tracker');
console.log('ComplianceTracker methods:', Object.getOwnPropertyNames(ComplianceTracker.prototype));
"
```

---

## 6. 완료 조건

- [ ] ComplianceTracker 인터페이스 설계 완료
- [ ] ComplianceRecord, ComplianceItem 타입 정의 완료
- [ ] ComplianceChange, ComplianceTrend 타입 정의 완료
- [ ] ComplianceAnalysis 타입 정의 완료
- [ ] 단위 테스트 통과
- [ ] 타입 검증 통과
