#!/usr/bin/env tsx
/**
 * Auto-ops 실장비 연동 E2E (read-only + Operator API 플로우)
 *
 * 1) EPP 콘솔 접속/로그인 시도 (CAPTCHA/EULA 처리)
 * 2) DOM 기반 read-only snapshot 수집
 * 3) Operator API: snapshot → plan → approve → execute (dry-run)
 *
 * 사용법:
 *   SANGFOR_API_KEY=dev-e2e pnpm run e2e:auto-ops -- --product EPP
 */

import 'dotenv/config';

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginSangforConsole } from './lib/sangfor-console-login.js';
import { openSangforBrowser } from './lib/sangfor-browser.js';

type Product = 'EPP' | 'IAG' | 'CC';

const DEFAULT_URLS: Record<Product, string> = {
  EPP: 'https://10.80.1.106',
  IAG: 'https://10.80.1.108',
  CC: 'https://10.80.1.107',
};

const API_KEY = process.env.SANGFOR_API_KEY ?? 'dev-e2e-key';
const PORT = Number(process.env.PORT ?? '3500');
const BASE = `http://127.0.0.1:${PORT}`;

function readProduct(): Product {
  const args = process.argv.slice(2);
  const index = args.indexOf('--product');
  const product = (index === -1 ? 'EPP' : args[index + 1]).toUpperCase() as Product;
  if (!['EPP', 'IAG', 'CC'].includes(product)) {
    throw new Error('--product must be EPP, IAG, or CC');
  }
  return product;
}

function readCredentials(product: Product) {
  const username = process.env[`${product}_USERNAME`] ?? '';
  const password = process.env[`${product}_PASSWORD`] ?? '';
  if (!username || !password) {
    throw new Error(`Set ${product}_USERNAME and ${product}_PASSWORD in .env`);
  }
  return { username, password };
}

async function collectDomSnapshot(page: import('playwright').Page, product: Product, targetUrl: string) {
  const dom = await page.evaluate(`(() => {
    const text = (selector) => Array.from(document.querySelectorAll(selector))
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 30);
    return {
      title: document.title,
      url: location.href,
      labels: text('label, .x-form-item-label, h1, h2, h3, .x-panel-header-text, .nav-label'),
      buttons: text('button, .x-btn, [role="button"]'),
      extJsPanels: document.querySelectorAll('.x-panel, .x-container').length,
    };
  })()`);

  const loggedIn = !dom.url.includes('login');

  return {
    id: `snap_${Date.now().toString(36)}`,
    product,
    version: dom.title || 'latest',
    capturedAt: new Date().toISOString(),
    targetUrl,
    sections: {
      general: {
        title: '콘솔 상태',
        items: {
          pageTitle: dom.title,
          currentUrl: dom.url,
          loginState: loggedIn ? 'authenticated' : 'login_required',
          extJsPanels: String(dom.extJsPanels),
        },
      },
      policy: {
        title: 'UI 요약',
        items: {
          visibleLabels: dom.labels.slice(0, 8).join(' | ') || 'n/a',
          visibleButtons: dom.buttons.slice(0, 5).join(' | ') || 'n/a',
        },
      },
    },
    metadata: { source: 'playwright-readonly-dom', readOnly: true, authenticated: String(loggedIn) },
  };
}

async function waitForServer(timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/system/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Operator console did not start on ${BASE}`);
}

function startOperator(): ChildProcess {
  return spawn('pnpm', ['exec', 'tsx', 'apps/operator-console/src/server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, SANGFOR_API_KEY: API_KEY, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const product = readProduct();
  const credentials = readCredentials(product);
  const targetUrl = process.env[`${product}_TARGET_URL`] ?? DEFAULT_URLS[product];
  const outputDir = join(process.cwd(), 'outputs', 'auto-ops-e2e');
  mkdirSync(outputDir, { recursive: true });

  const report: Record<string, unknown> = {
    product,
    targetUrl,
    startedAt: new Date().toISOString(),
    phases: {} as Record<string, unknown>,
  };

  // Phase 1: browser read-only snapshot
  const browserSession = await openSangforBrowser({
    product,
    headless: product === 'CC' ? false : true,
  });
  const page = browserSession.page;

  try {
    const login = await loginSangforConsole(page, {
      product,
      targetUrl,
      username: credentials.username,
      password: credentials.password,
    });
    const snapshot = await collectDomSnapshot(page, product, targetUrl);
    report.phases.browser = { login, snapshotId: snapshot.id, loggedIn: login.loggedIn };
    writeFileSync(join(outputDir, `${product.toLowerCase()}-snapshot.json`), JSON.stringify(snapshot, null, 2));

    // Phase 2: operator API flow
    const server = startOperator();
    try {
      await waitForServer();

      const planRes = await api('/api/plan', {
        method: 'POST',
        body: JSON.stringify({
          intent: '정책 상태 조회',
          product,
          dryRun: true,
          snapshot,
        }),
      });

      const plan = planRes.body as Record<string, unknown>;
      report.phases.plan = { status: planRes.status, planId: plan.id, planStatus: plan.status };

      if (plan.status === 'pending_approval' && plan.approvalId) {
        const approveRes = await api(`/api/approvals/${plan.approvalId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ approvedBy: 'e2e-tester' }),
        });
        report.phases.approval = { status: approveRes.status, body: approveRes.body };
      } else if (plan.status !== 'approved') {
        const bgReq = await api('/api/breakglass/request', {
          method: 'POST',
          body: JSON.stringify({
            reason: 'auto-ops e2e read-only verification',
            requestedBy: 'e2e-tester',
            durationMinutes: 15,
          }),
        });
        const bgId = (bgReq.body as { id?: string }).id;
        if (bgId) {
          const bgApprove = await api(`/api/breakglass/${bgId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ approvedBy: 'e2e-tester' }),
          });
          report.phases.breakglass = { request: bgReq.status, approve: bgApprove.status };
        }
      }

      const execRes = await api(`/api/execute/${plan.id}`, { method: 'POST', body: '{}' });
      report.phases.execute = { status: execRes.status, body: execRes.body };
    } finally {
      server.kill('SIGTERM');
    }
  } finally {
    await browserSession.close().catch(() => undefined);
  }

  report.finishedAt = new Date().toISOString();
  const reportPath = join(outputDir, `${product.toLowerCase()}-auto-ops-report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`auto-ops device E2E report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));

  const executePhase = report.phases.execute as { status?: number } | undefined;
  if (executePhase?.status !== 200) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
