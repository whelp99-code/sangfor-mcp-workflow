/**
 * MCP bootstrap — sangfor-engineer-mcp 연결 및 ToolRegistry wiring
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '@sangfor/workflow-shared';
import { McpStdioClient, type ToolRegistry } from '@sangfor/workflow-engine';

const log = createLogger('mcp-bootstrap');

const MCP_TOOL_ALIASES: Record<string, string> = {
  capture_screenshots: 'sangfor.capture_screenshots',
  search_manuals: 'sangfor.search_manuals',
  import_excel: 'sangfor.import_excel',
  run_health_check: 'sangfor.run_health_check',
  generate_setting_guide_docx: 'sangfor.generate_setting_guide_docx',
  generate_setting_guide_pptx: 'sangfor.generate_setting_guide_pptx',
};

function resolveMcpCwd(): string {
  return (
    process.env.SANGFOR_MCP_CWD
    ?? join(homedir(), 'Documents/Playground/whelp99-code-sangfor-engineer-mcp')
  );
}

function resolveTsxCli(mcpCwd: string): string {
  const pnpmTsx = join(
    mcpCwd,
    'node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs',
  );
  if (existsSync(pnpmTsx)) return pnpmTsx;

  const localTsx = join(mcpCwd, 'node_modules/tsx/dist/cli.mjs');
  if (existsSync(localTsx)) return localTsx;

  return 'tsx';
}

export async function bootstrapMcpClient(
  toolRegistry: ToolRegistry,
  workflowCwd: string,
): Promise<McpStdioClient | null> {
  const mcpCwd = resolveMcpCwd();
  if (!existsSync(join(mcpCwd, 'apps/mcp-server/src/index.ts'))) {
    log.warn(`Engineer MCP not found at ${mcpCwd} — using stub tools`);
    return null;
  }

  const tsxCli = resolveTsxCli(mcpCwd);
  const tsxArgs = tsxCli.endsWith('.mjs')
    ? [tsxCli, 'apps/mcp-server/src/index.ts']
    : ['apps/mcp-server/src/index.ts'];

  const client = new McpStdioClient('apps/mcp-server/src/index.ts', {
    cwd: mcpCwd,
    command: tsxCli.endsWith('.mjs') ? 'node' : 'npx',
    args: tsxArgs,
    env: {
      SANGFOR_DB_ENABLED: '0',
      SANGFOR_OCR_DIR: join(workflowCwd, 'outputs', 'captcha-ocr'),
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}`,
    },
    requestTimeoutMs: 600_000,
  });

  try {
    await client.start();
    toolRegistry.setMcpClient(client);
    await toolRegistry.registerFromMcpServer();
    wireWorkflowToolAliases(toolRegistry, client);
    log.info('MCP tools registered successfully');
    return client;
  } catch (error) {
    log.warn(`MCP bootstrap failed — using stub tools: ${error}`);
    client.stop();
    return null;
  }
}

function wireWorkflowToolAliases(toolRegistry: ToolRegistry, client: McpStdioClient): void {
  for (const [localName, mcpName] of Object.entries(MCP_TOOL_ALIASES)) {
    const existing = toolRegistry.getTool(localName) ?? toolRegistry.getTool(mcpName);
    if (!existing) continue;

    toolRegistry.register({
      ...existing,
      name: localName,
      handler: async (args: Record<string, unknown>) => client.callTool(mcpName, args),
    });
  }
}

export function getProductEnv(product: 'EPP' | 'IAG' | 'CC'): {
  targetUrl: string;
  username: string;
  password: string;
  outputDir: string;
} {
  const urls: Record<string, string> = {
    EPP: process.env.EPP_TARGET_URL ?? 'https://10.80.1.106',
    IAG: process.env.IAG_TARGET_URL ?? 'https://10.80.1.108',
    CC: process.env.CC_TARGET_URL ?? 'https://10.80.1.107',
  };

  return {
    targetUrl: urls[product],
    username: process.env[`${product}_USERNAME`] ?? 'admin',
    password: process.env[`${product}_PASSWORD`] ?? '',
    outputDir: join(process.cwd(), 'outputs', 'mcp-device-learn', product, 'screenshots'),
  };
}

export function toDeviceProduct(code: string): 'EPP' | 'IAG' | 'CC' {
  switch (code) {
    case 'ENDPOINT_SECURE':
    case 'EPP':
      return 'EPP';
    case 'CYBER_COMMAND':
    case 'CC':
      return 'CC';
    case 'IAG':
    default:
      return 'IAG';
  }
}

export function toGuideProduct(code: string): 'EPP' | 'IAG' | 'CC' {
  return toDeviceProduct(code);
}
