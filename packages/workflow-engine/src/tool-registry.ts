/**
 * Tool Registry — sangfor-engineer-mcp의 실제 MCP tools를 호출하는 registry
 */

import { nowId, createLogger } from '@sangfor/workflow-shared';
import type { ToolDefinition, ProductCode } from './types.js';
import { McpStdioClient } from './mcp-client.js';

const log = createLogger('tool-registry');

// ─── Tool Registry ──────────────────────────────────────────────────────────

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private mcpClient: McpStdioClient | null = null;

  // MCP 클라이언트 연결
  setMcpClient(client: McpStdioClient): void {
    this.mcpClient = client;
    log.info('MCP client connected to tool registry');
  }

  // tool 등록
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  // 여러 tool 한번에 등록
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  // MCP 서버에서 tool 자동 등록
  async registerFromMcpServer(): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    const mcpTools = await this.mcpClient.listTools();
    log.info(`Found ${mcpTools.length} MCP tools`);

    for (const mcpTool of mcpTools) {
      const tool: ToolDefinition = {
        name: mcpTool.name,
        description: mcpTool.description,
        inputSchema: mcpTool.inputSchema,
        category: this.categorizeTool(mcpTool.name),
        tags: this.extractTags(mcpTool.name),
        estimatedDuration: '10s',
        riskLevel: 'low',
        requiresApproval: false,
        handler: async (args: any) => {
          if (!this.mcpClient) throw new Error('MCP client not connected');
          return this.mcpClient.callTool(mcpTool.name, args);
        },
      };

      this.register(tool);
    }

    log.info(`Registered ${mcpTools.length} tools from MCP server`);
  }

  // tool 조회
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  // tool 존재 확인
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  // 전체 tool 목록
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // 카테고리별 tool 목록
  listToolsByCategory(category: string): ToolDefinition[] {
    return this.listTools().filter((t) => t.category === category);
  }

  // 태그별 tool 목록
  listToolsByTag(tag: string): ToolDefinition[] {
    return this.listTools().filter((t) => t.tags.includes(tag));
  }

  // 제품별 tool 목록
  listToolsByProduct(product: ProductCode): ToolDefinition[] {
    const productLower = product.toLowerCase();
    return this.listTools().filter(
      (t) => t.tags.includes(productLower) || t.tags.includes('product-agnostic')
    );
  }

  // tool 제거
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  // 전체 tool 이름 목록
  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  // tool 통계
  getStats(): { total: number; byCategory: Record<string, number>; byProduct: Record<string, number> } {
    const tools = this.listTools();
    const byCategory: Record<string, number> = {};
    const byProduct: Record<string, number> = {};

    for (const tool of tools) {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
      for (const tag of tool.tags) {
        if (['epp', 'iag', 'cc', 'hci', 'scp'].includes(tag)) {
          byProduct[tag] = (byProduct[tag] || 0) + 1;
        }
      }
    }

    return { total: tools.length, byCategory, byProduct };
  }

  // tool 카테고리 분류
  private categorizeTool(name: string): string {
    if (name.includes('import') || name.includes('ingest') || name.includes('learn')) return 'input';
    if (name.includes('analyze') || name.includes('search') || name.includes('rag')) return 'analysis';
    if (name.includes('generate') || name.includes('build') || name.includes('create')) return 'output';
    if (name.includes('capture') || name.includes('screenshot') || name.includes('verify')) return 'verification';
    if (name.includes('health') || name.includes('check') || name.includes('monitor')) return 'monitoring';
    if (name.includes('feedback') || name.includes('wiki') || name.includes('lesson')) return 'knowledge';
    if (name.includes('approval') || name.includes('request')) return 'approval';
    return 'other';
  }

  // tool 태그 추출
  private extractTags(name: string): string[] {
    const tags: string[] = [];
    const lower = name.toLowerCase();

    if (lower.includes('epp') || lower.includes('endpoint')) tags.push('epp');
    if (lower.includes('iag')) tags.push('iag');
    if (lower.includes('cc') || lower.includes('cyber')) tags.push('cc');
    if (lower.includes('hci') || lower.includes('scp')) tags.push('hci');
    if (lower.includes('excel') || lower.includes('import')) tags.push('excel');
    if (lower.includes('guide') || lower.includes('docx') || lower.includes('pptx')) tags.push('document');
    if (lower.includes('screenshot') || lower.includes('capture')) tags.push('screenshot');
    if (lower.includes('health') || lower.includes('check')) tags.push('health');
    if (lower.includes('rag') || lower.includes('search')) tags.push('rag');
    if (lower.includes('feedback') || lower.includes('wiki')) tags.push('knowledge');

    if (tags.length === 0) tags.push('product-agnostic');
    return tags;
  }
}

