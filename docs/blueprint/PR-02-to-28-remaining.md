# PR-02 ~ PR-28: 나머지 PR 지시서

**Phase**: 1-6  
**총 PR 수**: 27개  
**예상 기간**: 13주

---

## PR-02: Compliance 이력 저장/조회 (Phase 1)

### 목표
Compliance 이력 저장 및 조회 기능 구현

### 상세
```typescript
class ComplianceDB {
  private records: Map<string, ComplianceRecord[]>;
  
  // 이력 저장
  saveRecord(record: ComplianceRecord): void {
    const key = `${record.customer}-${record.product}`;
    const records = this.records.get(key) || [];
    records.push(record);
    this.records.set(key, records);
    this.persistToDisk();
  }
  
  // 이력 조회
  getRecords(customer: string, product?: string): ComplianceRecord[] {
    if (product) {
      return this.records.get(`${customer}-${product}`) || [];
    }
    // 고객의 모든 제품 이력 조회
    const allRecords: ComplianceRecord[] = [];
    for (const [key, records] of this.records) {
      if (key.startsWith(customer)) {
        allRecords.push(...records);
      }
    }
    return allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  
  // 최신 기록 조회
  getLatestRecord(customer: string, product?: string): ComplianceRecord | null {
    const records = this.getRecords(customer, product);
    return records.length > 0 ? records[0] : null;
  }
  
  // 디스크 영속화
  private persistToDisk(): void {
    const data = Object.fromEntries(this.records);
    writeFileSync('data/compliance/records.json', JSON.stringify(data, null, 2));
  }
}
```

### 파일 변경
- `packages/workflow-engine/src/compliance-db.ts`
- `tests/compliance-db.test.ts`

### 완료 조건
- [ ] 이력 저장 동작 확인
- [ ] 이력 조회 동작 확인
- [ ] 디스크 영속화 확인
- [ ] 단위 테스트 통과

---

## PR-03: Compliance 변화 감지 (Phase 1)

### 목표
Compliance 변화 감지 기능 구현

### 상세
```typescript
class ComplianceChangeDetector {
  // 변화 감지
  detectChanges(
    previous: ComplianceRecord,
    current: ComplianceAnalysis
  ): ComplianceChange[] {
    const changes: ComplianceChange[] = [];
    
    for (const currentItem of current.items) {
      const previousItem = previous.items.find(i => i.id === currentItem.id);
      
      if (previousItem) {
        const change = currentItem.result - previousItem.result;
        if (change !== 0) {
          changes.push({
            itemId: currentItem.id,
            category: currentItem.category,
            item: currentItem.item,
            previousResult: previousItem.result,
            currentResult: currentItem.result,
            change,
            reason: this.determineReason(change),
          });
        }
      }
    }
    
    return changes;
  }
  
  private determineReason(change: number): string {
    if (change > 0) return '개선';
    if (change < 0) return '악화';
    return '변화 없음';
  }
}
```

### 파일 변경
- `packages/workflow-engine/src/compliance-change-detector.ts`
- `tests/compliance-change-detector.test.ts`

### 완료 조건
- [ ] 변화 감지 정확도 확인
- [ ] 변화 사유 분석 확인
- [ ] 단위 테스트 통과

---

## PR-04: Compliance 추이 분석 (Phase 1)

### 목표
Compliance 추이 분석 기능 구현

### 상세
```typescript
class ComplianceTrendAnalyzer {
  // 추이 분석
  analyzeTrend(
    records: ComplianceRecord[],
    period: 'daily' | 'weekly' | 'monthly'
  ): ComplianceTrend {
    const sorted = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (sorted.length < 2) {
      return {
        customer: sorted[0]?.customer || '',
        product: sorted[0]?.product || '',
        period,
        records: sorted,
        trend: 'stable',
        changeRate: 0,
        summary: '데이터 부족',
      };
    }
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const changeRate = (last.compliance - first.compliance) / sorted.length;
    
    let trend: 'improving' | 'stable' | 'declining';
    if (changeRate > 0.05) trend = 'improving';
    else if (changeRate < -0.05) trend = 'declining';
    else trend = 'stable';
    
    return {
      customer: last.customer,
      product: last.product,
      period,
      records: sorted,
      trend,
      changeRate,
      summary: this.generateSummary(trend, changeRate, first.compliance, last.compliance),
    };
  }
  
  private generateSummary(trend: string, changeRate: number, first: number, last: number): string {
    const trendKr = trend === 'improving' ? '개선' : trend === 'declining' ? '악화' : '안정';
    return `Compliance ${trendKr} 추이: ${first}% → ${last}% (변화율: ${(changeRate * 100).toFixed(1)}%)`;
  }
}
```

