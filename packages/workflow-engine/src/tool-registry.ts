/**
 * Tool Registry — tool 등록/관리
 */

import { nowId, createLogger } from '@sangfor/workflow-shared';
import type { ToolDefinition, ProductCode } from './types.js';

const log = createLogger('tool-registry');

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  // tool 등록
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      log.warn(`Tool already registered, overwriting: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    log.info(`Registered tool: ${tool.name} (${tool.category})`);
  }

  // 여러 tool 한번에 등록
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
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
    const existed = this.tools.has(name);
    this.tools.delete(name);
    if (existed) {
      log.info(`Unregistered tool: ${name}`);
    }
    return existed;
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
}

// ─── 기본 tool 정의 (sangfor-engineer-mcp 기반) ─────────────────────────────

export function createDefaultToolDefinitions(): ToolDefinition[] {
  return [
    // Excel 파싱
    {
      name: 'import_excel',
      description: 'ITAC Excel 체크리스트를 파싱하여 요구사항으로 변환',
      inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
      category: 'input',
      tags: ['excel', 'product-agnostic'],
      estimatedDuration: '5s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { rows: [], count: 0 };
      },
    },

    // 요구사항 분석
    {
      name: 'analyze_requirements',
      description: '고객 요구사항을 분석하여 제품별 설정 태스크로 변환',
      inputSchema: { type: 'object', properties: { requirements: { type: 'array' } }, required: ['requirements'] },
      category: 'analysis',
      tags: ['analysis', 'product-agnostic'],
      estimatedDuration: '10s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { tasks: [] };
      },
    },

    // 변경 계획 생성
    {
      name: 'generate_change_plan',
      description: '제품별 변경 계획 생성 (메뉴 경로, API 엔드포인트, 롤백)',
      inputSchema: { type: 'object', properties: { tasks: { type: 'array' } }, required: ['tasks'] },
      category: 'planning',
      tags: ['planning', 'product-agnostic'],
      estimatedDuration: '15s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { planId: 'temp-plan-id', steps: [] };
      },
    },

    // 설정 가이드 생성 (DOCX)
    {
      name: 'generate_setting_guide_docx',
      description: 'Word (.docx) 설정 가이드 생성',
      inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
      category: 'output',
      tags: ['document', 'product-agnostic'],
      estimatedDuration: '20s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { path: 'outputs/setting-guide.docx' };
      },
    },

    // 설정 가이드 생성 (PPTX)
    {
      name: 'generate_setting_guide_pptx',
      description: 'PowerPoint (.pptx) 설정 가이드 생성',
      inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
      category: 'output',
      tags: ['document', 'product-agnostic'],
      estimatedDuration: '25s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { path: 'outputs/setting-guide.pptx' };
      },
    },

    // 실장비 캡처
    {
      name: 'capture_screenshots',
      description: '실장비 콘솔에서 스크린샷 캡처',
      inputSchema: { type: 'object', properties: { product: { type: 'string' } }, required: ['product'] },
      category: 'verification',
      tags: ['screenshot', 'epp', 'iag', 'cc'],
      estimatedDuration: '60s',
      riskLevel: 'medium',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { captured: 0 };
      },
    },

    // 보고서 생성
    {
      name: 'generate_evidence_report',
      description: '검증 보고서 생성',
      inputSchema: { type: 'object', properties: { planId: { type: 'string' } } },
      category: 'output',
      tags: ['report', 'product-agnostic'],
      estimatedDuration: '10s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { path: 'outputs/evidence-report.md' };
      },
    },

    // RAG 검색
    {
      name: 'search_manuals',
      description: 'Sangfor 매뉴얼/가이드 검색',
      inputSchema: { type: 'object', properties: { product: { type: 'string' }, query: { type: 'string' } }, required: ['product'] },
      category: 'knowledge',
      tags: ['rag', 'epp', 'iag', 'cc', 'hci'],
      estimatedDuration: '5s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { results: [] };
      },
    },

    // 실장비 점검
    {
      name: 'run_health_check',
      description: '실장비 정책 상태 확인',
      inputSchema: { type: 'object', properties: { product: { type: 'string' } }, required: ['product'] },
      category: 'monitoring',
      tags: ['health', 'epp', 'iag', 'cc'],
      estimatedDuration: '90s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async (args) => {
        // TODO: sangfor-engineer-mcp 연동
        return { status: 'pass', alerts: [] };
      },
    },
  ];
}
