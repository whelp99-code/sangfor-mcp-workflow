/**
 * Operator Console — 웹 UI + REST API
 *
 * Express 기반 웹 서버 + 대시보드 UI
 */

import express from 'express';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@sangfor/workflow-shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import {
  ToolRegistry,
  createDefaultToolDefinitions,
  ExecutionLogger,
  ApprovalManager,
  WorkflowGenerator,
  WorkflowExecutor,
  ErrorHandler,
  TemplateManager,
  MonitoringDashboard,
  type Workflow,
} from '@sangfor/workflow-engine';

const log = createLogger('operator-console');
const app = express();
const PORT = process.env.PORT || 3500;

// ─── 미들웨어 ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ─── 인스턴스 생성 ──────────────────────────────────────────────────────────

const toolRegistry = new ToolRegistry();
toolRegistry.registerAll(createDefaultToolDefinitions());

const executionLogger = new ExecutionLogger();
const approvalManager = new ApprovalManager();
const errorHandler = new ErrorHandler();
const templateManager = new TemplateManager();
const monitoringDashboard = new MonitoringDashboard();
const workflowGenerator = new WorkflowGenerator(toolRegistry);
const workflowExecutor = new WorkflowExecutor(toolRegistry, executionLogger, errorHandler);

// 워크플로우 저장소
const workflows = new Map<string, Workflow>();

// ─── REST API ──────────────────────────────────────────────────────────────

// 대시보드 통계
app.get('/api/dashboard/stats', (req, res) => {
  const stats = monitoringDashboard.getStats();
  res.json(stats);
});

// 워크플로우 목록
app.get('/api/workflows', (req, res) => {
  const summaries = monitoringDashboard.getWorkflowSummaries();
  res.json(summaries);
});

// 워크플로우 상세
app.get('/api/workflows/:id', (req, res) => {
  const detail = monitoringDashboard.getWorkflowDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  res.json(detail);
});

// 워크플로우 생성 (AI 기반)
app.post('/api/workflows/generate', async (req, res) => {
  try {
    const { customerName, excelFilePath, requirements, environment, products } = req.body;

    const profile = await workflowGenerator.analyzeInput({
      customerName,
      excelFilePath,
      requirements,
      environment,
      products,
    });

    const workflow = await workflowGenerator.generateWorkflow(profile);
    workflows.set(workflow.id, workflow);
    monitoringDashboard.registerWorkflow(workflow);
    approvalManager.requestApproval(workflow);

    res.json({
      workflowId: workflow.id,
      name: workflow.name,
      steps: workflow.steps.length,
      status: workflow.status,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 템플릿으로 워크플로우 생성
app.post('/api/workflows/from-template', (req, res) => {
  try {
    const { templateId, customerName, products } = req.body;

    const profile = {
      customerName,
      products: products || [],
      requirements: [],
      environment: 'customer' as const,
      riskLevel: 'medium' as const,
      similarCases: [],
      metadata: {},
    };

    const workflow = templateManager.createWorkflowFromTemplate(templateId, profile);
    if (!workflow) {
      return res.status(404).json({ error: 'Template not found' });
    }

    workflows.set(workflow.id, workflow);
    monitoringDashboard.registerWorkflow(workflow);
    approvalManager.requestApproval(workflow);

    res.json({
      workflowId: workflow.id,
      name: workflow.name,
      steps: workflow.steps.length,
      status: workflow.status,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 워크플로우 승인
app.post('/api/workflows/:id/approve', (req, res) => {
  try {
    const { approvedBy } = req.body;
    const workflow = workflows.get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    approvalManager.approve(req.params.id, approvedBy || 'admin');
    res.json({ status: workflow.status, approvedBy: workflow.approvedBy });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 워크플로우 거절
app.post('/api/workflows/:id/reject', (req, res) => {
  try {
    const { reason } = req.body;
    approvalManager.reject(req.params.id, reason || 'No reason provided');
    res.json({ status: 'rejected' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 워크플로우 실행
app.post('/api/workflows/:id/execute', async (req, res) => {
  try {
    const workflow = workflows.get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    if (workflow.status !== 'approved') {
      return res.status(400).json({ error: `Workflow not approved. Status: ${workflow.status}` });
    }

    const result = await workflowExecutor.executeWorkflow(workflow);
    monitoringDashboard.registerExecutionResult(result);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 실행 이력
app.get('/api/workflows/:id/logs', (req, res) => {
  const logs = monitoringDashboard.getExecutionHistory(req.params.id);
  res.json(logs);
});

// 템플릿 목록
app.get('/api/templates', (req, res) => {
  const templates = templateManager.list();
  res.json(templates);
});

// 템플릿 검색
app.get('/api/templates/search', (req, res) => {
  const { q } = req.query;
  const templates = templateManager.search(String(q || ''));
  res.json(templates);
});

// 시스템 상태
app.get('/api/system/health', (req, res) => {
  const health = monitoringDashboard.getSystemHealth();
  res.json(health);
});

// 실시간 이벤트 (SSE)
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = () => {
    const events = monitoringDashboard.getEventStream();
    res.write(`data: ${JSON.stringify(events)}\n\n`);
  };

  // 5초마다 이벤트 전송
  const interval = setInterval(sendEvent, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// ─── 웹 UI (SPA) ──────────────────────────────────────────────────────────

app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ─── 서버 시작 ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  log.info(`Operator Console running at http://localhost:${PORT}`);
  log.info(`API endpoints:`);
  log.info(`  GET  /api/dashboard/stats`);
  log.info(`  GET  /api/workflows`);
  log.info(`  POST /api/workflows/generate`);
  log.info(`  POST /api/workflows/:id/approve`);
  log.info(`  POST /api/workflows/:id/execute`);
  log.info(`  GET  /api/templates`);
  log.info(`  GET  /api/system/health`);
});

export default app;