### 파일 변경
- `packages/workflow-engine/src/compliance-trend-analyzer.ts`
- `tests/compliance-trend-analyzer.test.ts`

### 완료 조건
- [ ] 추이 분석 정확도 확인
- [ ] 요약 생성 확인
- [ ] 단위 테스트 통과

---

## PR-05: MCP tools 추가 (Phase 1)

### 목표
Phase 1 MCP tools 추가

### 상세
```typescript
const phase1Tools = {
  'sangfor_workflow.track_compliance': {
    description: 'Compliance 이력을 저장합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        product: { type: 'string', description: '제품' },
        compliance: { type: 'number', description: 'Compliance 점수' },
        items: { type: 'array', description: '감사항목 목록' },
      },
      required: ['customer', 'product', 'compliance'],
    },
    handler: async (args) => {
      const tracker = new ComplianceTracker();
      tracker.saveRecord(args);
      return { success: true };
    },
  },
  
  'sangfor_workflow.get_compliance_trend': {
    description: 'Compliance 추이를 분석합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        product: { type: 'string', description: '제품' },
        period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const tracker = new ComplianceTracker();
      const records = tracker.getRecords(args.customer, args.product);
      const analyzer = new ComplianceTrendAnalyzer();
      return analyzer.analyzeTrend(records, args.period || 'monthly');
    },
  },
  
  'sangfor_workflow.detect_compliance_changes': {
    description: 'Compliance 변화를 감지합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        product: { type: 'string', description: '제품' },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const tracker = new ComplianceTracker();
      const previous = tracker.getLatestRecord(args.customer, args.product);
      if (!previous) return { error: '이전 기록 없음' };
      
      const current = await analyzeExcelFile(previous.filePath);
      const detector = new ComplianceChangeDetector();
      return detector.detectChanges(previous, current);
    },
  },
};
```

### 파일 변경
- `apps/mcp-server/src/index.ts`

### 완료 조건
- [ ] 3개 MCP tools 동작 확인
- [ ] 타입 검증 통과
- [ ] 테스트 통과

---

## PR-06 ~ PR-09: 개선 로드맵 자동 생성 (Phase 2)

### PR-06: ImprovementRoadmap 인터페이스 설계

#### 상세
```typescript
interface ImprovementRoadmap {
  customer: string;
  currentCompliance: number;
  targetCompliance: number;
  phases: ImprovementPhase[];
  estimatedDuration: string;
  estimatedCost: string;
  summary: string;
}

interface ImprovementPhase {
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
```

#### 파일 변경
- `packages/workflow-engine/src/improvement-roadmap.ts`
- `tests/improvement-roadmap.test.ts`

### PR-07: Phase별 개선 계획 생성

#### 상세
```typescript
class RoadmapGenerator {
  generateRoadmap(
    customer: string,
    currentAnalysis: ComplianceAnalysis,
    targetCompliance: number
  ): ImprovementRoadmap {
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
      
      const improvement = this.calculateImprovement(items);
      expectedCompliance = Math.min(100, expectedCompliance + improvement);
      
      phases.push({
        phase: phaseNumber++,
        title: `${product} 적용`,
        items: items.map(i => i.item),
        solution: this.getSangforSolution(product),
        expectedCompliance,
        timeline: `${Math.ceil(items.length / 3)}주`,
        prerequisites: phaseNumber > 1 ? [`Phase ${phaseNumber - 1} 완료`] : [],
        sangforProduct: product,
        sangforFeatures: this.getSangforFeatures(product),
      });
    }
    
    return {
      customer,
      currentCompliance: currentAnalysis.currentCompliance,
      targetCompliance,
      phases,
      estimatedDuration: `${phases.reduce((sum, p) => sum + parseInt(p.timeline), 0)}주`,
      estimatedCost: this.estimateCost(phases),
      summary: this.generateSummary(currentAnalysis.currentCompliance, targetCompliance, phases),
    };
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/roadmap-generator.ts`
- `tests/roadmap-generator.test.ts`

