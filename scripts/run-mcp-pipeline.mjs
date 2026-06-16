#!/usr/bin/env node
/**
 * HCI 백업 정책 설정 — MCP 파이프라인
 *
 * sangfor-engineer-mcp에 직접 연결하여 파이프라인 실행:
 * 1. discover → 2. collect → 3. analyze → 4. plan → 5. dry_run
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const MCP_CWD = join(process.env.HOME || '/Users/jmpark', 'Documents/Playground/whelp99-code-sangfor-engineer-mcp');
const MCP_SCRIPT = 'node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs';
const OUTPUT_DIR = join(process.cwd(), 'outputs', 'hci-backup-pipeline');
mkdirSync(OUTPUT_DIR, { recursive: true });

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function save(name, data) {
  writeFileSync(join(OUTPUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  log(`  💾 ${name}.json`);
}

// ─── MCP 클라이언트 ─────────────────────────────────────────────────────────

class McpClient {
  constructor() {
    this.proc = spawn('node', [MCP_SCRIPT, 'apps/mcp-server/src/index.ts'], {
      cwd: MCP_CWD,
      env: { ...process.env, SANGFOR_DB_ENABLED: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.id = 0;
    this.pending = new Map();
    this.buf = '';

    this.proc.stderr.on('data', (d) => {
      const s = d.toString().trim();
      if (s && !s.includes('started')) log(`  [mcp:stderr] ${s.slice(0, 200)}`);
    });
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      for (const line of this.buf.split('\n')) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) p.err(new Error(msg.error.message));
            else p.ok(msg.result);
          }
        } catch {}
      }
      this.buf = this.buf.split('\n').pop() || '';
    });
  }

  call(method, params) {
    const id = ++this.id;
    return new Promise((ok, err) => {
      this.pending.set(id, { ok, err });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); err(new Error(`timeout: ${method}`)); }
      }, 30_000);
    });
  }

  async tool(name, args) {
    const raw = await this.call('tools/call', { name, arguments: args });
    if (raw.structuredContent) return raw.structuredContent;
    try { return JSON.parse(raw.content[0].text); } catch { return raw; }
  }

  close() { this.proc.kill(); }
}

// ─── 메인 파이프라인 ────────────────────────────────────────────────────────

async function main() {
  log('='.repeat(60));
  log('HCI 백업 정책 설정 — MCP 파이프라인');
  log('='.repeat(60));

  const mcp = new McpClient();

  try {
    // 0. 연결 확인
    log('\n[Step 0] MCP 서버 연결...');
    await mcp.call('initialize');
    const { tools } = await mcp.call('tools/list');
    log(`  ✅ 연결됨 — ${tools.length}개 tools`);
    tools.forEach((t) => log(`    • ${t.name}`));

    // 1. discover
    log('\n[Step 1] discover_product_console (HCI)...');
    const disc = await mcp.tool('sangfor.discover_product_console', {
      product: 'HCI', targetUrl: 'https://211.53.60.26', environment: 'poc',
    });
    save('01_discover', disc);
    log(`  Strategy: ${disc.strategy} | API: ${disc.apiLikely}`);
    log(`  Auth: ${(disc.authMethods || []).join(', ')}`);
    log(`  Menu Routes: ${(disc.menuRoutes || []).length}개`);
    (disc.menuRoutes || []).forEach((r) => log(`    → ${r}`));
    log(`  Capabilities: ${(disc.capabilities || []).length}개`);
    (disc.capabilities || []).forEach((c) => log(`    → [${c.riskLevel}] ${c.id}: ${c.title}`));

    // 2. collect
    log('\n[Step 2] collect_product_config...');
    const cfg = await mcp.tool('sangfor.collect_product_config', {
      product: 'HCI', targetUrl: 'https://211.53.60.26', environment: 'poc',
    });
    save('02_collect', cfg);
    (cfg.sections || []).forEach((s) => log(`    ${s.id}: ${s.status}`));

    // 3. analyze
    log('\n[Step 3] analyze_customer_requirements...');
    const analysis = await mcp.tool('sangfor.analyze_customer_requirements', {
      product: 'HCI',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
      requirements: [
        '기본 백업 정책 설정 (매일 증분 백업, 7일 보존)',
        '백업 스케줄: 매일 오전 2시',
        '백업 저장소 자동 선택',
      ],
      currentConfig: cfg,
    });
    save('03_analysis', analysis);
    (analysis.tasks || []).forEach((t) => {
      log(`    [${t.riskLevel}] ${t.requirement}`);
      log(`      menu: ${(t.menuPath || []).join(' > ')} | approval: ${t.approvalRequired}`);
    });
    (analysis.notes || []).forEach((n) => log(`    📝 ${n}`));

    // 4. plan
    log('\n[Step 4] generate_product_change_plan...');
    const plan = await mcp.tool('sangfor.generate_product_change_plan', {
      product: 'HCI',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
      requirements: [
        '기본 백업 정책 설정 (매일 증분 백업, 7일 보존)',
        '백업 스케줄: 매일 오전 2시',
        '백업 저장소 자동 선택',
      ],
      currentConfig: cfg,
    });
    save('04_plan', plan);
    log(`  Summary: ${plan.summary}`);
    log(`  Rollback:`);
    (plan.rollbackPlan || []).forEach((r) => log(`    ← ${r}`));
    log(`  Validation:`);
    (plan.validationPlan || []).forEach((v) => log(`    ✓ ${v}`));
    log(`  Gates:`);
    (plan.executionGates || []).forEach((g) => log(`    ⚠ ${g}`));

    // 5. dry_run
    log('\n[Step 5] dry_run_product_change...');
    const dry = await mcp.tool('sangfor.dry_run_product_change', {
      plan,
      targetUrl: 'https://211.53.60.26',
    });
    save('05_dry_run', dry);
    log(`  Result: ${JSON.stringify(dry).slice(0, 500)}`);

    // 요약
    save('00_pipeline_summary', {
      timestamp: new Date().toISOString(),
      target: 'https://211.53.60.26',
      steps: {
        discover: { strategy: disc.strategy, capabilities: (disc.capabilities || []).length },
        collect: { sections: (cfg.sections || []).length },
        analyze: { tasks: (analysis.tasks || []).length },
        plan: { summary: plan.summary },
        dryRun: { completed: true },
      },
    });

    log('\n' + '='.repeat(60));
    log('✅ 파이프라인 1~5 완료');
    log('='.repeat(60));

  } catch (err) {
    log(`\n❌ ${String(err)}`);
    console.error(err);
  } finally {
    mcp.close();
  }
}

main();
