#!/usr/bin/env node
/**
 * 실장비 학습 — sangfor-engineer-mcp 프로세스 실행
 *
 * sangfor.capture_screenshots (메뉴 클릭 + 스크린샷) → discover → health-check
 *
 * 사용법:
 *   node scripts/run-mcp-device-learn.mjs
 *   node scripts/run-mcp-device-learn.mjs --product IAG
 *   node scripts/run-mcp-device-learn.mjs --product EPP --product CC
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';

loadEnv();

const MCP_CWD = join(process.env.HOME || '/Users/jmpark', 'Documents/Playground/whelp99-code-sangfor-engineer-mcp');
const MCP_SCRIPT = 'node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs';
const WORKFLOW_CWD = process.cwd();
const OUTPUT_DIR = join(WORKFLOW_CWD, 'outputs', 'mcp-device-learn');
mkdirSync(OUTPUT_DIR, { recursive: true });

const PRODUCTS = {
  CC: {
    targetUrl: process.env.CC_TARGET_URL || 'https://10.80.1.107',
    username: process.env.CC_USERNAME || 'admin',
    password: process.env.CC_PASSWORD || '',
    outputDir: join(OUTPUT_DIR, 'CC', 'screenshots'),
  },
  EPP: {
    targetUrl: process.env.EPP_TARGET_URL || 'https://10.80.1.106',
    username: process.env.EPP_USERNAME || 'admin',
    password: process.env.EPP_PASSWORD || '',
    outputDir: join(OUTPUT_DIR, 'EPP', 'screenshots'),
  },
  IAG: {
    targetUrl: process.env.IAG_TARGET_URL || 'https://10.80.1.108',
    username: process.env.IAG_USERNAME || 'admin',
    password: process.env.IAG_PASSWORD || '',
    outputDir: join(OUTPUT_DIR, 'IAG', 'screenshots'),
  },
};

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function save(name, data) {
  const path = join(OUTPUT_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  log(`  💾 ${name}.json`);
}

function parseProducts() {
  const args = process.argv.slice(2);
  const selected = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--product' && args[i + 1]) {
      const p = args[++i].toUpperCase();
      if (PRODUCTS[p]) selected.push(p);
    }
  }
  return selected.length ? selected : ['CC', 'EPP', 'IAG'];
}

class McpClient {
  constructor(timeoutMs = 600_000) {
    this.timeoutMs = timeoutMs;
    this.proc = spawn('node', [MCP_SCRIPT, 'apps/mcp-server/src/index.ts'], {
      cwd: MCP_CWD,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}`,
        SANGFOR_OCR_DIR: join(WORKFLOW_CWD, 'outputs', 'captcha-ocr'),
        SANGFOR_DB_ENABLED: '0',
        EPP_PASSWORD: process.env.EPP_PASSWORD,
        IAG_PASSWORD: process.env.IAG_PASSWORD,
        CC_PASSWORD: process.env.CC_PASSWORD,
        LM_STUDIO_VISION_MODEL: process.env.LM_STUDIO_VISION_MODEL ?? 'qwen/qwen3.5-9b',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.id = 0;
    this.pending = new Map();
    this.buf = '';

    this.proc.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s) log(`  [mcp:stderr] ${s.slice(0, 300)}`);
    });
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      const lines = this.buf.split('\n');
      this.buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) p.err(new Error(msg.error.message));
            else p.ok(msg.result);
          }
        } catch { /* partial line */ }
      }
    });
  }

  call(method, params) {
    const id = ++this.id;
    return new Promise((ok, err) => {
      this.pending.set(id, { ok, err });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          err(new Error(`timeout (${this.timeoutMs}ms): ${method}`));
        }
      }, this.timeoutMs);
    });
  }

  async tool(name, args) {
    const raw = await this.call('tools/call', { name, arguments: args });
    if (raw?.structuredContent) return raw.structuredContent;
    try {
      return JSON.parse(raw.content[0].text);
    } catch {
      return raw;
    }
  }

  close() {
    this.proc.kill();
  }
}

async function runCapture(mcp, product) {
  const cfg = PRODUCTS[product];
  if (!cfg.password) {
    throw new Error(`${product}_PASSWORD가 .env에 없습니다.`);
  }
  mkdirSync(cfg.outputDir, { recursive: true });

  log(`\n[${product}] sangfor.capture_screenshots`);
  log(`  target: ${cfg.targetUrl}`);
  log(`  output: ${cfg.outputDir}`);

  const result = await mcp.tool('sangfor.capture_screenshots', {
    product,
    targetUrl: cfg.targetUrl,
    username: cfg.username,
    password: cfg.password,
    outputDir: cfg.outputDir,
    headless: false,
  });

  save(`${product}_capture`, result);
  log(`  captured: ${result.totalScreenshots ?? result.captured?.length ?? 0}`);
  if (result.failed?.length) {
    result.failed.forEach((f) => log(`  ✗ ${f.menu}: ${f.error}`));
  }
  return result;
}

async function runDiscover(mcp, product) {
  const cfg = PRODUCTS[product];
  log(`\n[${product}] sangfor.discover_product_console`);
  const result = await mcp.tool('sangfor.discover_product_console', {
    product,
    targetUrl: cfg.targetUrl,
    environment: 'lab',
  });
  save(`${product}_discover`, result);
  log(`  strategy: ${result.strategy} | routes: ${(result.menuRoutes || []).length}`);
  return result;
}

async function main() {
  const products = parseProducts();
  log('='.repeat(60));
  log(`실장비 학습 MCP 파이프라인 — ${products.join(', ')}`);
  log('='.repeat(60));

  const mcp = new McpClient();
  const summary = { products: {}, finishedAt: null };

  try {
    log('\n[Step 0] MCP 서버 연결...');
    await mcp.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'sangfor-mcp-workflow', version: '0.1.0' },
    });
    const { tools } = await mcp.call('tools/list');
    log(`  ✅ 연결됨 — ${tools.length}개 tools`);

    for (const product of products) {
      const capture = await runCapture(mcp, product);
      const discover = await runDiscover(mcp, product);
      summary.products[product] = {
        capture: {
          total: capture.totalScreenshots ?? capture.captured?.length ?? 0,
          failed: capture.failed?.length ?? 0,
          outputDir: capture.outputDir,
        },
        discover: {
          strategy: discover.strategy,
          menuRoutes: (discover.menuRoutes || []).length,
        },
      };
    }

    summary.finishedAt = new Date().toISOString();
    save('00_summary', summary);

    log('\n' + '='.repeat(60));
    log('✅ MCP 실장비 학습 완료');
    for (const [p, s] of Object.entries(summary.products)) {
      log(`  ${p}: ${s.capture.total} screenshots, ${s.capture.failed} failed`);
    }
    log('='.repeat(60));
  } catch (err) {
    log(`\n❌ ${String(err)}`);
    console.error(err);
    process.exit(1);
  } finally {
    mcp.close();
  }
}

main();