### PR-08: Compliance 예측 알고리즘

#### 상세
```typescript
class CompliancePredictor {
  predict(
    current: ComplianceAnalysis,
    roadmap: ImprovementRoadmap
  ): number {
    let predicted = current.currentCompliance;
    
    for (const phase of roadmap.phases) {
      const improvement = this.calculatePhaseImprovement(phase, current);
      predicted = Math.min(100, predicted + improvement);
    }
    
    return predicted;
  }
  
  private calculatePhaseImprovement(phase: ImprovementPhase, current: ComplianceAnalysis): number {
    // Sangfor 제품별 효과 계산
    const productEffectiveness = this.getProductEffectiveness(phase.sangforProduct);
    const itemsImpact = phase.items.length / current.totalItems * 100;
    
    return itemsImpact * productEffectiveness;
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/compliance-predictor.ts`
- `tests/compliance-predictor.test.ts`

### PR-09: MCP tools 추가 (Phase 2)

#### 상세
```typescript
const phase2Tools = {
  'sangfor_workflow.generate_improvement_roadmap': {
    description: '개선 로드맵을 자동 생성합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        targetCompliance: { type: 'number', description: '목표 Compliance' },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const tracker = new ComplianceTracker();
      const current = tracker.getLatestRecord(args.customer);
      if (!current) return { error: '현재 Compliance 데이터 없음' };
      
      const generator = new RoadmapGenerator();
      return generator.generateRoadmap(args.customer, current, args.targetCompliance || 87);
    },
  },
  
  'sangfor_workflow.predict_compliance': {
    description: '로드맵 기반 Compliance를 예측합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        roadmap: { type: 'object', description: '개선 로드맵' },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const tracker = new ComplianceTracker();
      const current = tracker.getLatestRecord(args.customer);
      if (!current) return { error: '현재 Compliance 데이터 없음' };
      
      const predictor = new CompliancePredictor();
      return { predictedCompliance: predictor.predict(current, args.roadmap) };
    },
  },
};
```

#### 파일 변경
- `apps/mcp-server/src/index.ts`

---

## PR-10 ~ PR-13: 고객 제안서 자동 생성 (Phase 3)

### PR-10: CustomerProposal 인터페이스 설계

#### 상세
```typescript
interface CustomerProposal {
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
```

#### 파일 변경
- `packages/workflow-engine/src/customer-proposal.ts`
- `tests/customer-proposal.test.ts`

### PR-11: 제안서 템플릿 생성

#### 상세
```typescript
class ProposalTemplate {
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
}
```

#### 파일 변경
- `packages/workflow-engine/src/proposal-template.ts`
- `tests/proposal-template.test.ts`

### PR-12: 제안서 자동 생성 로직

#### 상세
```typescript
class ProposalGenerator {
  generate(
    customer: string,
    currentAnalysis: ComplianceAnalysis,
    roadmap: ImprovementRoadmap
  ): CustomerProposal {
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
}
```

#### 파일 변경
- `packages/workflow-engine/src/proposal-generator.ts`
- `tests/proposal-generator.test.ts`

### PR-13: MCP tools 추가 (Phase 3)

#### 상세
```typescript
const phase3Tools = {
  'sangfor_workflow.generate_customer_proposal': {
    description: '고객 제안서를 자동 생성합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        targetCompliance: { type: 'number', description: '목표 Compliance' },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const tracker = new ComplianceTracker();
      const current = tracker.getLatestRecord(args.customer);
      if (!current) return { error: '현재 Compliance 데이터 없음' };
      
      const generator = new RoadmapGenerator();
      const roadmap = generator.generateRoadmap(args.customer, current, args.targetCompliance || 87);
      
      const proposalGenerator = new ProposalGenerator();
      return proposalGenerator.generate(args.customer, current, roadmap);
    },
  },
  
  'sangfor_workflow.export_proposal_markdown': {
    description: '제안서를 Markdown으로 내보냅니다.',
    inputSchema: {
      type: 'object',
      properties: {
        proposal: { type: 'object', description: '제안서 객체' },
        outputPath: { type: 'string', description: '출력 경로' },
      },
      required: ['proposal'],
    },
    handler: async (args) => {
      const template = new ProposalTemplate();
      const markdown = template.generateMarkdown(args.proposal);
      
      if (args.outputPath) {
        writeFileSync(args.outputPath, markdown);
        return { success: true, path: args.outputPath };
      }
      
      return { markdown };
    },
  },
};
```

