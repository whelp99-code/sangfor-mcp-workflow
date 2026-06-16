#!/usr/bin/env node
/**
 * HCI 백업 정책 설정 — Phase 2: 실장비 연결 + 상태 수집 + 백업 정책 적용
 *
 * MCP 파이프라인:
 * 1. start_operator_session → 세션 생성
 * 2. read_live_console_state → 현재 백업 페이지 상태 수집
 * 3. execute_console_action_live → "New Policy" 클릭 + 정책 설정
 * 4. verify_product_change → 검증
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
      if (s && !s.includes('started')) log(`  [mcp] ${s.slice(0, 200)}`);
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); err(new Error(`timeout: ${method}`)); } }, 60_000);
    });
  }
  async tool(name, args) {
    const raw = await this.call('tools/call', { name, arguments: args });
    if (raw.structuredContent) return raw.structuredContent;
    try { return JSON.parse(raw.content[0].text); } catch { return raw; }
  }
  close() { this.proc.kill(); }
}

async function main() {
  log('='.repeat(60));
  log('HCI 백업 정책 — Phase 2: 실장비 연결 + 적용');
  log('='.repeat(60));

  const mcp = new McpClient();

  try {
    await mcp.call('initialize');
    log('  ✅ MCP 연결됨');

    // ── Step 1: Operator 세션 생성 ──
    log('\n[Step 1] start_operator_session...');
    const session = await mcp.tool('sangfor.start_operator_session', {
      product: 'HCI_SCP',
      mode: 'poc',
      targetUrl: 'https://211.53.60.26',
      credentials: { username: 'admin', password: 'aztech123!@#' },
    });
    save('10_session', session);
    log(`  Session ID: ${session.id}`);
    log(`  Mode: ${session.mode}`);

    // ── Step 2: 현재 백업 페이지 상태 수집 ──
    log('\n[Step 2] read_live_console_state...');
    const state = await mcp.tool('sangfor.read_live_console_state', {
      sessionId: session.id,
    });
    save('11_console_state', state);
    log(`  URL: ${state.url}`);
    log(`  Title: ${state.title}`);
    log(`  Browser: ${state.browser}`);
    if (state.snapshot) {
      log(`  Snapshot (첫 500자):\n${String(state.snapshot).slice(0, 500)}`);
    }
    if (state.screenshotPath) {
      log(`  Screenshot: ${state.screenshotPath}`);
    }

    // ── Step 3: 백업 페이지 네비게이션 ──
    log('\n[Step 3] navigate to backup page...');
    const navResult = await mcp.tool('sangfor.execute_console_action_live', {
      sessionId: session.id,
      action: {
        type: 'navigate',
        target: 'Reliability > Scheduled Backup/CDP',
        dryRun: true,
      },
      menuPath: [
        { label: 'Reliability' },
        { label: 'Scheduled Backup/CDP' },
      ],
    });
    save('12_navigate', navResult);
    log(`  Navigate: ${JSON.stringify(navResult).slice(0, 300)}`);

    // ── Step 4: 백업 페이지 상태 재수집 ──
    log('\n[Step 4] backup page state...');
    const backupState = await mcp.tool('sangfor.read_live_console_state', {
      sessionId: session.id,
    });
    save('13_backup_state', backupState);
    log(`  URL: ${backupState.url}`);
    if (backupState.snapshot) {
      log(`  Snapshot:\n${String(backupState.snapshot).slice(0, 1000)}`);
    }

    // ── Step 5: "New Policy" 클릭 (dry-run) ──
    log('\n[Step 5] New Policy 클릭 (dry-run)...');
    const newPolicyResult = await mcp.tool('sangfor.execute_console_action_live', {
      sessionId: session.id,
      action: {
        type: 'click',
        target: 'New Policy',
        dryRun: true,
      },
    });
    save('14_new_policy_dryrun', newPolicyResult);
    log(`  New Policy (dry-run): ${JSON.stringify(newPolicyResult).slice(0, 300)}`);

    // ── Step 6: 백업 정책 변경 계획 적용 (승인 필요) ──
    log('\n[Step 6] generate_product_change_plan (백업)...');
    const plan = await mcp.tool('sangfor.generate_product_change_plan', {
      product: 'HCI_SCP',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
      requirements: [
        '기본 백업 정책 설정: 매일 증분 백업, 스케줄 매일 오전 2시, 보존 7일',
        '백업 저장소 자동 선택',
        'Enable Backup 활성화 확인',
      ],
    });
    save('15_change_plan', plan);
    log(`  Plan: ${plan.summary}`);
    log(`  Tasks: ${plan.tasks?.length}개`);
    for (const t of plan.tasks || []) {
      log(`    [${t.riskLevel}] ${t.requirement} → ${t.menuPath?.join(' > ')}`);
    }

    // ── Step 7: apply (실제 실행 — 승인 필요) ──
    log('\n[Step 7] apply_approved_product_change...');
    const applyResult = await mcp.tool('sangfor.apply_approved_product_change', {
      plan,
      environment: 'poc',
      sessionId: session.id,
      approval: {
        approvedBy: 'jmpark',
        approvalToken: 'manual-approval-token',
        changeTicketId: 'HCI-BACKUP-001',
        rollbackPlanId: 'rollback-hci-backup-001',
      },
    });
    save('16_apply_result', applyResult);
    log(`  Apply: ${JSON.stringify(applyResult).slice(0, 500)}`);

    // ── Step 8: verify ──
    log('\n[Step 8] verify_product_change...');
    const verifyResult = await mcp.tool('sangfor.verify_product_change', {
      plan,
    });
    save('17_verify', verifyResult);
    log(`  Verify: ${JSON.stringify(verifyResult).slice(0, 500)}`);

    // ── 최종 요약 ──
    save('00_phase2_summary', {
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      steps: {
        session: { id: session.id, mode: session.mode },
        consoleState: { url: state.url, captured: !!state.snapshot },
        backupPage: { url: backupState.url, captured: !!backupState.snapshot },
        changePlan: { summary: plan.summary, tasks: plan.tasks?.length },
        apply: applyResult,
        verify: verifyResult,
      },
    });

    log('\n' + '='.repeat(60));
    log('✅ Phase 2 완료');
    log('='.repeat(60));

  } catch (err) {
    log(`\n❌ ${String(err)}`);
    console.error(err);
  } finally {
    mcp.close();
  }
}

main();
