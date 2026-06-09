# PR-01: Excel 파싱 로직 수정 (Result 필터링)

**Phase**: 1 (기반 구축)  
**우선순위**: 🔴 높음  
**예상 기간**: 3일  
**담당**: workflow-engine

---

## 1. 목표

ITAC Excel 체크리스트에서 `Result` 컬럼이 있는 항목만 추출하는 로직 구현

### 현재 문제
```typescript
// 현재: 모든 행 추출 (30개)
for (let i = 4; i < data.length; i++) {
  const row = data[i];
  if (row && row[0] && row[1] && row[3]) {
    requirements.push({ ... });
  }
}
```

### 목표
```typescript
// 목표: Result 있는 항목만 추출 (18개)
for (let i = 4; i < data.length; i++) {
  const row = data[i];
  if (row && row[0] && row[1] && row[3] && row[9]) {  // row[9] = Result
    requirements.push({ ... });
  }
}
```

---

## 2. 상세 구현

### 2.1 Excel 구조 분석
```
Row 0-2: 헤더 정보
Row 3: 컬럼 헤더 (No, Category, Solution, Item, Specific details, ...)
Row 4+: 데이터

컬럼 인덱스:
- 0: No
- 1: Category
- 2: Solution
- 3: Item
- 4: Specific details
- 5: Internet (VPN,F/W,DMZ)
- 6: Office
- 7: Production
- 8: Server
- 9: Results ← 이 컬럼 확인
- 10: Reason for Inspection Results
```

### 2.2 필터링 로직
```typescript
interface ExcelRow {
  no: number;
  category: string;
  solution: string;
  item: string;
  detail: string;
  result: number | string;  // ← 이 값이 있는 행만 추출
  internet: string;
  office: string;
  production: string;
  server: string;
}

function parseExcelWithResultFilter(data: any[][]): ExcelRow[] {
  const rows: ExcelRow[] = [];
  
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    
    // Result 컬럼 확인 (인덱스 9)
    const result = row[9];
    if (!result && result !== 0) continue;  // Result 없으면 스킵
    
    rows.push({
      no: row[0],
      category: row[1],
      solution: row[2],
      item: row[3],
      detail: row[4],
      result: result,
      internet: row[5],
      office: row[6],
      production: row[7],
      server: row[8],
    });
  }
  
  return rows;
}
```

### 2.3 Solution → 제품 매핑
```typescript
const SOLUTION_TO_PRODUCT: Record<string, string> = {
  'Anti-Spam': 'IAG',
  'Anti-Virus': 'ENDPOINT_SECURE',
  'Software Control': 'ENDPOINT_SECURE',
  'Device Control': 'ENDPOINT_SECURE',
  'Data Loss Prevention': 'IAG',
  'Network Access Contro': 'IAG',
  'Log Management': 'CYBER_COMMAND',
  'Security Monitoring': 'CYBER_COMMAND',
  'Backup Management': 'SYSTEM',        // Sangfor 제품 아님
  'System Management': 'ENDPOINT_SECURE',
  'Policy and Procedure': 'SYSTEM',     // Sangfor 제품 아님
};

function mapSolutionToProduct(solution: string): string {
  return SOLUTION_TO_PRODUCT[solution] || 'UNKNOWN';
}
```

---

## 3. 테스트 케이스

### 3.1 단위 테스트
```typescript
describe('Excel Parser with Result Filter', () => {
  it('should only extract rows with Result column', () => {
    const mockData = [
      // ... 헤더 행들
      [1, 'Anti-Virus', 'Anti-Virus', 'Item 1', 'Detail 1', '', '', '', '', 0.5, 'Reason'],
      [2, 'Anti-Virus', 'Anti-Virus', 'Item 2', 'Detail 2', '', '', '', '', null, ''],  // Result 없음
      [3, 'Anti-Spam', 'Anti-Spam', 'Item 3', 'Detail 3', '', '', '', '', 1, 'Reason'],
    ];
    
    const result = parseExcelWithResultFilter(mockData);
    expect(result.length).toBe(2);  // null Result 제외
  });
  
  it('should map solutions to products correctly', () => {
    expect(mapSolutionToProduct('Anti-Virus')).toBe('ENDPOINT_SECURE');
    expect(mapSolutionToProduct('Anti-Spam')).toBe('IAG');
    expect(mapSolutionToProduct('Backup Management')).toBe('SYSTEM');
  });
});
```

### 3.2 통합 테스트
```typescript
describe('Excel Parsing Integration', () => {
  it('should parse real ITAC Excel file', async () => {
    const result = await parseExcelFile('outputs/hyundai-audit.xlsx');
    
    expect(result.requirements.length).toBe(18);  // Result 있는 항목만
    expect(result.products).toContain('ENDPOINT_SECURE');
    expect(result.products).toContain('IAG');
    expect(result.products).toContain('CYBER_COMMAND');
  });
});
```

---

## 4. 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `packages/workflow-engine/src/excel-parser.ts` | 신규 생성 |
| `packages/workflow-engine/src/index.ts` | export 추가 |
| `tests/excel-parser.test.ts` | 신규 생성 |

---

## 5. 검증 방법

```bash
# 1. 단위 테스트
pnpm test -- --grep "Excel Parser"

# 2. 통합 테스트
pnpm test -- --grep "Excel Parsing Integration"

# 3. 수동 검증
node -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile('outputs/hyundai-audit.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header: 1});
const rows = parseExcelWithResultFilter(data);
console.log('Result 있는 항목:', rows.length, '개');
"
```

---

## 6. 완료 조건

- [ ] Result 컬럼이 있는 항목만 추출
- [ ] Solution → 제품 매핑 정상 동작
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] 실제 Excel 파일로 검증 완료
