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
