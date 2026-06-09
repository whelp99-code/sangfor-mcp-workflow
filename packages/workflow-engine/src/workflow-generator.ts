/**
 * Workflow Generator — AI 기반 동적 워크플로우 생성기
 */

import { nowId, nowISO, createLogger, normalizeProduct } from '@sangfor/workflow-shared';
import type {
  CustomerProfile,
  Requirement,
  SimilarCase,
  Workflow,
  WorkflowStep,
  ToolDefinition,
  ToolDependency,
  ProjectInput,
  ProductCode,
} from './types.js';
import { ToolRegistry, createDefaultToolDefinitions } from './tool-registry.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';

const log = createLogger('workflow-generator');

export class WorkflowGenerator {
  private toolRegistry: ToolRegistry;
  private dependencyAnalyzer: DependencyAnalyzer;
  private ragSearch?: (query: string) => Promise<any[]>;

  constructor(
    toolRegistry?: ToolRegistry,
    ragSearch?: (query: string) => Promise<any[]>
  ) {
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.ragSearch = ragSearch;

    // 기본 tool 등록
    if (!toolRegistry) {
      this.toolRegistry.registerAll(createDefaultToolDefinitions());
    }
  }

  // ─── 1단계: 입력 분석 ──────────────────────────────────────────────────────

  async analyzeInput(input: ProjectInput): Promise<CustomerProfile> {
    log.info(`Analyzing input for customer: ${input.customerName}`);

    // Excel 파싱 (mock)
    const excelRows = await this.parseExcel(input.excelFilePath);

    // 고객 요구사항 이해
    const requirements = this.extractRequirements(excelRows, input.requirements);

    // 제품 자동 감지
    const products = input.products || this.detectProducts(requirements);

    // RAG 검색으로 유사 사례 참고
    const similarCases = await this.searchSimilarCases(requirements);

    // 위험 수준 평가
    const riskLevel = this.assessRiskLevel(requirements);

    const profile: CustomerProfile = {
      customerName: input.customerName,
      products,
      requirements,
      environment: input.environment || 'customer',
      riskLevel,
      similarCases,
      metadata: {
        excelRows,
        inputRequirements: input.requirements,
      },
    };

    log.info(
      `Customer profile created: ${profile.products.length} products, ${profile.requirements.length} requirements`
    );

    return profile;
  }

  // Excel 파싱 (mock)
  private async parseExcel(filePath: string): Promise<any[]> {
    // TODO: sangfor-engineer-mcp의 import_excel_requirement_list 연동
    log.info(`Parsing Excel: ${filePath}`);
    return [];
  }

  // 요구사항 추출
  private extractRequirements(excelRows: any[], additionalReqs?: string[]): Requirement[] {
    const requirements: Requirement[] = [];

    // Excel에서 추출
    for (const row of excelRows) {
      requirements.push({
        id: nowId('req'),
        text: row.description || row.setting || '',
        product: normalizeProduct(row.product || 'HCI_SCP'),
        category: row.category || 'general',
        priority: row.priority || 'medium',
      });
    }

    // 추가 요구사항
    if (additionalReqs) {
      for (const req of additionalReqs) {
        requirements.push({
          id: nowId('req'),
          text: req,
          product: 'HCI_SCP', // 기본값
          category: 'additional',
          priority: 'medium',
        });
      }
    }

    return requirements;
  }

  // 제품 자동 감지
  private detectProducts(requirements: Requirement[]): ProductCode[] {
    const products = new Set<ProductCode>();

    for (const req of requirements) {
      products.add(req.product);
    }

    // 기본 제품 추가
    if (products.size === 0) {
      products.add('IAG');
    }

    return Array.from(products);
  }

  // 유사 사례 검색
  private async searchSimilarCases(requirements: Requirement[]): Promise<SimilarCase[]> {
    if (!this.ragSearch) {
      return [];
    }

    try {
      const query = requirements.map((r) => r.text).join(' ');
      const results = await this.ragSearch(query);

      return results.map((r) => ({
        id: r.id || nowId('case'),
        customerName: r.customerName || 'Unknown',
        products: r.products || [],
        requirements: r.requirements || [],
        outcome: r.outcome || '',
        relevance: r.score || 0.5,
      }));
    } catch (error) {
      log.warn(`RAG search failed: ${error}`);
      return [];
    }
  }