#### 파일 변경
- `apps/mcp-server/src/index.ts`

---

## PR-14 ~ PR-18: Sangfor 설정 자동화 (Phase 4)

### PR-14: SangforAutoConfig 인터페이스 설계

#### 상세
```typescript
interface SangforAutoConfig {
  // 감사항목 → Sangfor 설정 매핑
  auditItemToConfig: Map<string, SangforConfig>;
  
  // 자동 설정 실행
  applyConfig(product: string, config: SangforConfig): Promise<ConfigResult>;
  
  // 설정 검증
  verifyConfig(product: string, config: SangforConfig): Promise<VerificationResult>;
}

interface SangforConfig {
  product: 'EPP' | 'IAG' | 'CC';
  feature: string;
  menuPath: string[];
  settings: Record<string, any>;
  prerequisites: string[];
  validation: {
    method: 'api' | 'webui' | 'manual';
    criteria: string[];
  };
}

interface ConfigResult {
  success: boolean;
  appliedSettings: Record<string, any>;
  errors: string[];
  warnings: string[];
}

interface VerificationResult {
  verified: boolean;
  passedCriteria: string[];
  failedCriteria: string[];
  evidence: string[];
}
```

#### 파일 변경
- `packages/workflow-engine/src/sangfor-auto-config.ts`
- `tests/sangfor-auto-config.test.ts`

### PR-15: 감사항목 → Sangfor 설정 매핑

#### 상세
```typescript
class AuditToConfigMapper {
  private mappingData: Record<string, SangforConfig>;
  
  constructor() {
    this.mappingData = this.loadMappingData();
  }
  
  // 감사항목으로 Sangfor 설정 조회
  findByAuditItem(auditItem: string): SangforConfig | null {
    return this.mappingData[auditItem] || null;
  }
  
  // Solution으로 Sangfor 설정 조회
  findBySolution(solution: string): SangforConfig[] {
    return Object.values(this.mappingData).filter(c => c.product === this.solutionToProduct(solution));
  }
  
  private solutionToProduct(solution: string): string {
    const mapping: Record<string, string> = {
      'Anti-Virus': 'EPP',
      'Software Control': 'EPP',
      'Device Control': 'EPP',
      'Anti-Spam': 'IAG',
      'Data Loss Prevention': 'IAG',
      'Network Access Contro': 'IAG',
      'Log Management': 'CC',
      'Security Monitoring': 'CC',
    };
    return mapping[solution] || 'UNKNOWN';
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/audit-to-config-mapper.ts`
- `data/configs/audit-to-config-mapping.json`
- `tests/audit-to-config-mapper.test.ts`

### PR-16: 설정 자동 적용 로직

#### 상세
```typescript
class ConfigApplier {
  async applyConfig(product: string, config: SangforConfig): Promise<ConfigResult> {
    // 1. 사전 조건 확인
    const prerequisitesMet = await this.checkPrerequisites(config.prerequisites);
    if (!prerequisitesMet) {
      return { success: false, appliedSettings: {}, errors: ['사전 조건 미충족'], warnings: [] };
    }
    
    // 2. 설정 적용
    const result = await this.applySettings(product, config);
    
    // 3. 결과 반환
    return result;
  }
  
  private async applySettings(product: string, config: SangforConfig): Promise<ConfigResult> {
    // TODO: sangfor-engineer-mcp의 execute_console_action 호출
    return { success: true, appliedSettings: config.settings, errors: [], warnings: [] };
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/config-applier.ts`
- `tests/config-applier.test.ts`

### PR-17: 설정 검증 로직

