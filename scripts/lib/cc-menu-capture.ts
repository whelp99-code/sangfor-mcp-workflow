/**
 * CC 메뉴별 스크린샷 + DOM 수집 (Playwright)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import {
  CC_MENU_ROUTES,
  newCcDeviceId,
  collectionTimestamp,
  type CcDeviceCollection,
  type CcDomSummary,
  type CcMenuCapture,
} from '@sangfor/health-checker';

const DOM_EVAL = `(() => {
  const text = (selector, limit) => Array.from(document.querySelectorAll(selector))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean)
    .slice(0, limit || 40);
  const bodyText = (document.body?.innerText || '').slice(0, 8000);
  const metrics = {};
  const pendingRisks = bodyText.match(/Pending Risks\\s*(\\d+)/i);
  if (pendingRisks) metrics.pendingRisks = Number(pendingRisks[1]);
  const pendingServers = bodyText.match(/Pending Servers[\\s\\S]{0,40}?(\\d+)/i);
  if (pendingServers) metrics.pendingServers = Number(pendingServers[1]);
  const pendingHosts = bodyText.match(/Pending Hosts[\\s\\S]{0,40}?(\\d+)/i);
  if (pendingHosts) metrics.pendingHosts = Number(pendingHosts[1]);
  return {
    title: document.title || 'Cyber Command',
    url: location.href,
    panels: document.querySelectorAll('.x-panel, .x-container').length,
    tables: document.querySelectorAll('table, .x-grid').length,
    gridRows: document.querySelectorAll('.x-grid-row, tr').length,
    labels: text('label, .x-panel-header-text, h1, h2, h3, .x-grid-cell-inner', 50),
    metrics,
  };
})()`;

async function captureDom(page: Page): Promise<CcDomSummary> {
  return page.evaluate(DOM_EVAL) as Promise<CcDomSummary>;
}

async function captureMenu(
  page: Page,
  baseUrl: string,
  route: typeof CC_MENU_ROUTES[number],
  outputDir: string,
): Promise<CcMenuCapture> {
  const capturedAt = new Date().toISOString();
  const target = `${baseUrl.replace(/\/$/, '')}/ui${route.hashRoute}`;

  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(4000);

    const domSummary = await captureDom(page);
    const slug = route.id;
    const screenshotPath = join(outputDir, 'screenshots', `${slug}.png`);
    const domPath = join(outputDir, 'dom', `${slug}.json`);

    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
    mkdirSync(join(outputDir, 'dom'), { recursive: true });

    await page.screenshot({ path: screenshotPath, fullPage: false });
    writeFileSync(domPath, JSON.stringify(domSummary, null, 2));

    return {
      id: route.id,
      name: route.name,
      menuPath: route.menuPath,
      hashRoute: route.hashRoute,
      url: page.url(),
      status: 'ok',
      screenshotPath,
      domPath,
      domSummary,
      capturedAt,
    };
  } catch (error) {
    return {
      id: route.id,
      name: route.name,
      menuPath: route.menuPath,
      hashRoute: route.hashRoute,
      url: target,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      capturedAt,
    };
  }
}

function detectVersion(menus: CcMenuCapture[]): string {
  for (const menu of menus) {
    for (const label of menu.domSummary?.labels ?? []) {
      const match = label.match(/V[\d.]+[A-Z]?/i);
      if (match) return match[0];
    }
  }
  return 'unknown';
}

export interface CcCaptureOptions {
  targetUrl: string;
  outputDir: string;
  page: Page;
  routes?: typeof CC_MENU_ROUTES;
}

export async function captureCcMenus(options: CcCaptureOptions): Promise<CcDeviceCollection> {
  const routes = options.routes ?? CC_MENU_ROUTES;
  const menus: CcMenuCapture[] = [];

  for (const route of routes) {
    menus.push(await captureMenu(options.page, options.targetUrl, route, options.outputDir));
  }

  return {
    product: 'CC',
    targetUrl: options.targetUrl,
    deviceId: newCcDeviceId(),
    version: detectVersion(menus),
    collectedAt: collectionTimestamp(),
    loginUrl: options.page.url(),
    menus,
  };
}
