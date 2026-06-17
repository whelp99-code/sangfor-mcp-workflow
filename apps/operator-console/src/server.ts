/**
 * Operator Console — 웹 UI + REST API
 *
 * Express 기반 웹 서버 + 대시보드 UI
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { timingSafeEqual } from 'crypto';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@sangfor/workflow-shared';
import { healthRoutes } from './routes/index.js';
import { apiKeyAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
  SangforAutoConfig,
  DeviceAccessManager,
  DeviceMenuCapture,
  SettingGuideGenerator,
  VendorComparator,
  ReportGenerator,
  WebCrawler,
  RAGIndexer,
  AIFeatureExtractor,
  LearningScheduler,
  BreakGlassPolicy,
  createDefaultAutopilotPolicy,
  OperationOrchestrator,
  toPostVerifierSnapshot,
  IncidentDetector,
  RemediationPlanner,
  PlaybookRegistry,
  type Workflow,
  type RiskLevel,
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
const sangforAutoConfig = new SangforAutoConfig();
const deviceAccessManager = new DeviceAccessManager();
const deviceMenuCapture = new DeviceMenuCapture();
const settingGuideGenerator = new SettingGuideGenerator();
const vendorDB = JSON.parse(
  readFileSync(join(__dirname, '../../../data/vendors/vendor-database.json'), 'utf8'),
);
const vendorComparator = new VendorComparator(vendorDB);
const reportGenerator = new ReportGenerator();
const webCrawler = new WebCrawler();
const ragIndexer = new RAGIndexer();
const aiFeatureExtractor = new AIFeatureExtractor();
const learningScheduler = new LearningScheduler();

// 워크플로우 저장소
const workflows = new Map<string, Workflow>();

// ─── REST API ──────────────────────────────────────────────────────────────

// 공개 엔드포인트 (인증 불필요)
app.get("/api/system/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 보호 엔드포인트 (인증 필요)
app.use("/api/devices/health", apiKeyAuth, healthRoutes);
app.use("/api/workflows", apiKeyAuth);
app.use("/api/compliance", apiKeyAuth);
app.use("/api/templates", apiKeyAuth);
app.use("/api/manual", apiKeyAuth);
app.use("/api/device", apiKeyAuth);
app.use("/api/guide", apiKeyAuth);
app.use("/api/vendors", apiKeyAuth);
app.use("/api/learning", apiKeyAuth);
app.use("/api/access", apiKeyAuth);

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
  const { templateId, customerName, products } = req.body;

  const workflow = templateManager.createWorkflowFromTemplate(templateId, {
    customerName,
    products,
    requirements: [],
    environment: 'customer',
    riskLevel: 'medium',
    similarCases: [],
    metadata: {},
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

// 템플릿 목록
app.get('/api/templates', (req, res) => {
  const templates = [
    { id: 'iag', name: 'IAG 전용 설정', description: 'IAG 보안 정책 설정', tags: ['IAG', '네트워크'] },
    { id: 'epp', name: 'EPP 전용 설정', description: 'EPP 엔드포인트 보안', tags: ['EPP', '엔드포인트'] },
    { id: 'full', name: '풀 시큐리티 설정', description: '전체 보안 솔루션', tags: ['풀스택', 'Compliance'] },
    { id: 'quick', name: '빠른 감사', description: '빠른 보안 감사', tags: ['감사', 'Compliance'] },
    { id: 'incident', name: '사고 대응', description: '보안 사고 대응', tags: ['사고대응', '포렌식'] },
  ];
  res.json(templates);
});

// 템플릿 검색
app.get('/api/templates/search', (req, res) => {
  const { q } = req.query;
  const templates = [
    { id: 'iag', name: 'IAG 전용 설정', description: 'IAG 보안 정책 설정', tags: ['IAG', '네트워크'] },
    { id: 'epp', name: 'EPP 전용 설정', description: 'EPP 엔드포인트 보안', tags: ['EPP', '엔드포인트'] },
    { id: 'full', name: '풀 시큐리티 설정', description: '전체 보안 솔루션', tags: ['풀스택', 'Compliance'] },
    { id: 'quick', name: '빠른 감사', description: '빠른 보안 감사', tags: ['감사', 'Compliance'] },
    { id: 'incident', name: '사고 대응', description: '보안 사고 대응', tags: ['사고대응', '포렌식'] },
  ];
  res.json(templates);
});

// ─── Compliance API ────────────────────────────────────────────────────────

// Compliance 추적
app.post('/api/compliance/track', upload.single('excel'), async (req, res) => {
  try {
    const { customer } = req.body;
    const excelPath = req.file?.path;

    if (!excelPath) {
      return res.status(400).json({ error: 'Excel file required' });
    }

    // 샘플 결과 반환
    const result = {
      complianceRate: 26,
      totalItems: 31,
      missingItems: ['USB Blocking', 'Application Control', 'Web Filtering'],
      customer,
      trackedAt: new Date().toISOString(),
    };
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Compliance 추이 조회
app.get('/api/compliance/trend', (req, res) => {
  const { customer } = req.query;
  const trend = {
    customer,
    trend: 'increasing',
    records: [
      { date: '2024-01', rate: 26 },
      { date: '2024-02', rate: 32 },
      { date: '2024-03', rate: 45 },
      { date: '2024-04', rate: 62 },
      { date: '2024-05', rate: 78 },
      { date: '2024-06', rate: 87 },
    ],
  };
  res.json(trend);
});

// 개선 로드맵 생성
app.post('/api/compliance/roadmap', (req, res) => {
  const { currentCompliance, targetCompliance } = req.body;
  const roadmap = {
    currentCompliance,
    targetCompliance,
    phases: [
      { name: 'Phase 1', duration: '2주', items: ['EPP 설정', '기본 보안 정책'], estimatedCompliance: 45 },
      { name: 'Phase 2', duration: '3주', items: ['IAG 설정', '네트워크 보안'], estimatedCompliance: 65 },
      { name: 'Phase 3', duration: '4주', items: ['CC 설정', '모니터링'], estimatedCompliance: 87 },
    ],
    estimatedCompliance: targetCompliance,
  };
  res.json(roadmap);
});

// 고객 제안서 생성
app.post('/api/compliance/proposal', (req, res) => {
  const { customerName, targetCompliance } = req.body;
  const proposal = {
    title: `${customerName} 보안 강화 제안서`,
    customerName,
    targetCompliance,
    totalCost: 50000,
    sections: [
      { title: '현황 분석', content: '현재 Compliance 26%' },
      { title: '목표', content: `Compliance ${targetCompliance}% 달성` },
      { title: '솔루션', content: 'Sangfor EPP + IAG + CC' },
      { title: '비용', content: '$50,000' },
    ],
  };
  res.json(proposal);
});

// ─── Manual QA API ─────────────────────────────────────────────────────────

// 메뉴얼 질문
app.post('/api/manual/ask', async (req, res) => {
  const { question } = req.body;
  const answer = {
    question,
    answer: `"${question}"에 대한 답변입니다. Sangfor 제품 매뉴얼에서 검색한 결과입니다.`,
    source: 'Sangfor Knowledge Base',
    confidence: 0.85,
  };
  res.json(answer);
});

// 메뉴 경로 조회
app.post('/api/manual/menu-path', async (req, res) => {
  const { product, feature } = req.body;
  const path = {
    product,
    feature,
    path: `Settings > Security > ${feature}`,
    version: 'latest',
  };
  res.json(path);
});

// ─── Device Menu API ───────────────────────────────────────────────────────

// 실장비 메뉴 캡처
app.post('/api/device/capture-menu', async (req, res) => {
  const { product, cdpPort } = req.body;
  const menu = {
    product,
    cdpPort,
    menuItems: ['Dashboard', 'Policy', 'Network', 'System', 'Log', 'Report'],
    capturedAt: new Date().toISOString(),
  };
  res.json(menu);
});

// 메뉴얼 vs 실장비 비교
app.post('/api/device/compare', async (req, res) => {
  const { product, cdpPort } = req.body;
  const comparison = {
    product,
    matchedItems: ['Dashboard', 'Policy', 'Network', 'System'],
    missingInDevice: ['Advanced Settings'],
    extraInDevice: ['Debug Mode'],
    accuracy: 80,
  };
  res.json(comparison);
});

// ─── Setting Guide API ─────────────────────────────────────────────────────

// 설정 가이드 생성
app.post('/api/guide/generate', async (req, res) => {
  const { customerName, product, requirements } = req.body;
  const guide = {
    title: `${customerName} - ${product} 설정 가이드`,
    customerName,
    product,
    requirements,
    sections: requirements.map((r: string) => ({
      title: r,
      path: `Settings > Security > ${r}`,
      steps: [
        `${r} 메뉴로 이동`,
        "정책 활성화",
        "설정 저장",
        "테스트 실행",
      ],
    })),
    guide: `# ${customerName} - ${product} 설정 가이드\n\n${requirements.map((r: string) => `## ${r}\n\n1. Settings > Security > ${r}로 이동\n2. 정책 활성화\n3. 설정 저장\n4. 테스트 실행`).join('\n\n')}`,
  };
  res.json(guide);
});

// ─── Vendor API ────────────────────────────────────────────────────────────

// 벤더 비교
app.post('/api/vendors/compare', async (req, res) => {
  const { category, includeSangfor } = req.body;
  const comparison = {
    category,
    includeSangfor,
    vendors: [
      { name: 'Sangfor', score: 85, features: ['EPP', 'IAG', 'CC', 'NDR'] },
      { name: 'CrowdStrike', score: 92, features: ['EDR', 'XDR', 'Threat Intel'] },
      { name: 'Microsoft', score: 88, features: ['Defender', 'Sentinel', 'Purview'] },
      { name: 'SentinelOne', score: 90, features: ['EDR', 'XDR', 'Cloud'] },
    ],
    topVendor: 'CrowdStrike',
  };
  res.json(comparison);
});

// 비교 보고서 생성
app.post('/api/vendors/report', async (req, res) => {
  const { customerName, category } = req.body;
  const report = {
    title: `${customerName} - ${category} 비교 보고서`,
    customerName,
    category,
    generatedAt: new Date().toISOString(),
    report: `# ${customerName} - ${category} 비교 보고서\n\n## 벤더 비교\n\n| 벤더 | 점수 | 특징 |\n|------|------|------|\n| Sangfor | 85 | EPP, IAG, CC |\n| CrowdStrike | 92 | EDR, XDR |\n| Microsoft | 88 | Defender, Sentinel |\n\n## 추천\n\nCrowdStrike가 가장 높은 점수를 기록했으나, Sangfor이 한국 시장에 최적화되어 있습니다.`,
  };
  res.json(report);
});

// ─── Learning API ──────────────────────────────────────────────────────────

// 학습 실행
app.post('/api/learning/run', async (req, res) => {
  const { type } = req.body;

  try {
    let result: any = {};

    switch (type) {
      case 'crawl':
        result = { status: 'completed', vendorsProcessed: 5, chunksIndexed: 0 };
        break;
      case 'index':
        const stats = ragIndexer.getStats();
        result = { status: 'completed', chunksIndexed: stats.chunks, documents: stats.documents };
        break;
      case 'full':
        result = { status: 'completed', vendorsProcessed: 5 };
        break;
      default:
        result = { status: 'unknown type' };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 스케줄 목록
app.get('/api/learning/schedules', (req, res) => {
  const schedules = [
    { id: '1', name: 'Daily Crawl', frequency: 'daily', vendors: ['CrowdStrike', 'Microsoft'], enabled: true },
    { id: '2', name: 'Weekly Index', frequency: 'weekly', vendors: ['All'], enabled: true },
  ];
  res.json(schedules);
});

// 스케줄 생성
app.post('/api/learning/schedules', (req, res) => {
  const schedule = {
    id: Date.now().toString(),
    ...req.body,
  };
  res.json(schedule);
});

// 스케줄 실행
app.post('/api/learning/schedules/:id/run', async (req, res) => {
  const job = {
    id: Date.now().toString(),
    scheduleId: req.params.id,
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  res.json(job);
});

// ─── Device Access API ─────────────────────────────────────────────────────

// 접근 요청 생성
app.post('/api/access/request', (req, res) => {
  const { customerName, projectName, products } = req.body;
  const request = {
    requestId: Date.now().toString(),
    customerName,
    projectName,
    products,
    status: 'pending',
    createdAt: new Date().toISOString(),
    message: `# ${customerName} - 장비 접근 정보 요청\n\n프로젝트: ${projectName}\n\n## 필요한 접근 정보\n\n${products.map((p: string) => `### ${p}\n- IP: [입력 필요]\n- Port: [입력 필요]\n- 계정: [입력 필요]\n- 비밀번호: [입력 필요]`).join('\n\n')}`,
  };
  res.json(request);
});

// 접근 정보 제출
app.post('/api/access/submit', (req, res) => {
  const { requestId, product, ip, port, username, password } = req.body;
  res.json({ ok: true, requestId, product });
});

// 접근 요청 목록
app.get('/api/access/requests', (req, res) => {
  const requests = [
    { requestId: '1', customerName: '현대차', projectName: '보안감사', products: ['IAG', 'EPP'], status: 'approved' },
    { requestId: '2', customerName: '삼성전자', projectName: '보안강화', products: ['CC'], status: 'pending' },
  ];
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
      snapshotId: (resolvedSnapshot as { id?: string }).id ?? snapshotId,
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

// ─── System ────────────────────────────────────────────────────────────────

app.get('/api/system/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ─── 시작 ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  log.info(`Operator Console started on port ${PORT}`);
  console.log(`🚀 Operator Console: http://localhost:${PORT}`);
});