#### 상세
```typescript
class ConfigVerifier {
  async verifyConfig(product: string, config: SangforConfig): Promise<VerificationResult> {
    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const evidence: string[] = [];
    
    for (const criterion of config.validation.criteria) {
      const passed = await this.checkCriterion(product, criterion);
      if (passed) {
        passedCriteria.push(criterion);
      } else {
        failedCriteria.push(criterion);
      }
    }
    
    return {
      verified: failedCriteria.length === 0,
      passedCriteria,
      failedCriteria,
      evidence,
    };
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/config-verifier.ts`
- `tests/config-verifier.test.ts`

### PR-18: MCP tools 추가 (Phase 4)

#### 상세
```typescript
const phase4Tools = {
  'sangfor_workflow.apply_sangfor_config': {
    description: 'Sangfor 설정을 자동 적용합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', enum: ['EPP', 'IAG', 'CC'] },
        auditItem: { type: 'string', description: '감사항목' },
      },
      required: ['product', 'auditItem'],
    },
    handler: async (args) => {
      const mapper = new AuditToConfigMapper();
      const config = mapper.findByAuditItem(args.auditItem);
      if (!config) return { error: '설정 매핑 없음' };
      
      const applier = new ConfigApplier();
      return applier.applyConfig(args.product, config);
    },
  },
  
  'sangfor_workflow.verify_sangfor_config': {
    description: 'Sangfor 설정을 검증합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', enum: ['EPP', 'IAG', 'CC'] },
        auditItem: { type: 'string', description: '감사항목' },
      },
      required: ['product', 'auditItem'],
    },
    handler: async (args) => {
      const mapper = new AuditToConfigMapper();
      const config = mapper.findByAuditItem(args.auditItem);
      if (!config) return { error: '설정 매핑 없음' };
      
      const verifier = new ConfigVerifier();
      return verifier.verifyConfig(args.product, config);
    },
  },
};
```

#### 파일 변경
- `apps/mcp-server/src/index.ts`

---

## PR-19 ~ PR-23: 실장비 검증 자동화 (Phase 5)

### PR-19: AutoVerification 인터페이스 설계

#### 상세
```typescript
interface AutoVerification {
  // 설정 적용 후 자동 검증
  verifyAfterConfig(product: string, config: SangforConfig): Promise<VerificationResult>;
  
  // Compliance 업데이트
  updateCompliance(customer: string, verificationResults: VerificationResult[]): void;
  
  // 보고서 생성
  generateVerificationReport(results: VerificationResult[]): string;
}
```

#### 파일 변경
- `packages/workflow-engine/src/auto-verification.ts`
- `tests/auto-verification.test.ts`

### PR-20: 설정 적용 후 자동 검증

#### 상세
```typescript
class VerificationRunner {
  async runVerification(product: string, config: SangforConfig): Promise<VerificationResult> {
    // 1. 설정 적용
    const applier = new ConfigApplier();
    const configResult = await applier.applyConfig(product, config);
    
    if (!configResult.success) {
      return { verified: false, passedCriteria: [], failedCriteria: config.validation.criteria, evidence: [] };
    }
    
    // 2. 검증 실행
    const verifier = new ConfigVerifier();
    const verificationResult = await verifier.verifyConfig(product, config);
    
    // 3. Compliance 업데이트
    await this.updateCompliance(product, config, verificationResult);
    
    return verificationResult;
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/verification-runner.ts`
- `tests/verification-runner.test.ts`

### PR-21: Compliance 자동 업데이트

#### 상세
```typescript
class ComplianceUpdater {
  async update(
    customer: string,
    product: string,
    verificationResults: VerificationResult[]
  ): Promise<void> {
    const tracker = new ComplianceTracker();
    const current = tracker.getLatestRecord(customer, product);
    if (!current) return;
    
    // 검증 결과를 Compliance 항목에 반영
    const updatedItems = current.items.map(item => {
      const verification = verificationResults.find(v => 
        v.passedCriteria.some(c => item.item.includes(c))
      );
      
      if (verification && verification.verified) {
        return { ...item, result: 1, improved: true };
      }
      return item;
    });
    
    // Compliance 재계산
    const passedItems = updatedItems.filter(i => i.result === 1).length;
    const compliance = Math.round((passedItems / updatedItems.length) * 100);
    
    // 새 기록 저장
    tracker.saveRecord({
      ...current,
      id: nowId('record'),
      date: nowISO(),
      compliance,
      passedItems,
      items: updatedItems,
    });
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/compliance-updater.ts`
- `tests/compliance-updater.test.ts`

