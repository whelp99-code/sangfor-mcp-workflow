/**
 * AI Workflow Generator — LLM 기반 동적 워크플로우 생성기
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
import { ToolRegistry, createDefaultToolDefinitions, WORKFLOW_TOOL_NAMES } from './tool-registry.js';
import { buildWorkflowToolArgs } from './workflow-tool-args.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';
import { LLMClient, getLLMClient, type ChatMessage } from './llm-client.js';

const log = createLogger('ai-workflow-generator');

// ─── AI 워크플로우 생성기 ────────────────────────────────────────────────────

export class AIWorkflowGenerator {
  private toolRegistry: ToolRegistry;
  private dependencyAnalyzer: DependencyAnalyzer;
  private llm: LLMClient;
  private useAI: boolean = true; // AI 사용 여부 플래그

  constructor(toolRegistry?: ToolRegistry, llmConfig?: { baseUrl: string }) {
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.llm = getLLMClient(llmConfig);

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

    // 위험 수준 평가
    const riskLevel = this.assessRiskLevel(requirements);

    const profile: CustomerProfile = {
      customerName: input.customerName,
      products,
      requirements,
      environment: input.environment || 'customer',
      riskLevel,
      similarCases: [],
      metadata: {
        excelRows,
        inputRequirements: input.requirements,
      },
    };

    log.info(
      `Customer profile: ${profile.products.length} products, ${profile.requirements.length} requirements`
    );

    return profile;
  }

  // ─── 2단계: AI 기반 워크플로우 생성 ────────────────────────────────────────

  async generateWorkflow(profile: CustomerProfile): Promise<Workflow> {
    log.info(`Generating workflow for: ${profile.customerName}`);

    // LLM 연결 확인 (healthCheck만으로 충분)
    const isHealthy = await this.llm.healthCheck();

    let workflow: Workflow;

    if (isHealthy && this.useAI) {
      // AI 기반 생성
      log.info('✅ LLM available - Using AI-based workflow generation');
      workflow = await this.generateWithAI(profile);
    } else {
      // fallback: 규칙 기반
      if (!isHealthy) {
        log.warn('⚠️ LLM not available, falling back to rule-based generation');
      } else {
        log.info('ℹ️ AI generation disabled, using rule-based generation');
      }
      workflow = await this.generateWithRules(profile);
    }

    log.info(`Workflow generated: ${workflow.steps.length} steps (mode: ${workflow.reasoning?.includes('AI 기반') ? 'AI' : 'Rules'})`);
    return workflow;
  }

  // ─── AI 기반 생성 ──────────────────────────────────────────────────────────

  private async generateWithAI(profile: CustomerProfile): Promise<Workflow> {
    // 사용 가능한 tool 목록 생성
    const toolList = this.buildToolList();

    // 프롬프트 구성
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(profile, toolList);

    try {
      // LLM에게 워크플로우 생성 요청
      const aiResult = await this.llm.completeJSON<{
        selectedTools: string[];
        reasoning: string;
        stepOrder: string[];
        estimatedDuration: string;
        estimatedCost: string;
      }>(userPrompt, systemPrompt);

      log.info(`AI selected ${aiResult.selectedTools.length} tools: ${aiResult.selectedTools.join(', ')}`);

      // AI가 선택한 tool로 워크플로우 구성
      const allowedNames = new Set<string>(WORKFLOW_TOOL_NAMES);
      const selectedTools = aiResult.selectedTools
        .filter((name) => allowedNames.has(name) && !name.startsWith('sangfor.'))
        .map((name) => this.toolRegistry.getTool(name))
        .filter((t): t is ToolDefinition => t !== undefined);

      // 의존성 분석
      const dependencies = this.dependencyAnalyzer.analyzeDependencies(selectedTools);

      // AI가 제안한 순서 + 의존성 검증
      const orderedSteps = this.buildStepsFromAI(aiResult.stepOrder, selectedTools, dependencies, profile);

      return {
        id: nowId('workflow'),
        name: `${profile.customerName} 프로젝트 워크플로우`,
        description: `AI 기반 자동 생성 워크플로우. ${profile.products.join(', ')} 제품 설정.`,
        customerProfile: profile,
        steps: orderedSteps,
        reasoning: `## AI 기반 워크플로우 생성\n\n${aiResult.reasoning}`,
        estimatedDuration: aiResult.estimatedDuration,
        estimatedCost: aiResult.estimatedCost,
        status: 'draft',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
    } catch (error) {
      log.error(`AI generation failed: ${error}, falling back to rules`);
      return this.generateWithRules(profile);
    }
  }

  // ─── 규칙 기반 생성 (fallback) ─────────────────────────────────────────────

  private async generateWithRules(profile: CustomerProfile): Promise<Workflow> {
    const availableTools = this.toolRegistry.listWorkflowTools();
    const selectedTools = this.selectToolsByRules(profile, availableTools);
    const dependencies = this.dependencyAnalyzer.analyzeDependencies(selectedTools);
    const orderedSteps = this.topologicalSort(selectedTools, dependencies, profile);

    const reasoning = [
      `## 규칙 기반 워크플로우 생성 (LLM 미사용)`,
      `- 고객: ${profile.customerName}`,
      `- 제품: ${profile.products.join(', ')}`,
      `- 요구사항: ${profile.requirements.length}개`,
      `- 선택된 tool: ${selectedTools.map((t) => t.name).join(', ')}`,
    ].join('\n');

    return {
      id: nowId('workflow'),
      name: `${profile.customerName} 프로젝트 워크플로우`,
      description: `규칙 기반 워크플로우. ${profile.products.join(', ')} 제품 설정.`,
      customerProfile: profile,
      steps: orderedSteps,
      reasoning,
      estimatedDuration: `${orderedSteps.length * 2}분`,
      estimatedCost: `~${orderedSteps.length * 1000} tokens`,
      status: 'draft',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  }

  // ─── 프롬프트 구성 ─────────────────────────────────────────────────────────

  private buildSystemPrompt(): string {
    return `You are a Sangfor security product expert. Your job is to analyze customer requirements and create an optimal workflow using the available tools.

Rules:
1. Select ONLY the tools that are necessary for this customer's requirements
2. Do NOT include tools that are not relevant to the customer's products
3. Order tools based on dependencies (some tools need output from previous tools)
4. Provide clear reasoning for your tool selection
5. Estimate duration and cost realistically
6. Use ONLY tool names from the Available Tools list (5-9 tools typical; never select all tools)
7. NEVER use sangfor.* prefixed tool names — use alias names like import_excel, capture_screenshots

Output MUST be valid JSON with this structure:
{
  "selectedTools": ["tool_name_1", "tool_name_2", ...],
  "reasoning": "Explain why these tools were selected and in this order",
  "stepOrder": ["tool_name_1", "tool_name_2", ...],
  "estimatedDuration": "X분",
  "estimatedCost": "~N tokens"
}`;
  }

  private buildUserPrompt(profile: CustomerProfile, toolList: string): string {
    const requirementsText = profile.requirements.length > 0
      ? profile.requirements.map((r) => `- ${r.text} (${r.product}, ${r.priority})`).join('\n')
      : '- No specific requirements provided';

    return `## Customer Information
- Customer: ${profile.customerName}
- Products: ${profile.products.join(', ')}
- Environment: ${profile.environment}
- Risk Level: ${profile.riskLevel}

## Requirements
${requirementsText}

## Available Tools
${toolList}

## Tool Dependencies
- import_excel → analyze_requirements (required)
- analyze_requirements → generate_change_plan (required)
- generate_change_plan → generate_setting_guide_docx, generate_setting_guide_pptx (required)
- generate_setting_guide_docx → generate_evidence_report (required)
- capture_screenshots → generate_evidence_report (optional)

## Instructions
Select the optimal tools for this customer and create a workflow.
- If customer only needs IAG, do NOT include EPP/CC tools
- If no Excel file, skip import_excel
- If customer wants screenshots, include capture_screenshots
- Always include generate_evidence_report at the end
- Select 5-9 tools only; do not include every available tool
- Use alias tool names only (never sangfor.* prefixes)

Respond with JSON only.`;
  }

  private buildToolList(): string {
    const tools = this.toolRegistry.listWorkflowTools();
    return tools.map((t) =>
      `- ${t.name}: ${t.description} [category: ${t.category}, tags: ${t.tags.join(', ')}]`
    ).join('\n');
  }

  // ─── AI 결과 → WorkflowStep 변환 ──────────────────────────────────────────

  private buildStepsFromAI(
    stepOrder: string[],
    selectedTools: ToolDefinition[],
    dependencies: ToolDependency[],
    profile: CustomerProfile
  ): WorkflowStep[] {
    const toolMap = new Map(selectedTools.map((t) => [t.name, t]));
    const steps: WorkflowStep[] = [];

    for (const toolName of stepOrder) {
      const tool = toolMap.get(toolName);
      if (!tool) continue;

      const deps = dependencies
        .filter((d) => d.sourceTool === toolName)
        .map((d) => d.targetTool);

      steps.push({
        id: nowId('step'),
        name: tool.description,
        description: `${tool.description} 실행`,
        toolName: tool.name,
        toolArgs: buildWorkflowToolArgs(tool.name, profile),
        dependsOn: deps,
        optional: !tool.requiresApproval,
        retryPolicy: { maxRetries: 2, backoff: 'exponential', retryOn: ['timeout', 'error'] },
        status: 'pending',
      });
    }

    return steps;
  }

  // ─── 유틸리티 ──────────────────────────────────────────────────────────────

  private parseExcel(filePath: string): Promise<any[]> {
    log.info(`Parsing Excel: ${filePath}`);
    return Promise.resolve([]);
  }

  private extractRequirements(excelRows: any[], additionalReqs?: string[]): Requirement[] {
    const requirements: Requirement[] = [];

    for (const row of excelRows) {
      requirements.push({
        id: nowId('req'),
        text: row.description || row.setting || '',
        product: normalizeProduct(row.product || 'HCI_SCP'),
        category: row.category || 'general',
        priority: row.priority || 'medium',
      });
    }

    if (additionalReqs) {
      for (const req of additionalReqs) {
        requirements.push({
          id: nowId('req'),
          text: req,
          product: 'IAG',
          category: 'additional',
          priority: 'medium',
        });
      }
    }

    return requirements;
  }

  private detectProducts(requirements: Requirement[]): ProductCode[] {
    const products = new Set<ProductCode>();
    for (const req of requirements) {
      products.add(req.product);
    }
    if (products.size === 0) products.add('IAG');
    return Array.from(products);
  }

  private assessRiskLevel(requirements: Requirement[]): 'low' | 'medium' | 'high' | 'critical' {
    const highCount = requirements.filter((r) => r.priority === 'high' || r.priority === 'critical').length;
    if (highCount > 5) return 'critical';
    if (highCount > 3) return 'high';
    if (highCount > 1) return 'medium';
    return 'low';
  }

  private selectToolsByRules(profile: CustomerProfile, availableTools: ToolDefinition[]): ToolDefinition[] {
    const toolMap = new Map(availableTools.map((t) => [t.name, t]));
    const selected: ToolDefinition[] = [];
    const hasExcel = Boolean(profile.metadata?.excelFilePath);

    const coreOrder = [
      ...(hasExcel ? ['import_excel'] : []),
      'analyze_requirements',
      'generate_change_plan',
      'generate_setting_guide_docx',
      'generate_setting_guide_pptx',
      'capture_screenshots',
      'generate_evidence_report',
    ];

    for (const name of coreOrder) {
      const tool = toolMap.get(name);
      if (tool) selected.push(tool);
    }

    if (profile.products.length > 1) {
      for (const name of ['search_manuals', 'run_health_check']) {
        const tool = toolMap.get(name);
        if (tool) selected.push(tool);
      }
    }

    return selected;
  }

  private topologicalSort(tools: ToolDefinition[], dependencies: ToolDependency[], profile: CustomerProfile): WorkflowStep[] {
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

    return sorted.map((toolName) => {
      const tool = tools.find((t) => t.name === toolName)!;
      const deps = dependencies.filter((d) => d.sourceTool === toolName);
      return {
        id: nowId('step'),
        name: tool.description,
        description: `${tool.description} 실행`,
        toolName: tool.name,
        toolArgs: buildWorkflowToolArgs(tool.name, profile),
        dependsOn: deps.map((d) => d.targetTool),
        optional: !tool.requiresApproval,
        retryPolicy: { maxRetries: 2, backoff: 'exponential', retryOn: ['timeout', 'error'] },
        status: 'pending' as const,
      };
    });
  }

  private generateDefaultArgs(tool: ToolDefinition, profile: CustomerProfile): Record<string, any> {
    return buildWorkflowToolArgs(tool.name, profile);
  }

  // LLM 상태 확인
  async checkLLMStatus(): Promise<{ available: boolean; model: string | null; latency?: number }> {
    const start = Date.now();
    const available = await this.llm.healthCheck();
    const model = available ? await this.llm.getCurrentModel() : null;
    return { available, model, latency: Date.now() - start };
  }

  // AI 사용 설정
  setUseAI(use: boolean): void {
    this.useAI = use;
    log.info(`AI generation ${use ? 'enabled' : 'disabled'}`);
  }

  // LLM 클라이언트 조회
  getLLMClient(): LLMClient {
    return this.llm;
  }
}
