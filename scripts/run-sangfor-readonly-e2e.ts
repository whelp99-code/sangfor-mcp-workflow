#!/usr/bin/env tsx
/**
 * Sangfor read-only DOM/HAR E2E smoke.
 *
 * This script only opens the console, optionally logs in, captures HAR/DOM
 * evidence, and exits. It does not apply configuration or click save/apply.
 */

import 'dotenv/config';

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginSangforConsole } from './lib/sangfor-console-login.js';

type Product = 'EPP' | 'IAG' | 'CC';

interface E2EOptions {
  product: Product;
  targetUrl: string;
  outputDir: string;
  durationMs: number;
  headless: boolean;
}

const DEFAULT_URLS: Record<Product, string> = {
  EPP: 'https://10.80.1.106',
  IAG: 'https://10.80.1.108',
  CC: 'https://10.80.1.107',
};

function readOptions(): E2EOptions {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  };

  const product = (getArg('--product') ?? 'EPP').toUpperCase() as Product;
  if (!['EPP', 'IAG', 'CC'].includes(product)) {
    throw new Error('--product must be one of EPP, IAG, CC');
  }

  return {
    product,
    targetUrl: getArg('--target') ?? process.env[`${product}_TARGET_URL`] ?? DEFAULT_URLS[product],
    outputDir: getArg('--output') ?? join(process.cwd(), 'outputs', 'sangfor-readonly-e2e'),
    durationMs: Number(getArg('--duration-ms') ?? '8000'),
    headless: !args.includes('--headed'),
  };
}

function readCredentials(product: Product): { username: string; password: string } | null {
  const username = process.env[`${product}_USERNAME`] ?? '';
  const password = process.env[`${product}_PASSWORD`] ?? '';
  return username && password ? { username, password } : null;
}

async function main() {
  const options = readOptions();
  const credentials = readCredentials(options.product);
  mkdirSync(options.outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const harPath = join(options.outputDir, `${options.product.toLowerCase()}-${stamp}.har`);
  const screenshotPath = join(options.outputDir, `${options.product.toLowerCase()}-${stamp}.png`);
  const reportPath = join(options.outputDir, `${options.product.toLowerCase()}-${stamp}.json`);

  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    recordHar: {
      path: harPath,
      content: 'embed',
      mode: 'full',
    },
  });

  const page = await context.newPage();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let loginResult: Awaited<ReturnType<typeof loginSangforConsole>> | null = null;

  try {
    if (credentials) {
      loginResult = await loginSangforConsole(page, {
        product: options.product,
        targetUrl: options.targetUrl,
        username: credentials.username,
        password: credentials.password,
      });
      if (loginResult.error) {
        errors.push(loginResult.error);
      }
    } else {
      await page.goto(options.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    }

    await page.waitForTimeout(options.durationMs);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const domSummary = await page.evaluate(`(() => {
      const text = (selector) => Array.from(document.querySelectorAll(selector))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 100);

      return {
        title: document.title,
        url: location.href,
        forms: document.querySelectorAll('form').length,
        passwordInputs: document.querySelectorAll('input[type="password"]').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
        buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"], .x-btn, [role="button"]').length,
        extJs: {
          panels: document.querySelectorAll('.x-panel, .x-container').length,
          comboLists: document.querySelectorAll('.x-combo-list, .x-boundlist, [role="listbox"]').length,
          formItems: document.querySelectorAll('.x-form-item, .x-field').length,
        },
        labels: text('label, .x-form-item-label, td, span'),
      };
    })()`);

    writeFileSync(reportPath, JSON.stringify({
      product: options.product,
      targetUrl: options.targetUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      readOnly: true,
      login: loginResult,
      credentialsAvailable: Boolean(credentials),
      artifacts: {
        harPath,
        screenshotPath,
      },
      domSummary,
      errors,
    }, null, 2), 'utf8');
  } catch (err) {
    errors.push(String(err));
    writeFileSync(reportPath, JSON.stringify({
      product: options.product,
      targetUrl: options.targetUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      readOnly: true,
      login: loginResult,
      credentialsAvailable: Boolean(credentials),
      artifacts: {
        harPath,
        screenshotPath,
      },
      errors,
    }, null, 2), 'utf8');
    throw err;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  console.log(`read-only E2E report: ${reportPath}`);
  console.log(`HAR: ${harPath}`);
  console.log(`screenshot: ${screenshotPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