### PR-22: 검증 보고서 생성

#### 상세
```typescript
class VerificationReportGenerator {
  generate(results: VerificationResult[]): string {
    const lines: string[] = [];
    
    lines.push('# 검증 보고서');
    lines.push('');
    lines.push(`생성일: ${new Date().toLocaleDateString('ko-KR')}`);
    lines.push('');
    
    lines.push('## 검증 결과 요약');
    lines.push('');
    lines.push(`- 전체 검증: ${results.length}건`);
    lines.push(`- 통과: ${results.filter(r => r.verified).length}건`);
    lines.push(`- 실패: ${results.filter(r => !r.verified).length}건`);
    lines.push('');
    
    lines.push('## 상세 결과');
    lines.push('');
    for (const result of results) {
      lines.push(`### ${result.verified ? '✅' : '❌'} 검증`);
      lines.push(`- 통과 기준: ${result.passedCriteria.join(', ')}`);
      if (result.failedCriteria.length > 0) {
        lines.push(`- 실패 기준: ${result.failedCriteria.join(', ')}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/verification-report.ts`
- `tests/verification-report.test.ts`

### PR-23: MCP tools 추가 (Phase 5)

#### 상세
```typescript
const phase5Tools = {
  'sangfor_workflow.run_auto_verification': {
    description: '설정 적용 후 자동 검증을 실행합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', enum: ['EPP', 'IAG', 'CC'] },
        auditItem: { type: 'string', description: '감사항목' },
        customer: { type: 'string', description: '고객사명' },
      },
      required: ['product', 'auditItem', 'customer'],
    },
    handler: async (args) => {
      const mapper = new AuditToConfigMapper();
      const config = mapper.findByAuditItem(args.auditItem);
      if (!config) return { error: '설정 매핑 없음' };
      
      const runner = new VerificationRunner();
      const result = await runner.runVerification(args.product, config);
      
      // Compliance 업데이트
      const updater = new ComplianceUpdater();
      await updater.update(args.customer, args.product, [result]);
      
      return result;
    },
  },
  
  'sangfor_workflow.generate_verification_report': {
    description: '검증 보고서를 생성합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array', description: '검증 결과 목록' },
      },
      required: ['results'],
    },
    handler: async (args) => {
      const generator = new VerificationReportGenerator();
      return generator.generate(args.results);
    },
  },
};
```

#### 파일 변경
- `apps/mcp-server/src/index.ts`

---

## PR-24 ~ PR-28: 지속적 모니터링 (Phase 6)

### PR-24: ComplianceMonitor 인터페이스 설계

#### 상세
```typescript
interface ComplianceMonitor {
  // 정기 점검
  scheduledCheck(customer: string): Promise<ComplianceAnalysis>;
  
  // 변화 감지
  detectChanges(previous: ComplianceAnalysis, current: ComplianceAnalysis): ComplianceChange[];
  
  // 알림 전송
  sendAlert(changes: ComplianceChange[]): void;
}
```

#### 파일 변경
- `packages/workflow-engine/src/compliance-monitor.ts`
- `tests/compliance-monitor.test.ts`

### PR-25: 정기 점검 스케줄러

#### 상세
```typescript
class ScheduledChecker {
  private schedule: Map<string, NodeJS.Timer> = new Map();
  
  // 정기 점검 등록
  scheduleCheck(customer: string, interval: number): void {
    const timer = setInterval(async () => {
      await this.runCheck(customer);
    }, interval);
    
    this.schedule.set(customer, timer);
  }
  
  // 정기 점검 실행
  async runCheck(customer: string): Promise<void> {
    const tracker = new ComplianceTracker();
    const previous = tracker.getLatestRecord(customer);
    
    // TODO: Excel 파일 다시 읽기
    const current = await this.reAnalyze(customer);
    
    if (previous && current) {
      const detector = new ComplianceChangeDetector();
      const changes = detector.detectChanges(previous, current);
      
      if (changes.length > 0) {
        const monitor = new ComplianceMonitor();
        monitor.sendAlert(changes);
      }
    }
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/scheduled-checker.ts`
- `tests/scheduled-checker.test.ts`

### PR-26: 변화 감지 알림

#### 상세
```typescript
class AlertSystem {
  // 알림 전송
  sendAlert(changes: ComplianceChange[]): void {
    const criticalChanges = changes.filter(c => c.change < -0.1);
    const improvements = changes.filter(c => c.change > 0.1);
    
    if (criticalChanges.length > 0) {
      this.sendCriticalAlert(criticalChanges);
    }
    
    if (improvements.length > 0) {
      this.sendImprovementAlert(improvements);
    }
  }
  
  private sendCriticalAlert(changes: ComplianceChange[]): void {
    // TODO: Hermes send_message 연동
    console.warn(`⚠️ Compliance 악화 감지: ${changes.length}건`);
  }
  
  private sendImprovementAlert(changes: ComplianceChange[]): void {
    console.log(`✅ Compliance 개선: ${changes.length}건`);
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/alert-system.ts`
- `tests/alert-system.test.ts`

### PR-27: 모니터링 대시보드

#### 상세
```typescript
class MonitoringDashboard {
  // 대시보드 데이터 조회
  getDashboardData(customer: string): DashboardData {
    const tracker = new ComplianceTracker();
    const records = tracker.getRecords(customer);
    const latest = tracker.getLatestRecord(customer);
    
    return {
      customer,
      currentCompliance: latest?.compliance || 0,
      trend: this.calculateTrend(records),
      recentChanges: this.getRecentChanges(records),
      alerts: this.getActiveAlerts(customer),
    };
  }
}
```

#### 파일 변경
- `packages/workflow-engine/src/monitoring-dashboard.ts`
- `tests/monitoring-dashboard.test.ts`

### PR-28: MCP tools 추가 (Phase 6)

#### 상세
```typescript
const phase6Tools = {
  'sangfor_workflow.schedule_compliance_check': {
    description: '정기 Compliance 점검을 스케줄링합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
        interval: { type: 'number', description: '점검 주기 (ms)' },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const checker = new ScheduledChecker();
      checker.scheduleCheck(args.customer, args.interval || 86400000); // 기본 1일
      return { success: true };
    },
  },
  
  'sangfor_workflow.get_monitoring_dashboard': {
    description: '모니터링 대시보드 데이터를 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: '고객사명' },
      },
      required: ['customer'],
    },
    handler: async (args) => {
      const dashboard = new MonitoringDashboard();
      return dashboard.getDashboardData(args.customer);
    },
  },
};
```

#### 파일 변경
- `apps/mcp-server/src/index.ts`

---

## 전체 일정 요약

| PR | Phase | 기간 | 의존성 |
|----|-------|------|--------|
| PR-01 | 1 | 2일 | - |
| PR-02 | 1 | 3일 | PR-01 |
| PR-03 | 1 | 2일 | PR-02 |
| PR-04 | 1 | 2일 | PR-02 |
| PR-05 | 1 | 1일 | PR-01~04 |
| PR-06 | 2 | 2일 | PR-01 |
| PR-07 | 2 | 3일 | PR-06 |
| PR-08 | 2 | 2일 | PR-06 |
| PR-09 | 2 | 1일 | PR-06~08 |
| PR-10 | 3 | 2일 | PR-06 |
| PR-11 | 3 | 3일 | PR-10 |
| PR-12 | 3 | 2일 | PR-10 |
| PR-13 | 3 | 1일 | PR-10~12 |
| PR-14 | 4 | 2일 | PR-01 |
| PR-15 | 4 | 3일 | PR-14 |
| PR-16 | 4 | 3일 | PR-14 |
| PR-17 | 4 | 2일 | PR-14 |
| PR-18 | 4 | 1일 | PR-14~17 |
| PR-19 | 5 | 2일 | PR-14 |
| PR-20 | 5 | 3일 | PR-19 |
| PR-21 | 5 | 2일 | PR-19 |
| PR-22 | 5 | 2일 | PR-19 |
| PR-23 | 5 | 1일 | PR-19~22 |
| PR-24 | 6 | 2일 | PR-01 |
| PR-25 | 6 | 3일 | PR-24 |
| PR-26 | 6 | 2일 | PR-24 |
| PR-27 | 6 | 3일 | PR-24 |
| PR-28 | 6 | 1일 | PR-24~27 |

**총 예상 기간**: 65일 (약 13주)