  // 위험 수준 평가
  private assessRiskLevel(requirements: Requirement[]): 'low' | 'medium' | 'high' | 'critical' {
    const highPriorityCount = requirements.filter(
      (r) => r.priority === 'high' || r.priority === 'critical'
    ).length;

    if (highPriorityCount > 5) return 'critical';
    if (highPriorityCount > 3) return 'high';
    if (highPriorityCount > 1) return 'medium';
    return 'low';
  }

  // ─── 2단계: 워크플로우 생성 ────────────────────────────────────────────────

  async generateWorkflow(profile: CustomerProfile): Promise<Workflow> {
    log.info(`Generating workflow for: ${profile.customerName}`);

    // 사용 가능한 tools 목록 조회
    const availableTools = this.toolRegistry.listTools();

    // 고객 프로필 기반 tool 선정
    const selectedTools = await this.selectTools(profile, availableTools);

    // tool 간 의존성 분석
    const dependencies = this.dependencyAnalyzer.analyzeDependencies(selectedTools);

    // 의존성 검증
    const validation = this.dependencyAnalyzer.validateDependencies(selectedTools, dependencies);
    if (!validation.valid) {
      log.warn(`Dependency validation warnings: ${validation.errors.join(', ')}`);
    }

    // 실행 순서 결정 (의존성 기반 토폴로지 정렬)
    const orderedSteps = this.topologicalSort(selectedTools, dependencies, profile);

    // 워크플로우 생성 이유(reasoning) 기록
    const reasoning = this.generateReasoning(profile, selectedTools, dependencies);

    // 예상 시간/비용 산출
    const estimatedDuration = this.estimateDuration(orderedSteps);
    const estimatedCost = this.estimateCost(orderedSteps);

    const workflow: Workflow = {
      id: nowId('workflow'),
      name: `${profile.customerName} 프로젝트 워크플로우`,
      description: this.generateDescription(profile, selectedTools),
      customerProfile: profile,
      steps: orderedSteps,
      reasoning,
      estimatedDuration,
      estimatedCost,
      status: 'draft',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    log.info(`Workflow generated: ${workflow.steps.length} steps, ~${estimatedDuration}`);
    return workflow;
  }

  // tool 선정 로직
  private async selectTools(
    profile: CustomerProfile,
    availableTools: ToolDefinition[]
  ): Promise<ToolDefinition[]> {
    const selected: ToolDefinition[] = [];
    const selectedNames = new Set<string>();

    // 1. 필수 tools (항상 포함)
    const requiredToolNames = ['import_excel', 'analyze_requirements', 'generate_evidence_report'];
    for (const name of requiredToolNames) {
      const tool = availableTools.find((t) => t.name === name);
      if (tool && !selectedNames.has(name)) {
        selected.push(tool);
        selectedNames.add(name);
      }
    }

    // 2. 제품별 tools
    for (const product of profile.products) {
      const productTools = availableTools.filter(
        (t) =>
          (t.tags.includes(product.toLowerCase()) || t.tags.includes('product-agnostic')) &&
          !selectedNames.has(t.name)
      );
      for (const tool of productTools) {
        selected.push(tool);
        selectedNames.add(tool.name);
      }
    }

    // 3. 유사 사례 기반 추가 tools
    for (const similarCase of profile.similarCases) {
      const caseTools = availableTools.filter(
        (t) =>
          similarCase.outcome.includes(t.name) &&
          !selectedNames.has(t.name)
      );
      for (const tool of caseTools) {
        selected.push(tool);
        selectedNames.add(tool.name);
      }
    }

    // 4. 요구사항 기반 추가 tools
    const hasScreenshots = profile.requirements.some(
      (r) => r.text.includes('스크린샷') || r.text.includes('캡처') || r.text.includes('screenshot')
    );
    if (hasScreenshots) {
      const screenshotTool = availableTools.find((t) => t.name === 'capture_screenshots');
      if (screenshotTool && !selectedNames.has('capture_screenshots')) {
        selected.push(screenshotTool);
        selectedNames.add('capture_screenshots');
      }
    }

    log.info(`Selected ${selected.length} tools: ${selected.map((t) => t.name).join(', ')}`);
    return selected;
  }

  // 토폴로지 정렬 (의존성 기반 실행 순서 결정)
  private topologicalSort(
    tools: ToolDefinition[],
    dependencies: ToolDependency[],
    profile: CustomerProfile
  ): WorkflowStep[] {
    // 의존성 그래프 구축
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const tool of tools) {
      graph.set(tool.name, new Set());
      inDegree.set(tool.name, 0);
    }

    for (const dep of dependencies) {
      if (graph.has(dep.sourceTool) && graph.has(dep.targetTool)) {
        graph.get(dep.targetTool)!.add(dep.sourceTool);
        inDegree.set(dep.sourceTool, (inDegree.get(dep.sourceTool) || 0) + 1);
      }
    }

    // 위상 정렬 (Kahn's algorithm)
    const queue: string[] = [];
    for (const [tool, degree] of inDegree) {
      if (degree === 0) queue.push(tool);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const neighbor of graph.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    // WorkflowStep 배열 생성
    return sorted.map((toolName) => {
      const tool = tools.find((t) => t.name === toolName)!;
      const deps = dependencies.filter((d) => d.sourceTool === toolName);

      return {
        id: nowId('step'),
        name: tool.description,
        description: `${tool.description} 실행`,
        toolName: tool.name,
        toolArgs: this.generateDefaultArgs(tool, profile),
        dependsOn: deps.map((d) => d.targetTool),
        optional: !tool.requiresApproval,
        retryPolicy: {
          maxRetries: 2,
          backoff: 'exponential',
          retryOn: ['timeout', 'error'],
        },
        status: 'pending' as const,
      };
    });
  }

  // 기본 인자 생성
  private generateDefaultArgs(tool: ToolDefinition, profile: CustomerProfile): Record<string, any> {
    const args: Record<string, any> = {};

    // tool별 기본 인자
    switch (tool.name) {
      case 'import_excel':
        args.filePath = profile.metadata.excelFilePath || '';
        break;
      case 'analyze_requirements':
        args.requirements = profile.requirements.map((r) => r.text);
        args.products = profile.products;
        break;
      case 'generate_change_plan':
        args.products = profile.products;
        args.customerName = profile.customerName;
        break;
      case 'capture_screenshots':
        args.products = profile.products;
        break;
      case 'generate_evidence_report':
        args.customerName = profile.customerName;
        break;
    }

    return args;
  }

  // reasoning 생성
  private generateReasoning(
    profile: CustomerProfile,
    selectedTools: ToolDefinition[],
    dependencies: ToolDependency[]
  ): string {
    const lines: string[] = [];

    lines.push(`## 고객 분석`);
    lines.push(`- 고객명: ${profile.customerName}`);
    lines.push(`- 대상 제품: ${profile.products.join(', ')}`);
    lines.push(`- 요구사항 수: ${profile.requirements.length}`);
    lines.push(`- 환경: ${profile.environment}`);
    lines.push(`- 위험 수준: ${profile.riskLevel}`);
    lines.push('');

    lines.push(`## 선택된 tools (${selectedTools.length}개)`);
    for (const tool of selectedTools) {
      lines.push(`- ${tool.name}: ${tool.description}`);
    }
    lines.push('');

    lines.push(`## 의존성 (${dependencies.length}개)`);
    for (const dep of dependencies) {
      lines.push(`- ${dep.targetTool} → ${dep.sourceTool} (${dep.required ? '필수' : '선택'})`);
    }
    lines.push('');

    if (profile.similarCases.length > 0) {
      lines.push(`## 유사 사례 (${profile.similarCases.length}개)`);
      for (const case_ of profile.similarCases.slice(0, 3)) {
        lines.push(`- ${case_.customerName}: ${case_.outcome} (유사도: ${case_.relevance})`);
      }
    }

    return lines.join('\n');
  }

  // 설명 생성
  private generateDescription(profile: CustomerProfile, selectedTools: ToolDefinition[]): string {
    return `${profile.customerName} 프로젝트를 위한 자동화 워크플로우. ${profile.products.join(', ')} 제품에 대한 설정 가이드 생성, 실장비 검증, 보고서 생성을 포함합니다.`;
  }

  // 예상 시간 산출
  private estimateDuration(steps: WorkflowStep[]): string {
    const totalSeconds = steps.reduce((sum, step) => {
      const tool = this.toolRegistry.getTool(step.toolName);
      if (!tool) return sum;
      const duration = parseInt(tool.estimatedDuration) || 10;
      return sum + duration;
    }, 0);

    if (totalSeconds < 60) return `${totalSeconds}초`;
    if (totalSeconds < 3600) return `${Math.ceil(totalSeconds / 60)}분`;
    return `${Math.ceil(totalSeconds / 3600)}시간`;
  }

  // 예상 비용 산출
  private estimateCost(steps: WorkflowStep[]): string {
    // 간단한 추정: step 수 * 평균 토큰
    const avgTokensPerStep = 1000;
    const totalTokens = steps.length * avgTokensPerStep;
    return `~${totalTokens} tokens`;
  }
}
