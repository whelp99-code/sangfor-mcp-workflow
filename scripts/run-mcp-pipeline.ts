#!/usr/bin/env tsx
/**
 * HCI 백업 정책 설정 — MCP 파이프라인 실행
 *
 * sangfor-engineer-mcp의 파이프라인을 순서대로 호출:
 * 1. discover_product_console → 장비 학습
 * 2. collect_product_config   → 현재 설정 수집
 * 3. analyze_customer_requirements → 요구사항 분석
 * 4. generate_product_change_plan  → 변경 계획
 * 5. dry_run_product_change   → 드라이런
 * 6. apply (승인 후)          → 실제 적용
 * 7. verify_product_change    → 검증
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const MCP_SERVER_PATH = join(
  process.env.HOME || '/Users/jmpark',
  'Documents/Playground/whelp99-code-sangfor-engineer-mcp/apps/mcp-server/src/index.ts'
);

const OUTPUT_DIR = join(process.cwd(), 'outputs', 'hci-backup-pipeline');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── MCP JSON-RPC 클라이언트 ────────────────────────────────────────────────

class McpClient {
  private proc: ChildProcess;
  private requestId = 0;
  private pending = new Map<number, { resolve: Function; reject: Function }>();
  private buffer = '';

  constructor(serverPath: string) {
    this.proc = spawn('node', ['node_modules/.bin/tsx', serverPath], {
      cwd: join(process.env.HOME!, 'Documents/Playground/whelp99-code-sangfor-engineer-mcp'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.proc.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line);
            if (msg.id !== undefined && this.pending.has(msg.id)) {
              const { resolve, reject } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.error) reject(new Error(msg.error.message));
              else resolve(msg.result);
            }
          } catch {}
        }
      }
    });

    this.proc.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[MCP stderr] ${msg}`);
    });
  }

  async call(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const req = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });
      this.proc.stdin?.write(req + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.call('tools/call', { name, arguments: args });
  }

  close() {
    this.proc.kill();
  }
}

// ─── 로그 ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function saveJson(name: string, data: any) {
  const path = join(OUTPUT_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  log(`  💾 ${name}.json`);
  return path;
}

// ─── 메인 파이프라인 ────────────────────────────────────────────────────────

async function main() {
  log('='.repeat(60));
  log('HCI 백업 정책 설정 — MCP 파이프라인');
  log('='.repeat(60));

  const client = new McpClient(MCP_SERVER_PATH);

  // 초기화 대기
  await new Promise(r => setTimeout(r, 3000));

  try {
    // ── Step 0: MCP 서버 상태 확인 ──
    log('\n[Step 0] MCP 서버 연결 확인...');
    const tools = await client.call('tools/list');
    log(`  ✅ MCP 서버 연결됨 — ${tools.tools?.length ?? 0}개 tools`);
    for (const t of (tools.tools ?? []).slice(0, 15)) {
      log(`    - ${t.name}`);
    }

    // ── Step 1: discover_product_console ──
    log('\n[Step 1] sangfor.discover_product_console (HCI)...');
    const discovery = await client.callTool('sangfor.discover_product_console', {
      product: 'HCI',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
    });
    saveJson('01_discovery', discovery);
    log(`  Product: ${discovery.product}`);
    log(`  Strategy: ${discovery.strategy}`);
    log(`  API Likely: ${discovery.apiLikely}`);
    log(`  Auth: ${discovery.authMethods?.join(', ')}`);
    log(`  Menu Routes: ${discovery.menuRoutes?.length}개`);
    for (const route of discovery.menuRoutes ?? []) {
      log(`    - ${route}`);
    }
    log(`  Capabilities: ${discovery.capabilities?.length}개`);
    for (const cap of discovery.capabilities ?? []) {
      log(`    - ${cap.id}: ${cap.title}`);
    }
    log(`  Next Step: ${discovery.nextStep}`);

    // ── Step 2: collect_product_config ──
    log('\n[Step 2] sangfor.collect_product_config...');
    const currentConfig = await client.callTool('sangfor.collect_product_config', {
      product: 'HCI',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
    });
    saveJson('02_current_config', currentConfig);
    log(`  Sections: ${currentConfig.sections?.length}개`);
    for (const sec of currentConfig.sections ?? []) {
      log(`    - ${sec.id}: ${sec.status} (${sec.evidence?.join(', ')})`);
    }
    log(`  Safety: readOnly=${currentConfig.safety?.readOnly}, mutationBlocked=${currentConfig.safety?.mutationBlocked}`);

    // ── Step 3: analyze_customer_requirements ──
    log('\n[Step 3] sangfor.analyze_customer_requirements...');
    const analysis = await client.callTool('sangfor.analyze_customer_requirements', {
      product: 'HCI',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
      requirements: [
        '기본 백업 정책 설정 (매일 증분 백업, 7일 보존)',
        '백업 스케줄: 매일 오전 2시',
        '백업 저장소 자동 선택',
        'VM 자동 연결 활성화',
      ],
      currentConfig,
    });
    saveJson('03_analysis', analysis);
    log(`  Tasks: ${analysis.tasks?.length}개`);
    for (const task of analysis.tasks ?? []) {
      log(`    - [${task.riskLevel}] ${task.requirement}`);
      log(`      Menu: ${task.menuPath?.join(' > ')}`);
      log(`      Capability: ${task.capabilityId}`);
      log(`      Approval: ${task.approvalRequired}`);
    }
    log(`  Notes:`);
    for (const note of analysis.notes ?? []) {
      log(`    - ${note}`);
    }

    // ── Step 4: generate_product_change_plan ──
    log('\n[Step 4] sangfor.generate_product_change_plan...');
    const plan = await client.callTool('sangfor.generate_product_change_plan', {
      product: 'HCI',
      targetUrl: 'https://211.53.60.26',
      environment: 'poc',
      requirements: [
        '기본 백업 정책 설정 (매일 증분 백업, 7일 보존)',
        '백업 스케줄: 매일 오전 2시',
        '백업 저장소 자동 선택',
        'VM 자동 연결 활성화',
      ],
      currentConfig,
    });
    saveJson('04_change_plan', plan);
    log(`  Summary: ${plan.summary}`);
    log(`  Tasks: ${plan.tasks?.length}개`);
    for (const task of plan.tasks ?? []) {
      log(`    - [${task.riskLevel}] ${task.requirement}`);
      log(`      Menu: ${task.menuPath?.join(' > ')}`);
      log(`      API: ${task.apiEndpointCandidates?.join(', ')}`);
      log(`      Dry Run: ${task.dryRunActions?.join(', ')}`);
    }
    log(`  Rollback Plan:`);
    for (const r of plan.rollbackPlan ?? []) {
      log(`    - ${r}`);
    }
    log(`  Validation Plan:`);
    for (const v of plan.validationPlan ?? []) {
      log(`    - ${v}`);
    }
    log(`  Execution Gates:`);
    for (const g of plan.executionGates ?? []) {
      log(`    - ${g}`);
    }

    // ── Step 5: dry_run_product_change ──
    log('\n[Step 5] sangfor.dry_run_product_change...');
    const dryRun = await client.callTool('sangfor.dry_run_product_change', {
      plan,
      targetUrl: 'https://211.53.60.26',
    });
    saveJson('05_dry_run', dryRun);
    log(`  Dry Run Result:`);
    log(JSON.stringify(dryRun, null, 2).slice(0, 1000));

    log('\n' + '='.repeat(60));
    log('✅ 파이프라인 1~5단계 완료');
    log('='.repeat(60));
    log('\n📋 다음 단계:');
    log('  6. 사용자 승인 후 sangfor.apply_approved_product_change 실행');
    log('  7. sangfor.verify_product_change로 검증');

    // 결과 요약 저장
    const summary = {
      timestamp: new Date().toISOString(),
      target: 'https://211.53.60.26',
      product: 'HCI',
      pipeline: {
        discovery: { product: discovery.product, strategy: discovery.strategy, capabilities: discovery.capabilities?.length },
        currentConfig: { sections: currentConfig.sections?.length, safety: currentConfig.safety },
        analysis: { tasks: analysis.tasks?.length, notes: analysis.notes?.length },
        plan: { summary: plan.summary, tasks: plan.tasks?.length, rollbackSteps: plan.rollbackPlan?.length },
        dryRun: { completed: true },
      },
      nextStep: 'User approval → apply → verify',
    };
    saveJson('00_pipeline_summary', summary);

  } catch (err) {
    log(`\n❌ 오류: ${String(err)}`);
    console.error(err);
  } finally {
    client.close();
  }
}

main().catch(console.error);
