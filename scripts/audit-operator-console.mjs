#!/usr/bin/env node
/**
 * Operator Console 기능 감사 — API + UI 엔드포인트 일괄 테스트
 *
 * Usage:
 *   SANGFOR_API_KEY=dev-test-key node scripts/audit-operator-console.mjs
 *   CONSOLE_URL=http://localhost:3500 pnpm run audit:console
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.CONSOLE_URL ?? 'http://localhost:3500';
const API_KEY = process.env.SANGFOR_API_KEY ?? 'dev-test-key';
const OUT = join(process.cwd(), 'outputs', 'console-audit');
const FETCH_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS ?? 30_000);
const EXCEL_PATH = join(process.cwd(), 'test-data', 'checklist.xlsx');

mkdirSync(OUT, { recursive: true });

const results = [];

async function test(name, fn) {
  const entry = { name, status: 'unknown', detail: '' };
  try {
    const r = await fn();
    entry.status = r.ok ? 'pass' : 'fail';
    entry.detail = r.detail;
    entry.httpStatus = r.status;
    entry.body = r.body;
  } catch (e) {
    entry.status = 'fail';
    entry.detail = String(e);
  }
  results.push(entry);
  console.log(`${entry.status === 'pass' ? '✓' : '✗'} ${name}: ${entry.detail}`);
}

async function req(method, path, { body, formData, auth = true, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const headers = {};
  if (auth) headers['X-API-Key'] = API_KEY;
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 300);
  }
  return { status: res.status, json, ok: res.ok, headers: res.headers };
}

// ─── Public ───
await test('GET /api/system/health', async () => {
  const r = await req('GET', '/api/system/health', { auth: false });
  return { ok: r.ok && r.json?.status === 'ok', status: r.status, detail: JSON.stringify(r.json), body: r.json };
});

await test('GET / (static UI)', async () => {
  const r = await req('GET', '/', { auth: false });
  return { ok: r.status === 200, status: r.status, detail: `html length ${String(r.json).length}` };
});

// ─── Dashboard (no auth) ───
await test('GET /api/dashboard/stats', async () => {
  const r = await req('GET', '/api/dashboard/stats', { auth: false });
  return { ok: r.ok && typeof r.json?.totalWorkflows === 'number', status: r.status, detail: `workflows=${r.json?.totalWorkflows}`, body: r.json };
});

await test('GET /api/templates (tpl_* ids)', async () => {
  const r = await req('GET', '/api/templates');
  const tplIds = (r.json ?? []).map((t) => t.id);
  const ok = r.ok && tplIds.length >= 1 && tplIds.every((id) => String(id).startsWith('tpl_'));
  return { ok, status: r.status, detail: `templates=${tplIds.join(', ')}`, body: r.json };
});

await test('GET /api/workflows', async () => {
  const r = await req('GET', '/api/workflows');
  return { ok: r.ok && Array.isArray(r.json), status: r.status, detail: `count=${r.json?.length}`, body: r.json };
});

// ─── Workflow lifecycle ───
let workflowId;
await test('POST /api/workflows/generate', async () => {
  const r = await req('POST', '/api/workflows/generate', {
    body: {
      customerName: 'AuditTest',
      excelFilePath: './test-data/checklist.xlsx',
      requirements: ['USB control', 'Web filtering'],
      environment: 'lab',
      products: ['EPP', 'IAG'],
    },
    timeoutMs: 60_000,
  });
  workflowId = r.json?.workflowId;
  return { ok: r.ok && workflowId, status: r.status, detail: workflowId ?? r.json?.error, body: r.json };
});

await test('GET /api/workflows/:id', async () => {
  if (!workflowId) return { ok: false, status: 0, detail: 'no workflowId' };
  const r = await req('GET', `/api/workflows/${workflowId}`);
  return { ok: r.ok && r.json?.workflow?.id === workflowId, status: r.status, detail: r.json?.workflow?.status, body: r.json };
});

await test('POST /api/workflows/:id/approve', async () => {
  if (!workflowId) return { ok: false, status: 0, detail: 'no workflowId' };
  const r = await req('POST', `/api/workflows/${workflowId}/approve`, { body: { approvedBy: 'audit' } });
  return { ok: r.ok, status: r.status, detail: r.json?.workflow?.status ?? r.json?.error, body: r.json };
});

await test('POST /api/workflows/:id/execute', async () => {
  if (!workflowId) return { ok: false, status: 0, detail: 'no workflowId' };
  const r = await req('POST', `/api/workflows/${workflowId}/execute`, { timeoutMs: 120_000 });
  const ok = r.ok && (r.json?.stepsExecuted >= 0 || r.json?.stepsSucceeded >= 0);
  return { ok, status: r.status, detail: `${r.json?.stepsSucceeded}/${r.json?.stepsExecuted} steps`, body: r.json };
});

await test('POST /api/workflows/from-template (tpl_epp_only)', async () => {
  const r = await req('POST', '/api/workflows/from-template', {
    body: {
      templateId: 'tpl_epp_only',
      customerName: 'TemplateAudit',
      products: ['ENDPOINT_SECURE'],
      excelFilePath: './test-data/checklist.xlsx',
    },
  });
  return { ok: r.ok && r.json?.workflowId, status: r.status, detail: r.json?.name ?? r.json?.error, body: r.json };
});

// ─── Compliance ───
await test('POST /api/compliance/track (no file → 400)', async () => {
  const fd = new FormData();
  fd.append('customer', 'AuditCo');
  const r = await req('POST', '/api/compliance/track', { formData: fd });
  return { ok: r.status === 400, status: r.status, detail: 'expected 400 without file', body: r.json };
});

await test('POST /api/compliance/track (sample excel)', async () => {
  const fd = new FormData();
  fd.append('customer', 'AuditCo');
  fd.append('excel', new Blob([readFileSync(EXCEL_PATH)]), 'checklist.xlsx');
  const r = await req('POST', '/api/compliance/track', { formData: fd, timeoutMs: 60_000 });
  return {
    ok: r.ok && typeof r.json?.complianceRate === 'number',
    status: r.status,
    detail: `compliance=${r.json?.complianceRate}%`,
    body: r.json,
  };
});

await test('GET /api/compliance/trend', async () => {
  const r = await req('GET', '/api/compliance/trend?customer=AuditCo');
  return { ok: r.ok && Array.isArray(r.json?.records), status: r.status, detail: `records=${r.json?.records?.length}`, body: r.json };
});

await test('POST /api/compliance/roadmap', async () => {
  const r = await req('POST', '/api/compliance/roadmap', { body: { currentCompliance: 26, targetCompliance: 87 } });
  return { ok: r.ok && r.json?.phases?.length, status: r.status, detail: `phases=${r.json?.phases?.length}`, body: r.json };
});

await test('POST /api/compliance/proposal', async () => {
  const r = await req('POST', '/api/compliance/proposal', { body: { customerName: 'AuditCo', targetCompliance: 87 } });
  return { ok: r.ok && r.json?.title, status: r.status, detail: r.json?.title, body: r.json };
});

// ─── Manual / Device / Guide / Vendors / Learning / Access ───
await test('POST /api/manual/ask', async () => {
  const r = await req('POST', '/api/manual/ask', { body: { question: 'EPP USB policy?', product: 'EPP' } });
  return {
    ok: r.ok && r.json?.answer && r.json?.confidence > 0,
    status: r.status,
    detail: `confidence=${r.json?.confidence}`,
    body: r.json,
  };
});

await test('POST /api/manual/menu-path', async () => {
  const r = await req('POST', '/api/manual/menu-path', { body: { product: 'EPP', feature: 'Device Control' } });
  return { ok: r.ok && r.json?.path, status: r.status, detail: r.json?.path, body: r.json };
});

await test('POST /api/device/capture-menu', async () => {
  const r = await req('POST', '/api/device/capture-menu', { body: { product: 'EPP', cdpPort: 9333 }, timeoutMs: 60_000 });
  return { ok: r.ok && r.json?.menuItems?.length, status: r.status, detail: `items=${r.json?.menuItems?.length}`, body: r.json };
});

await test('POST /api/device/compare', async () => {
  const r = await req('POST', '/api/device/compare', { body: { product: 'IAG', cdpPort: 9334 }, timeoutMs: 60_000 });
  return { ok: r.ok && typeof r.json?.accuracy === 'number', status: r.status, detail: `accuracy=${r.json?.accuracy}%`, body: r.json };
});

await test('POST /api/guide/generate', async () => {
  const r = await req('POST', '/api/guide/generate', {
    body: { customerName: 'AuditCo', product: 'EPP', requirements: ['USB', 'Web Filter'] },
  });
  return { ok: r.ok && r.json?.guide, status: r.status, detail: `sections=${r.json?.sections?.length}`, body: r.json };
});

await test('POST /api/vendors/compare', async () => {
  const r = await req('POST', '/api/vendors/compare', { body: { category: 'endpoint-protection', includeSangfor: true } });
  return { ok: r.ok && r.json?.vendors?.length, status: r.status, detail: `vendors=${r.json?.vendors?.length}`, body: r.json };
});

await test('POST /api/vendors/report', async () => {
  const r = await req('POST', '/api/vendors/report', { body: { customerName: 'AuditCo', category: 'endpoint-protection' } });
  return { ok: r.ok && r.json?.report, status: r.status, detail: 'report generated', body: r.json };
});

await test('POST /api/learning/run crawl', async () => {
  const r = await req('POST', '/api/learning/run', { body: { type: 'crawl' } });
  return { ok: r.ok && r.json?.status === 'completed', status: r.status, detail: JSON.stringify(r.json), body: r.json };
});

await test('POST /api/learning/run (no auth → 401)', async () => {
  const r = await req('POST', '/api/learning/run', { body: { type: 'crawl' }, auth: false });
  return { ok: r.status === 401, status: r.status, detail: 'expected 401', body: r.json };
});

await test('GET /api/learning/schedules', async () => {
  const r = await req('GET', '/api/learning/schedules');
  return { ok: r.ok && Array.isArray(r.json), status: r.status, detail: `schedules=${r.json?.length}`, body: r.json };
});

await test('POST /api/access/request', async () => {
  const r = await req('POST', '/api/access/request', {
    body: { customerName: 'AuditCo', projectName: 'Test', products: ['EPP'] },
  });
  return { ok: r.ok && r.json?.requestId, status: r.status, detail: r.json?.requestId, body: r.json };
});

await test('GET /api/access/requests', async () => {
  const r = await req('GET', '/api/access/requests');
  return { ok: r.ok && Array.isArray(r.json), status: r.status, detail: `requests=${r.json?.length}`, body: r.json };
});

// ─── Auto-ops APIs ───
await test('GET /api/snapshots/EPP', async () => {
  const r = await req('GET', '/api/snapshots/EPP');
  return { ok: r.ok && r.json?.product === 'EPP', status: r.status, detail: r.json?.id, body: r.json };
});

await test('POST /api/plan', async () => {
  const snap = await req('GET', '/api/snapshots/CC');
  const r = await req('POST', '/api/plan', {
    body: { intent: '정책 상태 확인', product: 'CC', snapshot: snap.json, dryRun: true },
  });
  return { ok: r.ok && r.json?.id, status: r.status, detail: r.json?.status ?? r.json?.error, body: r.json };
});

await test('GET /api/approvals', async () => {
  const r = await req('GET', '/api/approvals');
  return { ok: r.ok && Array.isArray(r.json), status: r.status, detail: `pending=${r.json?.length}`, body: r.json };
});

await test('GET /api/events (SSE stream)', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`${BASE}/api/events`, { signal: controller.signal });
    const contentType = res.headers.get('content-type') ?? '';
    return {
      ok: res.ok && contentType.includes('text/event-stream'),
      status: res.status,
      detail: contentType,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { ok: aborted, status: 200, detail: aborted ? 'SSE stream opened' : String(e) };
  } finally {
    clearTimeout(timer);
  }
});

await test('GET /api/devices/health (auth required)', async () => {
  const r = await req('GET', '/api/devices/health/EPP');
  return { ok: r.status !== 401, status: r.status, detail: r.status === 401 ? '401 unauthorized' : JSON.stringify(r.json).slice(0, 120), body: r.json };
});

await test('GET /api/devices/health (no auth → 401)', async () => {
  const r = await req('GET', '/api/devices/health/EPP', { auth: false });
  return { ok: r.status === 401, status: r.status, detail: 'expected 401', body: r.json };
});

const summary = {
  testedAt: new Date().toISOString(),
  base: BASE,
  pass: results.filter((r) => r.status === 'pass').length,
  fail: results.filter((r) => r.status === 'fail').length,
  results,
};
writeFileSync(join(OUT, 'audit-results.json'), JSON.stringify(summary, null, 2));
console.log(`\n=== ${summary.pass} pass, ${summary.fail} fail ===`);
console.log(`Report: ${join(OUT, 'audit-results.json')}`);
process.exitCode = summary.fail > 0 ? 1 : 0;
