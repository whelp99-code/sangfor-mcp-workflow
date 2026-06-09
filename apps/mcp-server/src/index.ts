/**
 * Sangfor MCP Workflow Server — stdio JSON-RPC MCP 서버
 *
 * 3대 핵심 워크플로우를 MCP tools로 expose:
 * 1. 프로젝트 올인원 파이프라인
 * 2. 실장비 일상 점검
 * 3. Obsidian/GitHub Wiki 동기화
 */

import readline from 'node:readline';
import { join } from 'node:path';

// ─── 패키지 imports ─────────────────────────────────────────────────────────

import {
  runProjectPipeline,
  createPipeline,
  runPipeline,
  getPipeline,
  listPipelines,
  registerScheduledTask,
  runScheduledTask,
  listScheduledTasks,
  getTaskHistory,
  type ProjectPipelineInput,
  type HealthCheckConfig,
  type AutoWikiPipelineConfig,
} from '@sangfor/workflow-core';

import {
  runHealthCheck,
  compareSnapshots,
  saveHealthCheckSnapshot,
  loadHealthCheckSnapshot,
  listHealthCheckSnapshots,
  createDefaultHealthCheckConfig,
  PRODUCT_URLS,
  PRODUCT_CREDENTIALS,
  EPP_CHECK_ITEMS,
  IAG_CHECK_ITEMS,
  CC_CHECK_ITEMS,
} from '@sangfor/health-checker';

import {
  runAutoWikiPipeline,
  getAutoWikiPipelineStatus,
  applyWikiUpdateToObsidian,
  createLessonNote,
  listObsidianNotes,
  searchObsidianNotes,
} from '@sangfor/wiki-sync';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any };
type ToolHandler = (args: any) => unknown | Promise<unknown>;

// ─── MCP Tools 정의 ─────────────────────────────────────────────────────────

