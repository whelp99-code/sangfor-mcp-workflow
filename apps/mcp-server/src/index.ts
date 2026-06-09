/**
 * Sangfor MCP Workflow Server — stdio JSON-RPC MCP 서버
 *
 * AI 기반 동적 워크플로우 엔진 + 3대 핵심 워크플로우
 */

import readline from 'node:readline';
import { join } from 'node:path';

// ─── 패키지 imports ─────────────────────────────────────────────────────────

import {
  ToolRegistry,
  createDefaultToolDefinitions,
  ExecutionLogger,
  ApprovalManager,
  WorkflowGenerator,
  WorkflowExecutor,
  ErrorHandler,
  type Workflow,
  type ProjectInput,
} from '@sangfor/workflow-engine';

import {
  runHealthCheck,
  createDefaultHealthCheckConfig,
  PRODUCT_URLS,
  PRODUCT_CREDENTIALS,
} from '@sangfor/health-checker';

import {
  runAutoWikiPipeline,
  createLessonNote,
  searchObsidianNotes,
  listObsidianNotes,
} from '@sangfor/wiki-sync';

// ─── 인스턴스 생성 ──────────────────────────────────────────────────────────

const toolRegistry = new ToolRegistry();
toolRegistry.registerAll(createDefaultToolDefinitions());

const executionLogger = new ExecutionLogger();
const approvalManager = new ApprovalManager();
const errorHandler = new ErrorHandler();
const workflowGenerator = new WorkflowGenerator(toolRegistry);
const workflowExecutor = new WorkflowExecutor(toolRegistry, executionLogger, errorHandler);

// 워크플로우 저장소
const workflows = new Map<string, Workflow>();

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any };
type ToolHandler = (args: any) => unknown | Promise<unknown>;

// ─── MCP Tools 정의 ─────────────────────────────────────────────────────────

