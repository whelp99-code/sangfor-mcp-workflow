/**
 * 제품별 메뉴 스크린샷 + DOM 수집 (Playwright)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import {
  buildMenuUrl,
  collectionTimestamp,
  getMenuRoutes,
  newDeviceId,
  type DeviceCollection,
  type DeviceDomSummary,
  type DeviceMenuCapture,
  type DeviceMenuRoute,
  type SangforProduct,
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
  const criticalAlerts = bodyText.match(/Critical[\\s\\S]{0,20}?(\\d+)/i);
  if (criticalAlerts) metrics.criticalAlerts = Number(criticalAlerts[1]);
  const offlineAgents = bodyText.match(/Offline[\\s\\S]{0,20}?(\\d+)/i);
  if (offlineAgents) metrics.offlineAgents = Number(offlineAgents[1]);
  return {
    title: document.title || '',
    url: location.href,
    panels: document.querySelectorAll('.x-panel, .x-container, .el-card').length,
    tables: document.querySelectorAll('table, .x-grid, .el-table').length,
    gridRows: document.querySelectorAll('.x-grid-row, tr, .el-table__row').length,
    labels: text('label, .x-panel-header-text, h1, h2, h3, .x-grid-cell-inner, .el-card__header', 50),
    metrics,
  };
})()`;

async function captureDom(page: Page): Promise<DeviceDomSummary> {
  return page.evaluate(DOM_EVAL) as Promise<DeviceDomSummary>;
}

async function pageHas404(page: Page): Promise<boolean> {
  return page.getByText(/404\s*not\s*found/i).isVisible().catch(() => false);
}

async function navigateToMenu(
  page: Page,
  product: SangforProduct,
  baseUrl: string,
  hashRoute: string,
): Promise<void> {
  const target = buildMenuUrl(baseUrl, product, hashRoute);
  const waitUntil = product === 'IAG' ? 'networkidle' as const : 'domcontentloaded' as const;
  const settleMs = product === 'IAG' ? 6000 : 4000;

  await page.goto(target, { waitUntil, timeout: 45_000 });
  await page.waitForTimeout(settleMs);

  if (product === 'IAG' && await pageHas404(page)) {
    const legacyHash = hashRoute.replace(/^\/#\//, '#');
    await page.evaluate((hash) => { window.location.hash = hash; }, legacyHash);
    await page.waitForTimeout(settleMs);
  }
}

async function captureMenu(
  page: Page,
  product: SangforProduct,
  baseUrl: string,
  route: DeviceMenuRoute,
  outputDir: string,
): Promise<DeviceMenuCapture> {
  const capturedAt = new Date().toISOString();
  const target = buildMenuUrl(baseUrl, product, route.hashRoute);

  try {
    await navigateToMenu(page, product, baseUrl, route.hashRoute);

    const domSummary = await captureDom(page);
    const is404 = await pageHas404(page);
    const slug = route.id;
    const screenshotPath = join(outputDir, 'screenshots', `${slug}.png`);
    const domPath = join(outputDir, 'dom', `${slug}.json`);

    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
    mkdirSync(join(outputDir, 'dom'), { recursive: true });

    await page.screenshot({ path: screenshotPath, fullPage: false });
    writeFileSync(domPath, JSON.stringify(domSummary, null, 2));

    if (is404) {
      return {
        id: route.id,
        name: route.name,
        menuPath: route.menuPath,
        hashRoute: route.hashRoute,
        url: page.url(),
        status: 'error',
        error: '404 Not Found — invalid or unauthorized route',
        screenshotPath,
        domPath,
        domSummary,
        capturedAt,
      };
    }

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

function detectVersion(menus: DeviceMenuCapture[]): string {
  for (const menu of menus) {
    for (const label of menu.domSummary?.labels ?? []) {
      const match = label.match(/V[\d.]+[A-Z]?/i);
      if (match) return match[0];
    }
  }
  return 'unknown';
}

export interface DeviceCaptureOptions {
  product: SangforProduct;
  targetUrl: string;
  outputDir: string;
  page: Page;
  routes?: DeviceMenuRoute[];
}

export async function captureDeviceMenus(options: DeviceCaptureOptions): Promise<DeviceCollection> {
  const routes = options.routes ?? getMenuRoutes(options.product);
  const menus: DeviceMenuCapture[] = [];

  for (const route of routes) {
    menus.push(await captureMenu(options.page, options.product, options.targetUrl, route, options.outputDir));
  }

  return {
    product: options.product,
    targetUrl: options.targetUrl,
    deviceId: newDeviceId(options.product),
    version: detectVersion(menus),
    collectedAt: collectionTimestamp(),
    loginUrl: options.page.url(),
    menus,
  };
}

/** @deprecated CC 전용 — captureDeviceMenus 사용 */
export async function captureCcMenus(options: Omit<DeviceCaptureOptions, 'product'> & { routes?: DeviceMenuRoute[] }): Promise<DeviceCollection> {
  return captureDeviceMenus({ ...options, product: 'CC' });
}