const tools: Record<string, { description: string; inputSchema: any; handler: ToolHandler }> = {
  // ═══ ① 프로젝트 올인원 파이프라인 ═══════════════════════════════════════════

  'sangfor_workflow.run_project_pipeline': {
    description:
      'Run complete project pipeline: Excel → requirements → change plan → guides → screenshots → evidence report. 원클릭으로 고객 프로젝트 전체 파이프라인을 실행합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '고객사명' },
        excelFilePath: { type: 'string', description: 'ITAC Excel 체크리스트 파일 경로' },
        products: {
          type: 'array',
          items: { type: 'string' },
          description: '대상 제품 목록 (자동 감지 가능)',
        },
        outputDir: { type: 'string', description: '출력 디렉토리' },
        captureScreenshots: { type: 'boolean', description: '실장비 스크린샷 캡처 여부' },
        screenshotProducts: {
          type: 'array',
          items: { type: 'string' },
          description: '스크린샷 대상 제품',
        },
        targetUrls: { type: 'object', description: '제품별 타겟 URL' },
        credentials: { type: 'object', description: '제품별 로그인 정보' },
        dryRun: { type: 'boolean', description: '드라이런 모드' },
      },
      required: ['customerName', 'excelFilePath'],
    },
    handler: (args: ProjectPipelineInput) => runProjectPipeline(args),
  },

  'sangfor_workflow.get_pipeline_status': {
    description: '파이프라인 상태 조회',
    inputSchema: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string', description: '파이프라인 ID' },
      },
      required: ['pipelineId'],
    },
    handler: ({ pipelineId }: { pipelineId: string }) => getPipeline(pipelineId),
  },

  'sangfor_workflow.list_pipelines': {
    description: '전체 파이프라인 목록 조회',
    inputSchema: { type: 'object', properties: {} },
    handler: () => listPipelines(),
  },

  // ═══ ② 실장비 일상 점검 ════════════════════════════════════════════════════

  'sangfor_workflow.run_health_check': {
    description:
      'Run health check on Sangfor product console. EPP/IAG/CC 실장비의 정책 상태를 확인하고 이상을 감지합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', enum: ['EPP', 'IAG', 'CC'], description: '제품 코드' },
        targetUrl: { type: 'string', description: '콘솔 URL' },
        credentials: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
          description: '로그인 정보',
        },
        outputDir: { type: 'string', description: '결과 저장 디렉토리' },
      },
      required: ['product'],
    },
    handler: (args: { product: 'EPP' | 'IAG' | 'CC'; targetUrl?: string; credentials?: { username: string; password: string }; outputDir?: string }) => {
      const config = createDefaultHealthCheckConfig(
        args.product,
        args.targetUrl || PRODUCT_URLS[args.product],
        args.credentials || PRODUCT_CREDENTIALS[args.product],
        args.outputDir || join(process.cwd(), 'outputs', 'health-checks')
      );
      return runHealthCheck(config);
    },
  },

  'sangfor_workflow.compare_health_snapshots': {
    description: '두 점검 결과를 비교하여 변경 사항 및 이상을 감지합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        previousCheckId: { type: 'string', description: '이전 점검 ID' },
        currentCheckId: { type: 'string', description: '현재 점검 ID' },
        previousSnapshotPath: { type: 'string', description: '이전 스냅샷 파일 경로' },
        currentSnapshotPath: { type: 'string', description: '현재 스냅샷 파일 경로' },
      },
    },
    handler: (args: { previousCheckId?: string; currentCheckId?: string; previousSnapshotPath?: string; currentSnapshotPath?: string }) => {
      // TODO: 스냅샷 로드 및 비교
      return { message: 'Comparison not yet implemented' };
    },
  },

  'sangfor_workflow.get_health_history': {
    description: '실장비 점검 이력 조회',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', enum: ['EPP', 'IAG', 'CC'], description: '제품 코드' },
        outputDir: { type: 'string', description: '스냅샷 디렉토리' },
        limit: { type: 'number', description: '조회 개수' },
      },
      required: ['product'],
    },
    handler: (args: { product: string; outputDir?: string; limit?: number }) => {
      const outputDir = args.outputDir || join(process.cwd(), 'outputs', 'health-checks');
      const snapshots = listHealthCheckSnapshots(outputDir);
      const limited = args.limit ? snapshots.slice(0, args.limit) : snapshots;
      return { product: args.product, snapshots: limited };
    },
  },

  // ═══ ③ Obsidian/GitHub Wiki 동기화 ════════════════════════════════════════

  'sangfor_workflow.run_auto_wiki_pipeline': {
    description:
      'Run automatic wiki update pipeline: feedback → lesson → proposal → Obsidian/GitHub Wiki update. 피드백을 자동으로 처리하여 위키에 반영합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        obsidianVaultPath: { type: 'string', description: 'Obsidian vault 경로' },
        githubWikiRepo: { type: 'string', description: 'GitHub Wiki 저장소 URL' },
        autoApprove: { type: 'boolean', description: '자동 승인 여부' },
        batchSize: { type: 'number', description: '한 번에 처리할 피드백 수' },
        feedbackFilter: {
          type: 'object',
          properties: {
            severity: { type: 'array', items: { type: 'string' } },
            product: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['obsidianVaultPath'],
    },
    handler: (args: AutoWikiPipelineConfig) => runAutoWikiPipeline(args),
  },

  'sangfor_workflow.get_wiki_pipeline_status': {
    description: '자동 위키 파이프라인 상태 조회',
    inputSchema: { type: 'object', properties: {} },
    handler: () => getAutoWikiPipelineStatus(),
  },

  'sangfor_workflow.create_lesson_note': {
    description: 'Obsidian에 교훈 노트를 생성합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: { type: 'string', description: 'Obsidian vault 경로' },
        title: { type: 'string', description: '교훈 제목' },
        product: { type: 'string', description: '관련 제품' },
        severity: { type: 'string', description: '심각도' },
        background: { type: 'string', description: '배경' },
        lessonText: { type: 'string', description: '교훈 내용' },
        application: { type: 'string', description: '적용 방안' },
        feedbackId: { type: 'string', description: '관련 피드백 ID' },
      },
      required: ['vaultPath', 'title', 'product', 'severity', 'background', 'lessonText', 'application'],
    },
    handler: (args: {
      vaultPath: string;
      title: string;
      product: string;
      severity: string;
      background: string;
      lessonText: string;
      application: string;
      feedbackId?: string;
    }) => {
      const filePath = createLessonNote(args.vaultPath, {
        title: args.title,
        product: args.product,
        severity: args.severity,
        background: args.background,
        lessonText: args.lessonText,
        application: args.application,
        feedbackId: args.feedbackId,
      });
      return { success: true, filePath };
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
    handler: (args: { vaultPath: string; query: string }) => {
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
    handler: (args: { vaultPath: string }) => {
      const notes = listObsidianNotes(args.vaultPath);
      return { total: notes.length, notes };
    },
  },

  // ═══ 스케줄러 ═══════════════════════════════════════════════════════════════

  'sangfor_workflow.list_scheduled_tasks': {
    description: '등록된 정기 작업 목록 조회',
    inputSchema: { type: 'object', properties: {} },
    handler: () => listScheduledTasks(),
  },

  'sangfor_workflow.run_scheduled_task': {
    description: '정기 작업 수동 실행',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '작업 ID' },
      },
      required: ['taskId'],
    },
    handler: ({ taskId }: { taskId: string }) => runScheduledTask(taskId),
  },

  'sangfor_workflow.get_task_history': {
    description: '정기 작업 실행 이력 조회',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '작업 ID' },
      },
      required: ['taskId'],
    },
    handler: ({ taskId }: { taskId: string }) => getTaskHistory(taskId),
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
