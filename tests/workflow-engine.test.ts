/**
 * Workflow Engine 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRegistry,
  createDefaultToolDefinitions,
  ExecutionLogger,
  ApprovalManager,
  DependencyAnalyzer,
  WorkflowGenerator,
  ErrorHandler,
  WorkflowExecutor,
  RollbackManager,
  createDefaultAutopilotPolicy,
  OperationOrchestrator,
  toPostVerifierSnapshot,
  IncidentDetector,
  RemediationPlanner,
  PlaybookRegistry,
} from '@sangfor/workflow-engine';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register and retrieve a tool', () => {
    const tool = {
      name: 'test-tool',
      description: 'Test tool',
      inputSchema: { type: 'object' },
      category: 'test',
      tags: ['test'],
      estimatedDuration: '5s',
      riskLevel: 'low' as const,
      requiresApproval: false,
      handler: async () => ({ result: 'ok' }),
    };

    registry.register(tool);
    expect(registry.hasTool('test-tool')).toBe(true);
    expect(registry.getTool('test-tool')).toEqual(tool);
  });

  it('should list all tools', () => {
    registry.registerAll(createDefaultToolDefinitions());
    const tools = registry.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should list tools by category', () => {
    registry.registerAll(createDefaultToolDefinitions());
    const inputTools = registry.listToolsByCategory('input');
    expect(inputTools.length).toBeGreaterThan(0);
    expect(inputTools.every((t) => t.category === 'input')).toBe(true);
  });

  it('should list tools by tag', () => {
    registry.registerAll(createDefaultToolDefinitions());
    const eppTools = registry.listToolsByTag('epp');
    expect(eppTools.length).toBeGreaterThan(0);
    expect(eppTools.every((t) => t.tags.includes('epp'))).toBe(true);
  });

  it('should list tools by product', () => {
    registry.registerAll(createDefaultToolDefinitions());
    const iagTools = registry.listToolsByProduct('IAG');
    expect(iagTools.length).toBeGreaterThan(0);
  });

  it('should get stats', () => {
    registry.registerAll(createDefaultToolDefinitions());
    const stats = registry.getStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byCategory).toBeDefined();
    expect(stats.byProduct).toBeDefined();
  });

  it('should classify mutation tools as approval-required when loading from MCP', async () => {
    const fakeMcpClient = {
      listTools: async () => ([
        { name: 'get_status', description: 'read', inputSchema: { type: 'object' } },
        { name: 'apply_policy', description: 'write', inputSchema: { type: 'object' } },
      ]),
      callTool: async () => ({}),
    };
    registry.setMcpClient(fakeMcpClient as any);
    await registry.registerFromMcpServer();

    const getStatus = registry.getTool('get_status');
    const applyPolicy = registry.getTool('apply_policy');
    expect(getStatus?.requiresApproval).toBe(false);
    expect(getStatus?.riskLevel).toBe('low');
    expect(applyPolicy?.requiresApproval).toBe(true);
    expect(applyPolicy?.riskLevel).toBe('high');
  });
});

describe('ExecutionLogger', () => {
  let logger: ExecutionLogger;

  beforeEach(() => {
    logger = new ExecutionLogger();
  });

  it('should log execution entry', () => {
    const entry = logger.log({
      workflowId: 'wf-1',
      stepId: 'step-1',
      toolName: 'test-tool',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      retryCount: 0,
      metadata: {},
    });

    expect(entry.id).toBeDefined();
    expect(entry.workflowId).toBe('wf-1');
  });

  it('should get logs by workflow', () => {
    logger.log({
      workflowId: 'wf-1',
      stepId: 'step-1',
      toolName: 'tool-1',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      retryCount: 0,
      metadata: {},
    });
    logger.log({
      workflowId: 'wf-1',
      stepId: 'step-2',
      toolName: 'tool-2',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      retryCount: 0,
      metadata: {},
    });
    logger.log({
      workflowId: 'wf-2',
      stepId: 'step-1',
      toolName: 'tool-1',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      retryCount: 0,
      metadata: {},
    });

    const wf1Logs = logger.getLogs('wf-1');
    expect(wf1Logs.length).toBe(2);
  });

  it('should get error logs', () => {
    logger.log({
      workflowId: 'wf-1',
      stepId: 'step-1',
      toolName: 'tool-1',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      error: 'Test error',
      retryCount: 0,
      metadata: {},
    });

    const errorLogs = logger.getErrorLogs();
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].error).toBe('Test error');
  });

  it('should get stats', () => {
    logger.log({
      workflowId: 'wf-1',
      stepId: 'step-1',
      toolName: 'tool-1',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      duration: 100,
      retryCount: 0,
      metadata: {},
    });
    logger.log({
      workflowId: 'wf-1',
      stepId: 'step-2',
      toolName: 'tool-2',
      toolArgs: {},
      startedAt: new Date().toISOString(),
      duration: 200,
      error: 'Error',
      retryCount: 0,
      metadata: {},
    });

    const stats = logger.getStats('wf-1');
    expect(stats.total).toBe(2);
    expect(stats.succeeded).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.totalDuration).toBe(300);
  });
});

describe('ApprovalManager', () => {
  let manager: ApprovalManager;

  beforeEach(() => {
    manager = new ApprovalManager();
  });

  it('should request approval', () => {
    const workflow = { id: 'wf-1', name: 'Test', status: 'draft' } as any;
    const request = manager.requestApproval(workflow);

    expect(request.workflowId).toBe('wf-1');
    expect(request.status).toBe('pending');
    expect(manager.isPending('wf-1')).toBe(true);
  });

  it('should approve workflow', () => {
    const workflow = { id: 'wf-1', name: 'Test', status: 'draft' } as any;
    manager.requestApproval(workflow);

    const approved = manager.approve('wf-1', 'test-user');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('test-user');
    expect(manager.isPending('wf-1')).toBe(false);
  });

  it('should reject workflow', () => {
    const workflow = { id: 'wf-1', name: 'Test', status: 'draft' } as any;
    manager.requestApproval(workflow);

    const rejected = manager.reject('wf-1', 'Not enough info');
    expect(rejected.status).toBe('rejected');
    expect(manager.isPending('wf-1')).toBe(false);
  });

  it('should list pending approvals', () => {
    const workflow1 = { id: 'wf-1', name: 'Test 1', status: 'draft' } as any;
    const workflow2 = { id: 'wf-2', name: 'Test 2', status: 'draft' } as any;

    manager.requestApproval(workflow1);
    manager.requestApproval(workflow2);

    const pending = manager.listPendingApprovals();
    expect(pending.length).toBe(2);
  });

  it('should get stats', () => {
    const workflow1 = { id: 'wf-1', name: 'Test 1', status: 'draft' } as any;
    const workflow2 = { id: 'wf-2', name: 'Test 2', status: 'draft' } as any;

    manager.requestApproval(workflow1);
    manager.requestApproval(workflow2);
    manager.approve('wf-1', 'user');

    const stats = manager.getStats();
    expect(stats.pending).toBe(1);
    expect(stats.totalApproved).toBe(1);
    expect(stats.totalRejected).toBe(0);
  });
});

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    analyzer = new DependencyAnalyzer();
  });

  it('should analyze dependencies', () => {
    const tools = createDefaultToolDefinitions();
    const dependencies = analyzer.analyzeDependencies(tools);

    expect(dependencies.length).toBeGreaterThan(0);
    expect(dependencies.every((d) => d.sourceTool && d.targetTool)).toBe(true);
  });

  it('should detect cycles', () => {
    const dependencies = [
      { sourceTool: 'A', targetTool: 'B', required: true, fieldMapping: {} },
      { sourceTool: 'B', targetTool: 'C', required: true, fieldMapping: {} },
      { sourceTool: 'C', targetTool: 'A', required: true, fieldMapping: {} },
    ];

    const cycles = analyzer.detectCycles(dependencies);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should validate dependencies', () => {
    const tools = createDefaultToolDefinitions();
    const dependencies = analyzer.analyzeDependencies(tools);

    const validation = analyzer.validateDependencies(tools, dependencies);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });
});

describe('WorkflowGenerator', () => {
  let generator: WorkflowGenerator;

  beforeEach(() => {
    generator = new WorkflowGenerator();
  });

  it('should analyze input and create customer profile', async () => {
    const profile = await generator.analyzeInput({
      customerName: '테스트 고객',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정', 'USB 정책 적용'],
    });

    expect(profile.customerName).toBe('테스트 고객');
    expect(profile.products).toBeDefined();
    expect(profile.requirements).toBeDefined();
    expect(profile.riskLevel).toBeDefined();
  });

  it('should generate workflow', async () => {
    const profile = await generator.analyzeInput({
      customerName: '테스트 고객',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['URL 필터링 설정'],
    });

    const workflow = await generator.generateWorkflow(profile);

    expect(workflow.id).toBeDefined();
    expect(workflow.name).toContain('테스트 고객');
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.reasoning).toBeDefined();
    expect(workflow.estimatedDuration).toBeDefined();
    expect(workflow.status).toBe('draft');
  });

  it('should respect dependencies in workflow', async () => {
    const profile = await generator.analyzeInput({
      customerName: '테스트 고객',
      excelFilePath: './test-data/checklist.xlsx',
    });

    const workflow = await generator.generateWorkflow(profile);

    // import_excel이 analyze_requirements보다 먼저 실행되어야 함
    const importIndex = workflow.steps.findIndex((s) => s.toolName === 'import_excel');
    const analyzeIndex = workflow.steps.findIndex((s) => s.toolName === 'analyze_requirements');

    if (importIndex !== -1 && analyzeIndex !== -1) {
      expect(importIndex).toBeLessThan(analyzeIndex);
    }
  });
});

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  it('should classify timeout errors', async () => {
    const step = {
      retryPolicy: { maxRetries: 2, backoff: 'exponential', retryOn: ['timeout'] },
      optional: false,
    } as any;

    const decision = await handler.handleError(step, new Error('Operation timed out'));
    expect(decision.action).toBe('retry');
  });

  it('should classify auth errors', async () => {
    const step = {
      retryPolicy: { maxRetries: 2, backoff: 'exponential', retryOn: ['error'] },
      optional: false,
    } as any;

    const decision = await handler.handleError(step, new Error('401 Unauthorized'));
    expect(decision.action).toBe('abort');
  });

  it('should skip optional steps on error', async () => {
    const step = {
      retryPolicy: { maxRetries: 0, backoff: 'none', retryOn: [] },
      optional: true,
    } as any;

    const decision = await handler.handleError(step, new Error('Unknown error'));
    expect(decision.action).toBe('skip');
  });
});

describe('WorkflowExecutor Safety', () => {
  it('should stop retrying after maxRetries', async () => {
    const registry = new ToolRegistry();
    let attempts = 0;
    registry.register({
      name: 'test_retry_step',
      description: 'always fails',
      inputSchema: { type: 'object' },
      category: 'test',
      tags: ['test'],
      estimatedDuration: '1s',
      riskLevel: 'low',
      requiresApproval: false,
      handler: async () => {
        attempts += 1;
        throw new Error('timeout');
      },
    });
    const executor = new WorkflowExecutor(registry, new ExecutionLogger(), new ErrorHandler());

    const workflow: any = {
      id: 'wf-retry',
      name: 'Retry Workflow',
      description: '',
      customerProfile: {},
      steps: [{
        id: 's1',
        name: 'retry',
        description: '',
        toolName: 'test_retry_step',
        toolArgs: {},
        dependsOn: [],
        optional: false,
        retryPolicy: { maxRetries: 2, backoff: 'none', retryOn: ['timeout'] },
        status: 'pending',
      }],
      reasoning: '',
      estimatedDuration: '1m',
      estimatedCost: '0',
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };

    const result = await executor.executeWorkflow(workflow);

    expect(attempts).toBe(3);
    expect(result.stepsFailed).toBe(1);
    expect(result.status).toBe('failed');
  });

  it('should block sensitive mutation step when workflow is not approved', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'apply_sensitive_config',
      description: 'mutation',
      inputSchema: { type: 'object' },
      category: 'test',
      tags: ['test'],
      estimatedDuration: '1s',
      riskLevel: 'high',
      requiresApproval: true,
      handler: async () => ({ ok: true }),
    });
    const executor = new WorkflowExecutor(registry, new ExecutionLogger(), new ErrorHandler());
    const workflow: any = {
      id: 'wf-unapproved',
      name: 'Unapproved Workflow',
      description: '',
      customerProfile: {},
      steps: [{
        id: 's1',
        name: 'apply',
        description: '',
        toolName: 'apply_sensitive_config',
        toolArgs: {},
        dependsOn: [],
        optional: false,
        retryPolicy: { maxRetries: 0, backoff: 'none', retryOn: [] },
        status: 'pending',
      }],
      reasoning: '',
      estimatedDuration: '1m',
      estimatedCost: '0',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };

    const result = await executor.executeWorkflow(workflow);
    expect(result.stepsFailed).toBe(1);
    expect(result.errors[0]?.error).toContain('Execution blocked');
  });
});

describe('RollbackManager', () => {
  it('should fail execute mode when rollback executor is not configured', async () => {
    const manager = new RollbackManager();
    const plan = {
      id: 'remediation-1',
      incident: {
        id: 'inc-1',
        severity: 'high',
        title: 'test',
        description: 'test',
        affectedDevices: [],
        detectedAt: new Date().toISOString(),
        status: 'detected',
        sourceCheckId: 'check-1',
        alerts: [],
        rootCauseCandidates: [],
        metadata: {},
      },
      steps: [],
      rollback: {
        steps: [{
          id: 'rb-1',
          order: 1,
          title: 'rollback step',
          description: 'rollback',
          playbookId: 'pb-1',
          playbookStepId: 'step-1',
          action: 'restore_policy',
          input: { policy: 'old' },
          expectedChange: 'policy restored',
          dryRunSafe: true,
          requiresApproval: true,
          status: 'pending',
        }],
        automaticTrigger: false,
        triggerCondition: '',
      },
      impact: {
        affectedDevices: [],
        affectedServices: [],
        riskLevel: 'high',
        downtimeEstimate: '5m',
        blastRadius: 'device',
        prerequisites: [],
        warnings: [],
      },
      approvalRequired: true,
      estimatedDuration: '10m',
      createdAt: new Date().toISOString(),
      status: 'draft',
      metadata: {},
    } as any;

    const result = await manager.executeRollback(plan, null, { mode: 'execute' });
    expect(result.success).toBe(false);
    expect(result.mode).toBe('execute');
    expect(result.steps[0]?.success).toBe(false);
  });

  it('should mark dry-run rollback as simulated success', async () => {
    const manager = new RollbackManager();
    const plan = {
      id: 'remediation-2',
      incident: { id: 'inc-2' },
      rollback: {
        steps: [{
          id: 'rb-1',
          order: 1,
          title: 'rollback step',
          action: 'restore_policy',
          input: {},
          expectedChange: 'policy restored',
        }],
        automaticTrigger: false,
        triggerCondition: '',
      },
    } as any;

    const result = await manager.executeRollback(plan, null, { mode: 'dry-run' });
    expect(result.success).toBe(true);
    expect(result.mode).toBe('dry-run');
    expect(result.steps[0]?.output).toContain('[SIMULATED]');
  });
});

describe('OperationOrchestrator', () => {
  it('should run execute then post verification atomically', async () => {
    const orchestrator = new OperationOrchestrator();
    const before = toPostVerifierSnapshot({
      product: 'EPP',
      version: '5.0.0',
      capturedAt: new Date().toISOString(),
      sections: {
        policy: { title: 'policy', items: { firewallEnabled: 'true' } },
      },
    });

    const result = await orchestrator.executeWithVerification({
      executionId: 'exec-atomic-1',
      beforeSnapshot: before,
      collectAfterSnapshot: async () => ({
        ...before,
        capturedAt: new Date().toISOString(),
      }),
      execute: async () => ({ success: true }),
      expectedChanges: [],
    });

    expect(result.executionSuccess).toBe(true);
    expect(result.verification.passed).toBe(true);
    expect(result.evidencePath).toBeTruthy();
  });
});

describe('AutopilotPolicy', () => {
  it('should auto-approve low-risk dry-run plan actions', () => {
    const policy = createDefaultAutopilotPolicy();
    const decision = policy.evaluate({
      id: 'plan-low',
      product: 'EPP',
      version: 'latest',
      action: 'plan_configuration_change',
      riskLevel: 'low',
      description: '조회',
      steps: [],
      dryRun: true,
      metadata: { snapshotIncluded: 'true' },
    });
    expect(decision.autoApprovable).toBe(true);
  });

  it('should deny high-risk delete actions', () => {
    const policy = createDefaultAutopilotPolicy();
    const decision = policy.evaluate({
      id: 'plan-high',
      product: 'EPP',
      version: 'latest',
      action: 'delete_policy',
      riskLevel: 'high',
      description: '정책 삭제',
      steps: [],
      dryRun: false,
      metadata: {},
    });
    expect(decision.autoApprovable).toBe(false);
  });
});

describe('Incident and Remediation', () => {
  it('should create draft remediation plan requiring approval', () => {
    const detector = new IncidentDetector();
    const incidents = detector.detectIncidents({
      checkId: 'check-1',
      product: 'EPP',
      targetUrl: 'https://10.0.0.1',
      checkedAt: new Date().toISOString(),
      items: [],
      alerts: [{
        itemId: 'a1',
        itemName: 'policy',
        severity: 'critical',
        message: 'policy disabled',
        actualValue: false,
        condition: {
          field: 'enabled',
          operator: 'equals',
          value: true,
          severity: 'critical',
        },
      }],
      summary: { total: 1, passed: 0, warnings: 0, critical: 1 },
    });

    expect(incidents.length).toBeGreaterThan(0);

    const planner = new RemediationPlanner();
    const plan = planner.planRemediation(incidents[0], new PlaybookRegistry().listAll());
    expect(plan.status).toBe('draft');
    expect(plan.approvalRequired).toBe(true);
  });
});
