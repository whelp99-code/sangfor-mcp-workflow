/**
 * Sangfor MCP Workflow Server — stdio JSON-RPC MCP 서버
 *
 * sangfor-engineer-mcp의 MCP tools를 자동으로 호출하는 오케스트레이터
 */

import readline from 'node:readline';
import { join } from 'node:path';

// ─── 패키지 imports ─────────────────────────────────────────────────────────

import {
  ToolRegistry,
  ExecutionLogger,
  ApprovalManager,
  AIWorkflowGenerator,
  WorkflowExecutor,
  ErrorHandler,
  McpStdioClient,
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

// ─── 경로 설정 ──────────────────────────────────────────────────────────────

const SANGFOR_MCP_SERVER_PATH = join(
  process.env.HOME || '/Users/jmpark',
  'Documents/Playground/whelp99-code-sangfor-engineer-mcp/apps/mcp-server/src/index.ts'
);

// ─── 인스턴스 생성 ──────────────────────────────────────────────────────────

const toolRegistry = new ToolRegistry();
const executionLogger = new ExecutionLogger();
const approvalManager = new ApprovalManager();
const errorHandler = new ErrorHandler();
const workflowExecutor = new WorkflowExecutor(toolRegistry, executionLogger, errorHandler);

let mcpClient: McpStdioClient | null = null;
let aiWorkflowGenerator: AIWorkflowGenerator | null = null;

// 워크플로우 저장소
const workflows = new Map<string, Workflow>();

// ─── MCP 클라이언트 초기화 ──────────────────────────────────────────────────

async function initializeMcpClient(): Promise<void> {
  try {
    mcpClient = new McpStdioClient(SANGFOR_MCP_SERVER_PATH);
    await mcpClient.start();
    toolRegistry.setMcpClient(mcpClient);
    await toolRegistry.registerFromMcpServer();
    aiWorkflowGenerator = new AIWorkflowGenerator(toolRegistry, { baseUrl: 'http://localhost:1234/v1' });
    console.log('✅ Connected to sangfor-engineer-mcp');
  } catch (error) {
    console.error('⚠️ Failed to connect to sangfor-engineer-mcp:', error);
    console.log('Using fallback mock tools');
    aiWorkflowGenerator = new AIWorkflowGenerator(toolRegistry, { baseUrl: 'http://localhost:1234/v1' });
  }
}

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any };
type ToolHandler = (args: any) => unknown | Promise<unknown>;

// ─── MCP Tools 정의 ─────────────────────────────────────────────────────────

const tools: Record<string, { description: string; inputSchema: any; handler: ToolHandler }> = {
  // ═══ AI 기반 워크플로우 생성 ═══════════════════════════════════════════════

  'sangfor_workflow.generate_smart_workflow': {
    description:
      'AI(LLM)가 고객 요구사항을 분석하고 최적의 워크플로우를 동적으로 생성합니다. 기존 sangfor-engineer-mcp의 tools를 자동 호출합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '고객사명' },
        excelFilePath: { type: 'string', description: 'ITAC Excel 체크리스트 파일 경로' },
        requirements: { type: 'array', items: { type: 'string' }, description: '고객 요구사항 목록' },
        environment: { type: 'string', enum: ['lab', 'poc', 'customer', 'production'], description: '환경' },
        products: { type: 'array', items: { type: 'string' }, description: '대상 제품 (자동 감지 가능)' },
      },
      required: ['customerName'],
    },
    handler: async (args: ProjectInput) => {
      if (!aiWorkflowGenerator) throw new Error('MCP client not initialized');

      const profile = await aiWorkflowGenerator.analyzeInput(args);
      const workflow = await aiWorkflowGenerator.generateWorkflow(profile);

      workflows.set(workflow.id, workflow);
      approvalManager.requestApproval(workflow);

      const llmStatus = await aiWorkflowGenerator.checkLLMStatus();

      return {
        workflowId: workflow.id,
        name: workflow.name,
        steps: workflow.steps.map((s) => ({
          name: s.name,
          toolName: s.toolName,
          dependsOn: s.dependsOn,
          optional: s.optional,
        })),
        reasoning: workflow.reasoning,
        estimatedDuration: workflow.estimatedDuration,
        status: workflow.status,
        llmStatus: llmStatus.available ? `AI (${llmStatus.model})` : '규칙 기반 (LLM 미연결)',
        mcpConnected: mcpClient?.isConnected() || false,
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
        message: '워크플로우가 승인되었습니다.',
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
      approvalManager.reject(args.workflowId, args.reason);
      return { status: 'rejected', reason: args.reason };
    },
  },

  'sangfor_workflow.execute_workflow': {
    description: '승인된 워크플로우를 실행합니다. 기존 sangfor-engineer-mcp의 tools를 순차 호출합니다.',
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
        throw new Error(`Workflow not approved. Status: ${workflow.status}`);
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
        mcpConnected: mcpClient?.isConnected() || false,
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

  // ═══ MCP 서버 상태 ═════════════════════════════════════════════════════════

  'sangfor_workflow.get_mcp_status': {
    description: 'sangfor-engineer-mcp 연결 상태를 확인합니다.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return {
        connected: mcpClient?.isConnected() || false,
        toolsCount: toolRegistry.listTools().length,
        serverPath: SANGFOR_MCP_SERVER_PATH,
      };
    },
  },

  'sangfor_workflow.list_mcp_tools': {
    description: '사용 가능한 MCP tools 목록을 조회합니다.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      return toolRegistry.listTools().map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        tags: t.tags,
      }));
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
          serverInfo: { name: 'sangfor-mcp-workflow', version: '0.2.0' },
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

// MCP 클라이언트 초기화
initializeMcpClient().then(() => {
  process.stderr.write('sangfor-mcp-workflow stdio server started\n');
  process.stderr.write(`Registered ${Object.keys(tools).length} MCP tools\n`);
  process.stderr.write(`MCP client connected: ${mcpClient?.isConnected() || false}\n`);
});
