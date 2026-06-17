/**
 * 실장비 학습 수집 — sangfor-screenshot / @sangfor/chrome navigateMenu 프로세스
 *
 * hash 직접 이동 대신 ExtJS 메뉴 클릭 → 스크린샷 (engineer-mcp captureProductScreenshots 와 동일 흐름)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { navigateMenu, takeScreenshot } from '@sangfor/chrome';
import {
  collectionTimestamp,
  getMenuRoutes,
  newDeviceId,
  type DeviceCollection,
  type DeviceDomSummary,
  type DeviceMenuCapture,
  type SangforProduct,
} from '@sangfor/health-checker';
import {
  menuStepId,
  menuStepLabel,
  menuStepPath,
  PRODUCT_MENU_STEPS,
  type MenuPathStep,
} from './sangfor-product-menus.js';
import { captureDeviceMenus } from './device-menu-capture.js';

const DOM_EVAL = `(() => {
  const text = (selector, limit) => Array.from(document.querySelectorAll(selector))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean)
    .slice(0, limit || 40);
  const bodyText = (document.body?.innerText || '').slice(0, 8000);
  return {
    title: document.title || '',
    url: location.href,
    panels: document.querySelectorAll('.x-panel, .x-container, .el-card').length,
    tables: document.querySelectorAll('table, .x-grid, .el-table').length,
    gridRows: document.querySelectorAll('.x-grid-row, tr, .el-table__row').length,
    labels: text('label, .x-panel-header-text, h1, h2, h3, .x-grid-cell-inner, .el-card__header', 50),
    metrics: {},
    bodySnippet: bodyText.slice(0, 500),
  };
})()`;

export type CaptureMethod = 'menu' | 'hash';

export interface DeviceLearnCollectOptions {
  product: SangforProduct;
  targetUrl: string;
  outputDir: string;
  page: Page;
  method?: CaptureMethod;
}

async function captureDom(page: Page): Promise<DeviceDomSummary> {
  return page.evaluate(DOM_EVAL) as Promise<DeviceDomSummary>;
}

async function pageHas404(page: Page): Promise<boolean> {
  return page.getByText(/404\s*not\s*found/i).isVisible().catch(() => false);
}

function detectVersion(menus: DeviceMenuCapture[]): string {
  for (const menu of menus) {
    for (const label of menu.domSummary?.labels ?? []) {
      const match = label.match(/v?[\d.]+[A-Z]?/i);
      if (match && match[0].length > 3) return match[0];
    }
  }
  return 'unknown';
}

async function captureMenuByClick(
  page: Page,
  product: SangforProduct,
  targetUrl: string,
  step: MenuPathStep,
  outputDir: string,
): Promise<DeviceMenuCapture> {
  const capturedAt = new Date().toISOString();
  const id = menuStepId(step);
  const screenshotPath = join(outputDir, 'screenshots', `${id}.png`);
  const domPath = join(outputDir, 'dom', `${id}.json`);

  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  mkdirSync(join(outputDir, 'dom'), { recursive: true });

  try {
    await navigateMenu(page, [step]);
    await page.waitForTimeout(product === 'IAG' ? 4000 : 3000);

    const domSummary = await captureDom(page);
    const is404 = await pageHas404(page);

    await takeScreenshot(page, screenshotPath);
    writeFileSync(domPath, JSON.stringify(domSummary, null, 2));

    if (is404) {
      return {
        id,
        name: menuStepLabel(step),
        menuPath: menuStepPath(step),
        hashRoute: page.url(),
        url: page.url(),
        status: 'error',
        error: '404 Not Found after menu navigation',
        screenshotPath,
        domPath,
        domSummary,
        capturedAt,
      };
    }

    return {
      id,
      name: menuStepLabel(step),
      menuPath: menuStepPath(step),
      hashRoute: new URL(page.url()).hash || page.url(),
      url: page.url(),
      status: 'ok',
      screenshotPath,
      domPath,
      domSummary,
      capturedAt,
    };
  } catch (error) {
    return {
      id,
      name: menuStepLabel(step),
      menuPath: menuStepPath(step),
      hashRoute: '',
      url: targetUrl,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      capturedAt,
    };
  }
}

/**
 * sangfor-screenshot captureProductScreenshots 와 동일: 로그인 후 메뉴 클릭 수집
 */
export async function collectDeviceByMenuClick(
  options: DeviceLearnCollectOptions,
): Promise<DeviceCollection> {
  const steps = PRODUCT_MENU_STEPS[options.product];
  const menus: DeviceMenuCapture[] = [];

  console.log(`  수집 방식: menu-click (navigateMenu, ${steps.length} menus)`);

  for (const step of steps) {
    const label = menuStepLabel(step);
    process.stdout.write(`    → ${label}... `);
    const capture = await captureMenuByClick(
      options.page,
      options.product,
      options.targetUrl,
      step,
      options.outputDir,
    );
    menus.push(capture);
    console.log(capture.status === 'ok' ? '✓' : `✗ ${capture.error}`);
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

export async function collectDeviceForLearn(
  options: DeviceLearnCollectOptions,
): Promise<DeviceCollection> {
  const method = options.method ?? 'menu';

  if (method === 'hash') {
    console.log(`  수집 방식: hash-route (${getMenuRoutes(options.product).length} routes)`);
    return captureDeviceMenus({
      product: options.product,
      targetUrl: options.targetUrl,
      outputDir: options.outputDir,
      page: options.page,
    });
  }

  return collectDeviceByMenuClick(options);
}
