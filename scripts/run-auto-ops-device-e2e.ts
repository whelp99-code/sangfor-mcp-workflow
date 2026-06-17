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
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

async function tryLogin(page: import('playwright').Page, targetUrl: string, username: string, password: string) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(2000);

  const onLoginPage = await page.locator('input[type="password"]').count() > 0;
  if (!onLoginPage) {
    return { loginAttempted: false, loggedIn: true, url: page.url() };
  }

  const eula = page.locator('input[type="checkbox"]').first();
  if (await eula.count()) {
    await eula.check({ force: true }).catch(() => undefined);
  }

  const captchaImg = page.locator('img[src*="captcha"], img[src*="verify"], img[id*="captcha"]').first();
  let captchaText = '';
  if (await captchaImg.count()) {
    const captchaPath = join(process.cwd(), 'outputs', 'auto-ops-e2e', 'captcha.png');
    mkdirSync(join(process.cwd(), 'outputs', 'auto-ops-e2e'), { recursive: true });
    await captchaImg.screenshot({ path: captchaPath }).catch(() => undefined);
    captchaText = await page.evaluate(`(() => {
      const img = document.querySelector('img[src*="captcha"], img[src*="verify"], img[id*="captcha"]');
      return img && img.alt ? img.alt.trim() : '';
    })()`).catch(() => '');
  }

  await page.locator(
    'input[name="user"], input[name="username"], input[name="account"], input[name="name"], input[type="text"]',
  ).first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);

  if (captchaText) {
    await page.locator('input[name="captcha"], input[name="verify_code"], input[name="code"]').first()
      .fill(captchaText).catch(() => undefined);
  }

  await page.locator(
    'button:has-text("Log In"), button:has-text("Login"), button:has-text("로그인"), input[type="submit"]',
  ).first().click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(5000);

  const url = page.url();
  const loggedIn = !url.includes('login');
  return { loginAttempted: true, loggedIn, url, captchaText };
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
      labels: text('label, .x-form-item-label, h1, h2, h3, .x-panel-header-text'),
      buttons: text('button, .x-btn, [role="button"]'),
    };
  })()`);

  return {
    id: `snap_${Date.now().toString(36)}`,
    product,
    version: dom.title.includes('EPP') ? '6.0.4EN' : 'latest',
    capturedAt: new Date().toISOString(),
    targetUrl,
    sections: {
      general: {
        title: '콘솔 상태',
        items: {
          pageTitle: dom.title,
          currentUrl: dom.url,
          loginState: dom.url.includes('login') ? 'login_required' : 'authenticated',
        },
      },
      policy: {
        title: 'UI 요약',
        items: {
          visibleLabels: dom.labels.slice(0, 5).join(' | ') || 'n/a',
          visibleButtons: dom.buttons.slice(0, 5).join(' | ') || 'n/a',
        },
      },
    },
    metadata: { source: 'playwright-readonly-dom', readOnly: true },
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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    const login = await tryLogin(page, targetUrl, credentials.username, credentials.password);
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
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
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