const tools: Record<string, { description: string; inputSchema: any; handler: ToolHandler }> = {
  // ═══ AI 기반 워크플로우 생성 ═══════════════════════════════════════════════

  'sangfor_workflow.generate_smart_workflow': {
    description:
      'AI가 고객 요구사항을 분석하고 최적의 워크플로우를 동적으로 생성합니다. Excel 체크리스트와 요구사항을 입력하면, AI가 적절한 tool을 선정하고 실행 순서를 결정합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '고객사명' },
        excelFilePath: { type: 'string', description: 'ITAC Excel 체크리스트 파일 경로' },
        requirements: { type: 'array', items: { type: 'string' }, description: '추가 요구사항' },
        environment: { type: 'string', enum: ['lab', 'poc', 'customer', 'production'], description: '환경' },
        products: { type: 'array', items: { type: 'string' }, description: '대상 제품 (자동 감지 가능)' },
      },
      required: ['customerName', 'excelFilePath'],
    },
    handler: async (args: ProjectInput) => {
      // 1단계: 입력 분석
      const profile = await workflowGenerator.analyzeInput(args);

      // 2단계: 워크플로우 생성
      const workflow = await workflowGenerator.generateWorkflow(profile);

      // 워크플로우 저장
      workflows.set(workflow.id, workflow);

      // 승인 요청
      approvalManager.requestApproval(workflow);

      return {
        workflowId: workflow.id,
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps.map((s) => ({
          name: s.name,
          toolName: s.toolName,
          dependsOn: s.dependsOn,
          optional: s.optional,
        })),
        reasoning: workflow.reasoning,
        estimatedDuration: workflow.estimatedDuration,
        estimatedCost: workflow.estimatedCost,
        status: workflow.status,
        message: '워크플로우가 생성되었습니다. 승인 후 실행해주세요.',
      };
    },
  },

  'sangfor_workflow.approve_workflow': {
    description: '생성된 워크플로우를 승인합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '워크플로우 ID' },
        approvedBy: { type: 'string', description: '승인자 이름' },
      },
      required: ['workflowId', 'approvedBy'],
    },
    handler: async (args: { workflowId: string; approvedBy: string }) => {
      const workflow = workflows.get(args.workflowId);
      if (!workflow) throw new Error(`Workflow not found: ${args.workflowId}`);

      approvalManager.approve(args.workflowId, args.approvedBy);
      return {
        workflowId: workflow.id,
        status: workflow.status,
        approvedBy: workflow.approvedBy,
        approvedAt: workflow.approvedAt,
        message: '워크플로우가 승인되었습니다. 실행할 준비가 되었습니다.',
      };
    },
  },

  'sangfor_workflow.reject_workflow': {
    description: '생성된 워크플로우를 거절합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '워크플로우 ID' },
        reason: { type: 'string', description: '거절 사유' },
      },
      required: ['workflowId', 'reason'],
    },
    handler: async (args: { workflowId: string; reason: string }) => {
      const workflow = workflows.get(args.workflowId);
      if (!workflow) throw new Error(`Workflow not found: ${args.workflowId}`);

      approvalManager.reject(args.workflowId, args.reason);
      return {
        workflowId: workflow.id,
        status: workflow.status,
        reason: args.reason,
        message: '워크플로우가 거절되었습니다.',
      };
    },
  },

  'sangfor_workflow.execute_workflow': {
    description: '승인된 워크플로우를 실행합니다. 각 단계가 순차적으로 실행되며, 중간 결과가 자동으로 전달됩니다.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '워크플로우 ID' },
      },
      required: ['workflowId'],
    },
    handler: async (args: { workflowId: string }) => {
      const workflow = workflows.get(args.workflowId);
      if (!workflow) throw new Error(`Workflow not found: ${args.workflowId}`);
      if (workflow.status !== 'approved') {
        throw new Error(`Workflow not approved. Current status: ${workflow.status}`);
      }

      const result = await workflowExecutor.executeWorkflow(workflow);
      return result;
    },
  },

  'sangfor_workflow.get_workflow_status': {
    description: '워크플로우 상태를 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '워크플로우 ID' },
      },
      required: ['workflowId'],
    },
    handler: async (args: { workflowId: string }) => {
      const workflow = workflows.get(args.workflowId);
      if (!workflow) throw new Error(`Workflow not found: ${args.workflowId}`);

      return {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        steps: workflow.steps.map((s) => ({
          name: s.name,
          status: s.status,
          error: s.error,
        })),
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        completedAt: workflow.completedAt,
      };
    },
  },

  'sangfor_workflow.list_workflows': {
    description: '전체 워크플로우 목록을 조회합니다.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return Array.from(workflows.values()).map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        createdAt: w.createdAt,
        stepsCount: w.steps.length,
      }));
    },
  },

  'sangfor_workflow.get_execution_logs': {
    description: '워크플로우 실행 이력을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: '워크플로우 ID' },
      },
      required: ['workflowId'],
    },
    handler: async (args: { workflowId: string }) => {
      return executionLogger.getLogs(args.workflowId);
    },
  },

  // ═══ 실장비 점검 ════════════════════════════════════════════════════════════

  'sangfor_workflow.run_health_check': {
    description: '실장비 정책 상태를 확인합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', enum: ['EPP', 'IAG', 'CC'], description: '제품 코드' },
        targetUrl: { type: 'string', description: '콘솔 URL' },
      },
      required: ['product'],
    },
    handler: async (args: { product: 'EPP' | 'IAG' | 'CC'; targetUrl?: string }) => {
      const config = createDefaultHealthCheckConfig(
        args.product,
        args.targetUrl || PRODUCT_URLS[args.product],
        PRODUCT_CREDENTIALS[args.product],
        join(process.cwd(), 'outputs', 'health-checks')
      );
      return runHealthCheck(config);
    },
  },

  // ═══ Obsidian 연동 ═══════════════════════════════════════════════════════════

  'sangfor_workflow.run_auto_wiki_pipeline': {
    description: '피드백을 자동으로 처리하여 Obsidian 위키에 반영합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        obsidianVaultPath: { type: 'string', description: 'Obsidian vault 경로' },
        autoApprove: { type: 'boolean', description: '자동 승인 여부' },
      },
      required: ['obsidianVaultPath'],
    },
    handler: async (args: { obsidianVaultPath: string; autoApprove?: boolean }) => {
      return runAutoWikiPipeline({
        obsidianVaultPath: args.obsidianVaultPath,
        autoApprove: args.autoApprove || false,
        notifyOnProposal: true,
        batchSize: 10,
      });
    },
  },

  'sangfor_workflow.search_obsidian_notes': {
    description: 'Obsidian vault에서 노트를 검색합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: { type: 'string', description: 'Obsidian vault 경로' },
        query: { type: 'string', description: '검색 쿼리' },
      },
      required: ['vaultPath', 'query'],
    },
    handler: async (args: { vaultPath: string; query: string }) => {
      const notes = searchObsidianNotes(args.vaultPath, args.query);
      return { query: args.query, results: notes.length, notes };
    },
  },

  'sangfor_workflow.list_obsidian_notes': {
    description: 'Obsidian vault의 전체 노트 목록을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: { type: 'string', description: 'Obsidian vault 경로' },
      },
      required: ['vaultPath'],
    },
    handler: async (args: { vaultPath: string }) => {
      const notes = listObsidianNotes(args.vaultPath);
      return { total: notes.length, notes };
    },
  },
};

// ─── MCP 서버 핸들러 ────────────────────────────────────────────────────────

function listTools() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

async function handle(req: JsonRpcRequest) {
  try {
    if (req.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'sangfor-mcp-workflow', version: '0.1.0' },
          capabilities: { tools: { listChanged: false } },
        },
      };
    }

    if (req.method === 'tools/list') {
      return { jsonrpc: '2.0', id: req.id, result: { tools: listTools() } };
    }

    if (req.method === 'tools/call') {
      const name = req.params?.name;
      const args = req.params?.arguments ?? {};
      const tool = tools[name];

      if (!tool) throw new Error(`Unknown tool: ${name}`);

      const result = await tool.handler(args);
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: false,
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: `Method not found: ${req.method}` },
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        content: [{ type: 'text', text: String(error instanceof Error ? error.message : error) }],
        isError: true,
      },
    };
  }
}

// ─── stdio 서버 시작 ────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  const req = JSON.parse(line) as JsonRpcRequest;
  const res = await handle(req);
  process.stdout.write(`${JSON.stringify(res)}\n`);
});

process.stderr.write('sangfor-mcp-workflow stdio server started\n');
process.stderr.write(`Registered ${Object.keys(tools).length} MCP tools\n`);
process.stderr.write(`Registered ${toolRegistry.listTools().length} workflow engine tools\n`);
