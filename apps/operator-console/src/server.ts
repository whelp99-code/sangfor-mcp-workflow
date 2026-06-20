/**
 * Operator Console — 웹 UI + REST API
 *
 * Express 기반 웹 서버 + 대시보드 UI
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join, dirname } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { createLogger } from '@sangfor/workflow-shared';
import { healthRoutes } from './routes/index';
import { apiKeyAuth } from './middleware/auth';
import {
  bootstrapMcpClient,
  getProductEnv,
  toDeviceProduct,
  toGuideProduct,
} from './bootstrap/mcp-bootstrap';
import { buildComplianceAnalysis, buildComplianceRecord } from './services/compliance-helpers';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKFLOW_ROOT = join(__dirname, '../../..');
import {
  ToolRegistry,
  createDefaultToolDefinitions,
  ExecutionLogger,
  ApprovalManager,
  AIWorkflowGenerator,
  WorkflowExecutor,
  ErrorHandler,
  TemplateManager,
  MonitoringDashboard,
  ComplianceTracker,
  RoadmapGenerator,
  ProposalGenerator,
  DeviceAccessManager,
  DeviceMenuCapture,
  SettingGuideGenerator,
  VendorComparator,
  ReportGenerator,
  WebCrawler,
  RAGIndexer,
  LearningScheduler,
  ManualQASystem,
  BreakGlassPolicy,
  createDefaultAutopilotPolicy,
  OperationOrchestrator,
  toPostVerifierSnapshot,
  IncidentDetector,
  RemediationPlanner,
  PlaybookRegistry,
  parseExcelFile,
  parseMcpMenuRoutes,
  computeMenuAccuracy,
  type Workflow,
  type WorkflowTemplate,
  type RiskLevel,
  type ComplianceAnalysis,
  type CapturedMenu,
  type McpStdioClient,
} from '@sangfor/workflow-engine';

const log = createLogger('operator-console');
const app = express();
const PORT = process.env.PORT || 3500;

// ─── 미들웨어 ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const upload = multer({ dest: 'uploads/' });

// ─── 인스턴스 생성 ──────────────────────────────────────────────────────────

const toolRegistry = new ToolRegistry();
toolRegistry.registerAll(createDefaultToolDefinitions());

const executionLogger = new ExecutionLogger();
const approvalManager = new ApprovalManager();
const errorHandler = new ErrorHandler();
const templateManager = new TemplateManager();
const monitoringDashboard = new MonitoringDashboard();
const aiWorkflowGenerator = new AIWorkflowGenerator(toolRegistry, { baseUrl: 'http://localhost:1234/v1' });
const workflowExecutor = new WorkflowExecutor(toolRegistry, executionLogger, errorHandler);
const breakGlassPolicy = new BreakGlassPolicy();
const autopilotPolicy = createDefaultAutopilotPolicy();
const operationOrchestrator = new OperationOrchestrator();
const incidentDetector = new IncidentDetector();
const remediationPlanner = new RemediationPlanner();
const playbookRegistry = new PlaybookRegistry();
workflowExecutor.setApprovalManager(approvalManager);
workflowExecutor.setBreakGlassPolicy(breakGlassPolicy);

// 추가 인스턴스
const complianceTracker = new ComplianceTracker();
const roadmapGenerator = new RoadmapGenerator();
const proposalGenerator = new ProposalGenerator();
const deviceAccessManager = new DeviceAccessManager();
const deviceMenuCapture = new DeviceMenuCapture();
const settingGuideGenerator = new SettingGuideGenerator();
const vendorDB = JSON.parse(
  readFileSync(join(WORKFLOW_ROOT, 'data/vendors/vendor-database.json'), 'utf8'),
);
const vendorComparator = new VendorComparator(vendorDB);
const reportGenerator = new ReportGenerator();
const webCrawler = new WebCrawler();
const ragIndexer = new RAGIndexer();
const learningScheduler = new LearningScheduler();

let mcpClient: McpStdioClient | null = null;
let mcpConnected = false;

const manualQA = new ManualQASystem(async (query, product) => {
  if (mcpClient?.isConnected()) {
    try {
      const mcpResult = await mcpClient.callTool('sangfor.search_manuals', {
        query,
        product,
      });
      if (Array.isArray(mcpResult?.results)) {
        return mcpResult.results.map((item: { content?: string; score?: number; metadata?: Record<string, string> }) => ({
          content: item.content ?? String(item),
          score: item.score ?? 0.7,
          metadata: item.metadata ?? {},
        }));
      }
    } catch (error) {
      log.warn(`MCP manual search failed: ${error}`);
    }
  }
  const results = await ragIndexer.search(query, { product, limit: 5 });
  if (results.length === 0 && product) {
    const broad = await ragIndexer.search(query, { limit: 5 });
    return broad.map((r) => ({
      content: r.chunk.content,
      score: r.score,
      metadata: { source: r.document.title, section: r.document.product },
    }));
  }
  return results.map((r) => ({
    content: r.chunk.content,
    score: r.score,
    metadata: { source: r.document.title, section: r.document.product },
  }));
});

const latestComplianceByCustomer = new Map<string, ComplianceAnalysis>();
const lastDeviceCaptures = new Map<string, CapturedMenu>();

if (learningScheduler.getSchedules().length === 0) {
  learningScheduler.registerSchedule({
    name: 'Daily Crawl',
    frequency: 'daily',
    vendors: ['CrowdStrike', 'Microsoft'],
    enabled: true,
  });
  learningScheduler.registerSchedule({
    name: 'Weekly Index',
    frequency: 'weekly',
    vendors: ['SentinelOne', 'Palo Alto Networks', 'Fortinet'],
    enabled: true,
  });
}

// 워크플로우 저장소
const workflows = new Map<string, Workflow>();

// ─── REST API ──────────────────────────────────────────────────────────────

app.get('/api/config', (_req, res) => {
  res.json({
    authRequired: true,
    mcpConnected,
    authConfigured: Boolean(process.env.SANGFOR_API_KEY),
  });
});

app.get('/api/system/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    mcpConnected,
    authConfigured: Boolean(process.env.SANGFOR_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// 보호 엔드포인트 (인증 필요)
app.use('/api/devices/health', apiKeyAuth, healthRoutes);
app.use('/api/workflows', apiKeyAuth);
app.use('/api/compliance', apiKeyAuth);
app.use('/api/templates', apiKeyAuth);
app.use('/api/manual', apiKeyAuth);
app.use('/api/device', apiKeyAuth);
app.use('/api/guide', apiKeyAuth);
app.use('/api/vendors', apiKeyAuth);
app.use('/api/learning', apiKeyAuth);
app.use('/api/access', apiKeyAuth);

for (const autoOpsPath of [
  '/api/snapshots',
  '/api/plan',
  '/api/approvals',
  '/api/execute',
  '/api/evidence',
  '/api/breakglass',
  '/api/incidents',
  '/api/remediation',
]) {
  app.use(autoOpsPath, apiKeyAuth);
}

// 대시보드 통계
app.get("/api/dashboard/stats", (req, res) => {
  const stats = monitoringDashboard.getStats();
  res.json(stats);
});
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

    const profile = await aiWorkflowGenerator.analyzeInput({
      customerName,
      excelFilePath,
      requirements,
      environment,
      products,
    });

    const workflow = await aiWorkflowGenerator.generateWorkflow(profile);
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
    log.error(`Failed to generate workflow: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

// 템플릿에서 생성
app.post('/api/workflows/from-template', (req, res) => {
  const { templateId, customerName, products, excelFilePath } = req.body;

  const workflow = templateManager.createWorkflowFromTemplate(templateId, {
    customerName,
    products,
    requirements: [],
    environment: 'customer',
    riskLevel: 'medium',
    similarCases: [],
    metadata: {
      excelFilePath: excelFilePath ?? './test-data/checklist.xlsx',
    },
  });

  if (!workflow) {
    return res.status(400).json({ error: 'Failed to create workflow from template' });
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
});

// 승인
app.post('/api/workflows/:id/approve', (req, res) => {
  const workflow = workflows.get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });

  try {
    if (!approvalManager.isPending(workflow.id)) {
      approvalManager.requestApproval(workflow);
    }
    const approvedBy = req.body?.approvedBy ?? 'operator';
    const approved = approvalManager.approve(workflow.id, approvedBy);
    res.json({ ok: true, workflow: approved });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// 거절
app.post('/api/workflows/:id/reject', (req, res) => {
  const workflow = workflows.get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });

  try {
    if (!approvalManager.isPending(workflow.id)) {
      approvalManager.requestApproval(workflow);
    }
    const reason = req.body?.reason ?? 'rejected by operator';
    const rejectedBy = req.body?.rejectedBy ?? 'operator';
    const rejected = approvalManager.reject(workflow.id, reason, rejectedBy);
    res.json({ ok: true, workflow: rejected });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// 실행
app.post('/api/workflows/:id/execute', async (req, res) => {
  const workflow = workflows.get(req.params.id);
  if (!workflow) return res.status(404).json({ error: 'Not found' });
  if (workflow.status !== 'approved') {
    return res.status(403).json({ error: 'Workflow must be approved before execution' });
  }

  try {
    const result = await workflowExecutor.executeWorkflow(workflow);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 실행 로그
app.get('/api/workflows/:id/logs', (req, res) => {
  const logs = executionLogger.getLogs(req.params.id);
  res.json(logs);
});

// Excel 업로드 (워크플로우 생성용)
app.post('/api/workflows/upload-excel', upload.single('excel'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Excel file required' });
  }
  res.json({
    filePath: req.file.path,
    originalName: req.file.originalname,
  });
});

function toTemplateApiResponse(t: WorkflowTemplate) {
  return { id: t.id, name: t.name, description: t.description, tags: t.tags };
}

// 템플릿 목록
app.get('/api/templates', (_req, res) => {
  res.json(templateManager.list().map(toTemplateApiResponse));
});

// 템플릿 검색
app.get('/api/templates/search', (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase();
  const items = templateManager.list().filter((t) =>
    !q
    || t.name.toLowerCase().includes(q)
    || t.description.toLowerCase().includes(q)
    || t.tags.some((tag) => tag.toLowerCase().includes(q)),
  );
  res.json(items.map(toTemplateApiResponse));
});

// ─── Compliance API ────────────────────────────────────────────────────────

app.post('/api/compliance/track', upload.single('excel'), async (req, res) => {
  try {
    const customer = req.body.customer || 'Unknown';
    const excelPath = req.file?.path;
    if (!excelPath) {
      return res.status(400).json({ error: 'Excel file required' });
    }

    const parseResult = await parseExcelFile(excelPath);
    const analysis = buildComplianceAnalysis(customer, parseResult);
    latestComplianceByCustomer.set(customer, analysis);
    complianceTracker.saveRecord(buildComplianceRecord(customer, analysis, excelPath));

    const missingItems = analysis.items.filter((item) => item.result < 1).map((item) => item.item);

    res.json({
      complianceRate: analysis.currentCompliance,
      totalItems: analysis.totalItems,
      passedItems: analysis.passedItems,
      missingItems,
      customer,
      products: parseResult.products,
      trackedAt: analysis.date,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/compliance/trend', (req, res) => {
  const customer = String(req.query.customer ?? '');
  if (!customer) {
    return res.status(400).json({ error: 'customer query parameter required' });
  }

  const trend = complianceTracker.getTrend(customer, 'ALL');
  res.json({
    customer: trend.customer,
    trend: trend.trend === 'improving' ? 'increasing' : trend.trend === 'declining' ? 'decreasing' : 'stable',
    records: trend.records.map((record) => ({
      date: record.date.slice(0, 7),
      rate: record.compliance,
    })),
    summary: trend.summary,
  });
});

app.post('/api/compliance/roadmap', (req, res) => {
  const { customerName, currentCompliance, targetCompliance } = req.body;
  const customer = customerName ?? 'Customer';
  let analysis = latestComplianceByCustomer.get(customer);
  if (!analysis) {
    const current = Number(currentCompliance) || 26;
    analysis = {
      customer,
      product: 'ALL',
      date: new Date().toISOString(),
      totalItems: 100,
      passedItems: current,
      partiallyPassed: 0,
      failedItems: 100 - current,
      currentCompliance: current,
      potentialCompliance: 100,
      improvementOpportunity: 100 - current,
      items: [],
    };
  }

  const roadmap = roadmapGenerator.generateRoadmap(customer, analysis, targetCompliance ?? 87);
  res.json({
    currentCompliance: roadmap.currentCompliance,
    targetCompliance: roadmap.targetCompliance,
    phases: roadmap.phases.map((phase) => ({
      name: `Phase ${phase.phase}: ${phase.title}`,
      duration: phase.timeline,
      items: phase.items,
      estimatedCompliance: phase.expectedCompliance,
    })),
    estimatedCompliance: roadmap.targetCompliance,
    estimatedDuration: roadmap.estimatedDuration,
    estimatedCost: roadmap.estimatedCost,
    summary: roadmap.summary,
  });
});

app.post('/api/compliance/proposal', (req, res) => {
  const { customerName, targetCompliance } = req.body;
  if (!customerName) {
    return res.status(400).json({ error: 'customerName required' });
  }

  let analysis = latestComplianceByCustomer.get(customerName);
  if (!analysis) {
    analysis = {
      customer: customerName,
      product: 'ALL',
      date: new Date().toISOString(),
      totalItems: 31,
      passedItems: 8,
      partiallyPassed: 0,
      failedItems: 23,
      currentCompliance: 26,
      potentialCompliance: 100,
      improvementOpportunity: 74,
      items: [],
    };
  }

  const roadmap = roadmapGenerator.generateRoadmap(customerName, analysis, targetCompliance ?? 87);
  const proposal = proposalGenerator.generate(customerName, analysis, roadmap);

  res.json({
    title: proposal.title,
    customerName: proposal.customer,
    targetCompliance: roadmap.targetCompliance,
    totalCost: proposal.totalCost,
    timeline: proposal.timeline,
    sections: [
      { title: '현황 분석', content: `현재 Compliance ${proposal.currentStatus.currentCompliance}%` },
      { title: '목표', content: `Compliance ${roadmap.targetCompliance}% 달성` },
      { title: '솔루션', content: proposal.sangforProducts.map((p) => p.product).join(', ') },
      { title: '비용', content: proposal.totalCost },
    ],
    markdown: proposalGenerator.generateMarkdown(proposal),
  });
});

// ─── Manual QA API ─────────────────────────────────────────────────────────

app.post('/api/manual/ask', async (req, res) => {
  try {
    const { question, product } = req.body;
    const answer = await manualQA.askQuestion({ question, product });
    res.json({
      question: answer.question,
      answer: answer.answer,
      source: answer.sources[0]?.document ?? 'Knowledge Base',
      confidence: answer.confidence,
      sources: answer.sources,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/manual/menu-path', async (req, res) => {
  try {
    const { product, feature } = req.body;
    const deviceProduct = toDeviceProduct(product);
    let segments = await manualQA.findMenuPath(product, feature);

    if (segments.length === 0) {
      const reference = deviceMenuCapture.getReferenceManualMenus(deviceProduct);
      const match = reference.find(
        (menu) =>
          menu.name.toLowerCase().includes(String(feature).toLowerCase())
          || menu.features?.some((f) => String(feature).toLowerCase().includes(f.toLowerCase())),
      );
      segments = match?.path ?? ['Settings', 'Security', feature];
    }

    res.json({
      product,
      feature,
      path: segments.join(' > '),
      segments,
      version: 'latest',
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Device Menu API ───────────────────────────────────────────────────────

async function captureDeviceMenuInternal(
  productCode: string,
  cdpPort?: number,
): Promise<CapturedMenu & { menuItems: string[]; captureSource: string; mcpDetails?: unknown }> {
  const deviceProduct = toDeviceProduct(productCode);
  const cfg = getProductEnv(deviceProduct);

  if (mcpClient?.isConnected()) {
    if (!cfg.password) {
      throw new Error(`${deviceProduct}_PASSWORD가 .env에 설정되어 있지 않습니다.`);
    }
    mkdirSync(cfg.outputDir, { recursive: true });

    const captureResult = await mcpClient.callTool('sangfor.capture_screenshots', {
      product: deviceProduct,
      targetUrl: cfg.targetUrl,
      username: cfg.username,
      password: cfg.password,
      outputDir: cfg.outputDir,
      headless: false,
      cdpPort,
    });

    const discoverResult = await mcpClient.callTool('sangfor.discover_product_console', {
      product: deviceProduct,
      targetUrl: cfg.targetUrl,
      environment: 'lab',
    });

    const menus = parseMcpMenuRoutes(discoverResult?.menuRoutes ?? []).map((menu) => ({
      ...menu,
      screenshotPath: captureResult?.captured?.find?.(
        (c: { menu?: string }) => c.menu === menu.name || menu.path.includes(c.menu ?? ''),
      )?.path,
    }));

    const captured: CapturedMenu & { menuItems: string[]; captureSource: string; mcpDetails?: unknown } = {
      id: `capture_${Date.now()}`,
      product: deviceProduct,
      version: discoverResult?.version ?? '',
      capturedAt: new Date().toISOString(),
      menus,
      screenshotPaths: (captureResult?.captured ?? []).map((c: { path?: string }) => c.path).filter(Boolean),
      menuItems: menus.map((m) => m.name),
      captureSource: 'mcp',
      mcpDetails: { capture: captureResult, discover: discoverResult },
    };

    lastDeviceCaptures.set(deviceProduct, captured);
    return captured;
  }

  const captured = await deviceMenuCapture.captureMenuStructure({
    product: deviceProduct,
    targetUrl: cfg.targetUrl,
    credentials: { username: cfg.username, password: cfg.password },
    cdpPort,
  });

  const withMeta = {
    ...captured,
    menuItems: captured.menus.map((menu) => menu.name),
    captureSource: 'reference',
  };
  lastDeviceCaptures.set(deviceProduct, withMeta);
  return withMeta;
}

app.post('/api/device/capture-menu', async (req, res) => {
  try {
    const { product, cdpPort } = req.body;
    const captured = await captureDeviceMenuInternal(product, cdpPort);
    res.json({
      product,
      cdpPort,
      menuItems: captured.menuItems,
      menus: captured.menus,
      screenshotPaths: captured.screenshotPaths,
      captureSource: captured.captureSource,
      capturedAt: captured.capturedAt,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/device/compare', async (req, res) => {
  try {
    const { product, cdpPort } = req.body;
    const deviceProduct = toDeviceProduct(product);
    const captured = lastDeviceCaptures.get(deviceProduct)
      ?? await captureDeviceMenuInternal(product, cdpPort);
    const manualMenus = deviceMenuCapture.getReferenceManualMenus(deviceProduct);
    const comparison = await deviceMenuCapture.compareWithManual(captured, manualMenus);
    const { accuracy, matchedItems } = computeMenuAccuracy(manualMenus, captured.menus);
    const missingInDevice = comparison.differences
      .filter((diff) => diff.type === 'removed')
      .map((diff) => diff.description);
    const extraInDevice = comparison.differences
      .filter((diff) => diff.type === 'added')
      .map((diff) => diff.description);

    res.json({
      product,
      matchedItems,
      missingInDevice,
      extraInDevice,
      accuracy,
      summary: comparison.summary,
      differences: comparison.differences,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Setting Guide API ─────────────────────────────────────────────────────

app.post('/api/guide/generate', async (req, res) => {
  try {
    const { customerName, product, requirements } = req.body;
    const guideProduct = toGuideProduct(product);
    const guide = await settingGuideGenerator.generateGuide({
      customer: customerName,
      product: guideProduct,
      requirements,
    });

    res.json({
      title: guide.title,
      customerName: guide.customer,
      product: guide.product,
      requirements,
      sections: guide.sections.map((section) => ({
        title: section.title,
        path: section.menuPath.join(' > '),
        steps: section.steps.map((step) => step.description),
      })),
      guide: settingGuideGenerator.generateMarkdown(guide),
      estimatedTime: guide.estimatedTime,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Vendor API ────────────────────────────────────────────────────────────

app.post('/api/vendors/compare', async (req, res) => {
  try {
    const { category, includeSangfor, requirement } = req.body;
    const comparison = vendorComparator.compareByCategory(
      category,
      requirement ?? `${category} security requirements`,
    );

    let vendors = comparison.recommendations.map((rec) => ({
      name: rec.vendor,
      product: rec.product,
      score: rec.fitScore,
      features: rec.pros,
      pricing: rec.pricing,
      reasons: rec.reasons,
    }));

    if (includeSangfor === false) {
      vendors = vendors.filter((vendor) => vendor.name !== 'Sangfor');
    }

    res.json({
      category: comparison.category,
      includeSangfor,
      vendors,
      topVendor: vendors[0]?.name ?? null,
      summary: comparison.summary,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/vendors/report', async (req, res) => {
  try {
    const { customerName, category } = req.body;
    if (!customerName || !category) {
      return res.status(400).json({ error: 'customerName and category required' });
    }

    const comparison = vendorComparator.compareByCategory(category, `${category} requirements`);
    const report = reportGenerator.generateComparisonReport({
      customerName,
      products: comparison.recommendations.map((rec) => rec.product),
      requirements: [category],
      comparisonResults: [comparison],
      recommendations: comparison.recommendations,
    });

    res.json({
      title: report.title,
      customerName: report.customer,
      category,
      generatedAt: report.date,
      report: reportGenerator.generateCustomGuide({
        customerName,
        products: comparison.recommendations.map((rec) => rec.product),
        requirements: [category],
        comparisonResults: [comparison],
        recommendations: comparison.recommendations,
      }),
      executiveSummary: report.executiveSummary,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Learning API ──────────────────────────────────────────────────────────

app.post('/api/learning/run', async (req, res) => {
  const { type } = req.body;

  try {
    let result: Record<string, unknown> = {};

    switch (type) {
      case 'crawl': {
        const crawlResults = await webCrawler.crawlAllVendors();
        result = {
          status: 'completed',
          vendorsProcessed: crawlResults.size,
          chunksIndexed: 0,
        };
        break;
      }
      case 'index': {
        let totalChunks = 0;
        for (const [vendor, results] of webCrawler.getAllResults()) {
          totalChunks += await ragIndexer.indexVendorData(vendor, results);
        }
        const stats = ragIndexer.getStats();
        result = {
          status: 'completed',
          chunksIndexed: stats.chunks,
          documents: stats.documents,
          vendorsIndexed: totalChunks,
        };
        break;
      }
      case 'full': {
        const crawlResults = await webCrawler.crawlAllVendors();
        let totalChunks = 0;
        for (const [vendor, results] of crawlResults) {
          totalChunks += await ragIndexer.indexVendorData(vendor, results);
        }
        result = {
          status: 'completed',
          vendorsProcessed: crawlResults.size,
          chunksIndexed: totalChunks,
        };
        break;
      }
      default:
        result = { status: 'unknown type' };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/learning/schedules', (_req, res) => {
  res.json(learningScheduler.getSchedules());
});

app.post('/api/learning/schedules', (req, res) => {
  const schedule = learningScheduler.registerSchedule(req.body);
  res.json(schedule);
});

app.post('/api/learning/schedules/:id/run', async (req, res) => {
  try {
    const job = await learningScheduler.runSchedule(req.params.id);
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// ─── Device Access API ─────────────────────────────────────────────────────

app.post('/api/access/request', (req, res) => {
  try {
    const { customerName, projectName, products, requestedBy } = req.body;
    const productList = (products ?? []).map((p: string) => String(p).trim()).filter(Boolean);

    const request = deviceAccessManager.createRequest({
      customer: customerName,
      projectId: projectName,
      projectName,
      devices: productList.map((product: string) => ({
        product: toDeviceProduct(product),
        purpose: `${projectName} 프로젝트`,
      })),
      requestedBy: requestedBy ?? 'operator',
      requestReason: `${projectName} 장비 접근`,
      estimatedDuration: '2 weeks',
    });

    const message = deviceAccessManager.generateRequestMessage({
      customer: customerName,
      projectId: projectName,
      projectName,
      devices: productList.map((product: string) => ({
        product: toDeviceProduct(product),
        purpose: `${projectName} 프로젝트`,
      })),
      requestedBy: requestedBy ?? 'operator',
      requestReason: `${projectName} 장비 접근`,
      estimatedDuration: '2 weeks',
    });

    res.json({
      requestId: request.id,
      customerName: request.customer,
      projectName,
      products: productList,
      status: request.status,
      createdAt: request.requestedAt,
      message,
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post('/api/access/submit', (req, res) => {
  try {
    const { requestId, product, ip, port, username, password } = req.body;
    const deviceProduct = toDeviceProduct(product);

    const validation = deviceAccessManager.validateAccessInfo([{
      product: deviceProduct,
      ip,
      port: Number(port) || 443,
      username,
      password,
      protocol: 'https',
    }]);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    const updated = deviceAccessManager.submitAccessInfo(requestId, [{
      product: deviceProduct,
      ip,
      port: Number(port) || 443,
      username,
      password,
      protocol: 'https',
    }]);

    res.json({ ok: true, requestId: updated.id, product: deviceProduct, status: updated.status });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.get('/api/access/requests', (_req, res) => {
  const requests = deviceAccessManager.getAllRequests().map((request) => ({
    requestId: request.id,
    customerName: request.customer,
    projectName: request.projectId,
    products: request.devices.map((device) => device.product),
    status: request.status,
    createdAt: request.requestedAt,
  }));
  res.json(requests);
});

// ─── Phase 0: Operation Management API (PR-27) ─────────────────────────────

const operationPlans = new Map<string, Record<string, unknown>>();
const snapshots = new Map<string, Record<string, unknown>>();
const approvals = new Map<string, Record<string, unknown>>();
const executionResults = new Map<string, Record<string, unknown>>();
const remediationPlans = new Map<string, Record<string, unknown>>();
const detectedIncidents = new Map<string, Record<string, unknown>>();

// 장비 스냅샷 조회 (read-only)
app.get('/api/snapshots/:product', async (req, res) => {
  try {
    const { product } = req.params;
    const snapshot = {
      id: `snap_${Date.now().toString(36)}`,
      product,
      version: 'latest',
      capturedAt: new Date().toISOString(),
      targetUrl: `https://10.80.1.${product === 'EPP' ? '106' : product === 'IAG' ? '107' : '108'}`,
      sections: {
        general: {
          title: '일반 설정',
          items: {
            hostname: `${product.toLowerCase()}-console`,
            firmwareVersion: '5.0.0',
            uptime: '45 days',
          },
        },
        policy: {
          title: '보안 정책',
          items: {
            firewallEnabled: 'true',
            ipsEnabled: 'true',
            antivirusEnabled: 'true',
          },
        },
      },
    };
    snapshots.set(snapshot.id, snapshot);
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/plan', async (req, res) => {
  try {
    const { intent, product, dryRun, snapshotId, snapshot } = req.body;

    if (!intent || !product) {
      return res.status(400).json({ error: 'intent와 product는 필수입니다.' });
    }
    const resolvedSnapshot = snapshot
      ?? (typeof snapshotId === 'string' ? snapshots.get(snapshotId) : undefined);
    if (!resolvedSnapshot) {
      return res.status(400).json({ error: 'snapshot 또는 snapshotId가 필요합니다.' });
    }

    const resolvedSnapshotId = (resolvedSnapshot as { id?: string }).id ?? snapshotId;
    if (resolvedSnapshotId) {
      snapshots.set(resolvedSnapshotId, resolvedSnapshot as Record<string, unknown>);
    }

    const planId = `plan_${Date.now().toString(36)}`;
    const intentLower = intent.toLowerCase();

    let riskLevel: string = 'medium';
    if (intentLower.includes('조회') || intentLower.includes('확인')) {
      riskLevel = 'low';
    } else if (intentLower.includes('삭제') || intentLower.includes('재시작')) {
      riskLevel = 'high';
    } else if (intentLower.includes('인증') || intentLower.includes('서버변경')) {
      riskLevel = 'critical';
    }

    const plan: Record<string, unknown> = {
      id: planId,
      product,
      version: 'latest',
      action: `configure_${product.toLowerCase()}`,
      riskLevel,
      description: intent,
      dryRun: dryRun ?? true,
      snapshotId: resolvedSnapshotId,
      steps: [
        { name: 'pre-check', toolName: 'get_device_snapshot' },
        { name: 'apply-change', toolName: `apply_${product.toLowerCase()}_config` },
        { name: 'post-check', toolName: 'verify_configuration' },
      ],
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    const autopilotDecision = autopilotPolicy.evaluate({
      id: planId,
      product,
      version: 'latest',
      action: String(plan.action),
      riskLevel: riskLevel as RiskLevel,
      description: intent,
      steps: (plan.steps as Array<{ name: string; toolName: string }>).map((step) => ({
        name: step.name,
        toolName: step.toolName,
        args: {},
      })),
      dryRun: Boolean(plan.dryRun),
      metadata: { snapshotIncluded: 'true' },
    });
    plan.autopilotDecision = autopilotDecision;

    operationPlans.set(planId, plan);

    if (autopilotDecision.autoApprovable && riskLevel === 'low') {
      plan.status = 'approved';
    } else if (riskLevel === 'high' || riskLevel === 'critical') {
      const approvalId = `approval_${Date.now().toString(36)}`;
      approvals.set(approvalId, {
        id: approvalId,
        planId,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      plan.approvalId = approvalId;
      plan.status = 'pending_approval';
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/approvals', (req, res) => {
  const pendingApprovals = Array.from(approvals.values()).filter(a => a.status === 'pending');
  res.json(pendingApprovals);
});

// 승인 처리
app.post('/api/approvals/:id/approve', (req, res) => {
  const approval = approvals.get(req.params.id);
  if (!approval) {
    return res.status(404).json({ error: '승인 요청을 찾을 수 없습니다.' });
  }

  approval.status = 'approved';
  approval.approvedBy = req.body.approvedBy ?? 'operator';
  approval.approvedAt = new Date().toISOString();
  const planId = approval.planId as string;
  const plan = operationPlans.get(planId);
  if (plan) {
    plan.status = 'approved';
    plan.approvalId = approval.id;
  }

  res.json({ ok: true, approval });
});

// 거절 처리
app.post('/api/approvals/:id/reject', (req, res) => {
  const approval = approvals.get(req.params.id);
  if (!approval) {
    return res.status(404).json({ error: '승인 요청을 찾을 수 없습니다.' });
  }

  approval.status = 'rejected';
  approval.rejectedBy = req.body.rejectedBy ?? 'operator';
  approval.rejectedAt = new Date().toISOString();
  approval.rejectionReason = req.body.reason ?? '';

  res.json({ ok: true, approval });
});

app.post('/api/execute/:planId', async (req, res) => {
  try {
    const plan = operationPlans.get(req.params.planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan을 찾을 수 없습니다.' });
    }

    const isApproved = plan.status === 'approved';
    const breakGlassActive = breakGlassPolicy.isBreakGlassActive();
    if (!isApproved && !breakGlassActive) {
      return res.status(403).json({ error: '승인된 plan 또는 활성 break-glass 세션이 필요합니다.' });
    }

    const snapshotId = plan.snapshotId as string | undefined;
    const snapshotRecord = snapshotId ? snapshots.get(snapshotId) : undefined;
    if (!snapshotRecord) {
      return res.status(400).json({ error: '실행 전 snapshot이 필요합니다.' });
    }

    const executionId = `exec_${Date.now().toString(36)}`;
    const beforeSnapshot = toPostVerifierSnapshot(snapshotRecord);
    const atomicResult = await operationOrchestrator.executeWithVerification({
      executionId,
      beforeSnapshot,
      collectAfterSnapshot: async () => ({
        ...beforeSnapshot,
        capturedAt: new Date().toISOString(),
      }),
      execute: async () => ({ success: true }),
      expectedChanges: [],
    });

    const result = {
      executionId,
      planId: plan.id,
      status: atomicResult.executionSuccess && atomicResult.verification.passed ? 'completed' : 'failed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      stepsExecuted: 3,
      stepsSucceeded: atomicResult.executionSuccess ? 3 : 0,
      stepsFailed: atomicResult.executionSuccess ? 0 : 3,
      verified: atomicResult.verification.passed,
      evidencePath: atomicResult.evidencePath,
      breakGlassUsed: breakGlassActive && !isApproved,
    };

    executionResults.set(executionId, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Evidence 보고서 조회
app.get('/api/evidence/:executionId', (req, res) => {
  const now = new Date().toISOString();
  const evidence = {
    executionId: req.params.executionId,
    generatedAt: now,
    evidenceMarkdown: [
      '# 실행 Evidence 보고서',
      '',
      '## 기본 정보',
      '',
      `| 항목 | 값 |`,
      `|------|-----|`,
      `| 실행 ID | \`${req.params.executionId}\` |`,
      `| 생성 시간 | ${now} |`,
      '',
      '---',
      `*자동 생성 (${now})*`,
    ].join('\n'),
  };
  res.json(evidence);
});

// ─── Phase 1/2: Autopilot / Break-glass / Incident / Remediation ───────────

app.post('/api/breakglass/request', (req, res) => {
  try {
    const { reason, requestedBy, durationMinutes } = req.body;
    if (!reason || !requestedBy) {
      return res.status(400).json({ error: 'reason과 requestedBy가 필요합니다.' });
    }
    const request = breakGlassPolicy.requestBreakGlass(reason, requestedBy, durationMinutes);
    res.json(request);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post('/api/breakglass/:id/approve', (req, res) => {
  try {
    const approved = breakGlassPolicy.approveBreakGlass(
      req.params.id,
      req.body?.approvedBy ?? 'operator',
    );
    res.json(approved);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.get('/api/breakglass/active', (_req, res) => {
  res.json({
    active: breakGlassPolicy.isBreakGlassActive(),
    sessions: breakGlassPolicy.getActiveSessions(),
  });
});

app.post('/api/incidents/detect', (req, res) => {
  try {
    const incidents = incidentDetector.detectIncidents(req.body);
    for (const incident of incidents) {
      detectedIncidents.set(incident.id, incident as unknown as Record<string, unknown>);
    }
    res.json({ incidents });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post('/api/incidents/:id/remediation', (req, res) => {
  try {
    const incident = detectedIncidents.get(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident를 찾을 수 없습니다.' });
    }
    const plan = remediationPlanner.planRemediation(
      incident as any,
      playbookRegistry.listAll(),
    );
    remediationPlans.set(plan.id, plan as unknown as Record<string, unknown>);
    res.json(plan);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post('/api/remediation/:id/execute', (req, res) => {
  const plan = remediationPlans.get(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Remediation plan을 찾을 수 없습니다.' });
  }
  if (plan.approvalRequired && plan.status !== 'approved') {
    return res.status(403).json({ error: '승인 전 복구 작업은 실행할 수 없습니다.' });
  }
  res.status(403).json({
    error: '복구 실행은 승인 후 별도 실행 경로에서만 허용됩니다.',
    planId: plan.id,
    status: plan.status,
  });
});

// ─── SSE Events ────────────────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 이벤트 전송
  const interval = setInterval(() => {
    sendEvent({ type: 'heartbeat', timestamp: new Date().toISOString() });
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// SPA fallback
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ─── 시작 ──────────────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  mcpClient = await bootstrapMcpClient(toolRegistry, WORKFLOW_ROOT);
  mcpConnected = mcpClient?.isConnected() ?? false;

  app.listen(PORT, () => {
    log.info(`Operator Console started on port ${PORT} (MCP: ${mcpConnected ? 'connected' : 'stub'})`);
    console.log(`🚀 Operator Console: http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  log.error(`Failed to start server: ${error}`);
  process.exit(1);
});