// ─── 기본 tool 정의 (MCP 서버 연결 전 fallback) ─────────────────────────────

export function createDefaultToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'import_excel',
      description: 'ITAC Excel 체크리스트를 파싱하여 요구사항으로 변환',
      inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
      category: 'input',
      tags: ['excel', 'product-agnostic'],
      estimatedDuration: '5s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ rows: [], count: 0 }),
    },
    {
      name: 'analyze_requirements',
      description: '고객 요구사항을 분석하여 제품별 설정 태스크로 변환',
      inputSchema: { type: 'object', properties: { requirements: { type: 'array' } }, required: ['requirements'] },
      category: 'analysis',
      tags: ['analysis', 'product-agnostic'],
      estimatedDuration: '10s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ tasks: [] }),
    },
    {
      name: 'generate_change_plan',
      description: '제품별 변경 계획 생성',
      inputSchema: { type: 'object', properties: { tasks: { type: 'array' } }, required: ['tasks'] },
      category: 'planning',
      tags: ['planning', 'product-agnostic'],
      estimatedDuration: '15s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ planId: 'temp', steps: [] }),
    },
    {
      name: 'generate_setting_guide_docx',
      description: 'Word (.docx) 설정 가이드 생성',
      inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
      category: 'output',
      tags: ['document', 'product-agnostic'],
      estimatedDuration: '20s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ path: 'outputs/setting-guide.docx' }),
    },
    {
      name: 'generate_setting_guide_pptx',
      description: 'PowerPoint (.pptx) 설정 가이드 생성',
      inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
      category: 'output',
      tags: ['document', 'product-agnostic'],
      estimatedDuration: '25s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ path: 'outputs/setting-guide.pptx' }),
    },
    {
      name: 'capture_screenshots',
      description: '실장비 콘솔에서 스크린샷 캡처',
      inputSchema: { type: 'object', properties: { product: { type: 'string' } }, required: ['product'] },
      category: 'verification',
      tags: ['screenshot', 'epp', 'iag', 'cc'],
      estimatedDuration: '60s',
      riskLevel: 'medium',
      requiresApproval: false,
      handler: async () => ({ captured: 0 }),
    },
    {
      name: 'generate_evidence_report',
      description: '검증 보고서 생성',
      inputSchema: { type: 'object', properties: { planId: { type: 'string' } } },
      category: 'output',
      tags: ['report', 'product-agnostic'],
      estimatedDuration: '10s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ path: 'outputs/evidence-report.md' }),
    },
    {
      name: 'search_manuals',
      description: 'Sangfor 매뉴얼/가이드 검색',
      inputSchema: { type: 'object', properties: { product: { type: 'string' }, query: { type: 'string' } }, required: ['product'] },
      category: 'knowledge',
      tags: ['rag', 'epp', 'iag', 'cc', 'hci'],
      estimatedDuration: '5s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ results: [] }),
    },
    {
      name: 'run_health_check',
      description: '실장비 정책 상태 확인',
      inputSchema: { type: 'object', properties: { product: { type: 'string' } }, required: ['product'] },
      category: 'monitoring',
      tags: ['health', 'epp', 'iag', 'cc'],
      estimatedDuration: '90s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => ({ status: 'pass', alerts: [] }),
    },
  ];
}
