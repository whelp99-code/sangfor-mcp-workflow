/**
 * Sangfor 콘솔 브라우저 세션 — CC는 headed Chrome CDP 필수
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { ensureChromeRunning } from '@sangfor/chrome';
import type { SangforProduct } from './sangfor-console-login.js';

const CDP_PORTS: Record<SangforProduct, number> = {
  EPP: 9333,
  IAG: 9334,
  CC: 9335,
};

export interface SangforBrowserOptions {
  product: SangforProduct;
  headless?: boolean;
  harPath?: string;
  targetHost?: string;
}

export interface SangforBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

/** CC/EPP만 CDP — IAG는 headed Playwright launch */
function shouldUseCdpChrome(product: SangforProduct): boolean {
  return product === 'CC' || product === 'EPP';
}

async function connectCdpWithRetry(endpoint: string, attempts = 30): Promise<Browser> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await chromium.connectOverCDP(endpoint);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

export async function openSangforBrowser(
  options: SangforBrowserOptions,
): Promise<SangforBrowserSession> {
  const useCdp = shouldUseCdpChrome(options.product);

  if (useCdp) {
    const port = CDP_PORTS[options.product];
    const session = ensureChromeRunning({
      cdpPort: port,
      headless: false,
      ignoreCertErrors: true,
    });

    const browser = await connectCdpWithRetry(session.cdpEndpoint);
    const context = browser.contexts()[0]
      ?? await browser.newContext({ ignoreHTTPSErrors: true });

    const host = options.targetHost ?? (options.product === 'CC' ? '10.80.1.107' : undefined);
    const existing = host
      ? context.pages().find((p) => p.url().includes(host) && !p.url().includes('login'))
      : undefined;
    const page = existing ?? await context.newPage();

    return {
      browser,
      context,
      page,
      close: async () => {
        if (!existing) {
          await page.close().catch(() => undefined);
        }
      },
    };
  }

  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    ...(options.harPath
      ? { recordHar: { path: options.harPath, content: 'embed', mode: 'full' as const } }
      : {}),
  });
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}

export async function waitForLoginForm(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForSelector(
    'input[type="password"], input[name="password"], #password',
    { timeout: timeoutMs },
  ).catch(() => undefined);
  await page.waitForTimeout(2000);
}
