import { describe, it, expect } from 'vitest';
import {
  parseMcpMenuRoutes,
  computeMenuAccuracy,
  DeviceMenuCapture,
} from '@sangfor/workflow-engine';

describe('Device menu capture helpers', () => {
  it('parses MCP menuRoutes string array', () => {
    const menus = parseMcpMenuRoutes([
      'Dashboard (Home)',
      'Defense > Malware Scan',
      'Policies > App Control',
      'System > Data Sync > Syslog Reporting',
    ]);

    expect(menus).toHaveLength(4);
    expect(menus[0].name).toBe('Dashboard (Home)');
    expect(menus[1].name).toBe('Malware Scan');
    expect(menus[1].path).toEqual(['Defense', 'Malware Scan']);
    expect(menus[3].name).toBe('Syslog Reporting');
  });

  it('computes accuracy with fuzzy path matching', () => {
    const capture = new DeviceMenuCapture();
    const manualMenus = capture.getReferenceManualMenus('EPP');
    const deviceMenus = parseMcpMenuRoutes([
      'Dashboard (Home)',
      'Defense > Malware Scan',
      'Policies > App Control',
      'Policies > General Policies > Endpoint Control > USB Device Control',
      'System > Agent Deployment',
    ]);

    const { accuracy, matchedItems } = computeMenuAccuracy(manualMenus, deviceMenus);

    expect(accuracy).toBeGreaterThan(0);
    expect(matchedItems).toContain('Malware Scan');
    expect(matchedItems).toContain('App Control');
  });
});

describe('TemplateManager', () => {
  it('creates workflow from tpl_epp_only template id', async () => {
    const { TemplateManager } = await import('@sangfor/workflow-engine');
    const manager = new TemplateManager();

    const workflow = manager.createWorkflowFromTemplate('tpl_epp_only', {
      customerName: 'Test Customer',
      products: ['ENDPOINT_SECURE'],
      requirements: [],
      environment: 'customer',
      riskLevel: 'medium',
      similarCases: [],
      metadata: {},
    });

    expect(workflow).not.toBeNull();
    expect(workflow!.steps.length).toBe(7);
    expect(workflow!.steps.map((s) => s.toolName)).toContain('import_excel');
  });

  it('returns null for legacy short template ids', async () => {
    const { TemplateManager } = await import('@sangfor/workflow-engine');
    const manager = new TemplateManager();
    const workflow = manager.createWorkflowFromTemplate('epp', {
      customerName: 'Test',
      products: ['ENDPOINT_SECURE'],
      requirements: [],
      environment: 'customer',
      riskLevel: 'medium',
      similarCases: [],
      metadata: {},
    });
    expect(workflow).toBeNull();
  });
});

describe('ToolRegistry workflow surface', () => {
  it('listWorkflowTools returns only whitelisted tools even with extra MCP tools', async () => {
    const { ToolRegistry, createDefaultToolDefinitions, WORKFLOW_TOOL_NAMES } = await import(
      '@sangfor/workflow-engine'
    );
    const registry = new ToolRegistry();
    registry.registerAll(createDefaultToolDefinitions());
    registry.register({
      name: 'sangfor.click_epp_menu',
      description: 'low level click',
      inputSchema: { type: 'object', properties: {} },
      category: 'other',
      tags: ['epp'],
      estimatedDuration: '1s',
      riskLevel: 'high',
      requiresApproval: true,
      handler: async () => ({}),
    });

    const workflowTools = registry.listWorkflowTools();
    expect(workflowTools.length).toBe(WORKFLOW_TOOL_NAMES.length);
    expect(workflowTools.every((t) => WORKFLOW_TOOL_NAMES.includes(t.name as typeof WORKFLOW_TOOL_NAMES[number]))).toBe(true);
    expect(workflowTools.some((t) => t.name.startsWith('sangfor.'))).toBe(false);
  });
});

describe('AIWorkflowGenerator rule-based steps', () => {
  it('generates at most 10 steps with expanded registry', async () => {
    const {
      AIWorkflowGenerator,
      ToolRegistry,
      createDefaultToolDefinitions,
    } = await import('@sangfor/workflow-engine');

    const registry = new ToolRegistry();
    registry.registerAll(createDefaultToolDefinitions());
    for (let i = 0; i < 40; i++) {
      registry.register({
        name: `sangfor.extra_tool_${i}`,
        description: `extra ${i}`,
        inputSchema: { type: 'object', properties: {} },
        category: 'other',
        tags: ['epp', 'iag'],
        estimatedDuration: '1s',
        riskLevel: 'medium',
        requiresApproval: true,
        handler: async () => ({}),
      });
    }

    const generator = new AIWorkflowGenerator(registry);
    generator.setUseAI(false);

    const profile = await generator.analyzeInput({
      customerName: 'Step Limit Test',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['USB policy'],
      products: ['ENDPOINT_SECURE'],
    });
    const workflow = await generator.generateWorkflow(profile);

    expect(workflow.steps.length).toBeLessThanOrEqual(10);
    expect(workflow.steps.every((s) => !s.toolName.startsWith('sangfor.'))).toBe(true);
  });
});
