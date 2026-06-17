/**
 * Sangfor 콘솔 로그인 — @sangfor/chrome CAPTCHA OCR 연동
 *
 * EPP: randcode CAPTCHA + EULA 체크박스
 * IAG/CC: engineer-mcp loginToConsole 패턴
 */

import type { Page } from 'playwright';
import { detectCaptcha, loginToConsole, type LoginCredentials } from '@sangfor/chrome';
import { ocrCaptchaImage } from './captcha-ocr.js';

export type SangforProduct = 'EPP' | 'IAG' | 'CC';

export interface ConsoleLoginOptions {
  product: SangforProduct;
  targetUrl: string;
  username: string;
  password: string;
  maxCaptchaRetries?: number;
}

export interface ConsoleLoginResult {
  loginAttempted: boolean;
  loggedIn: boolean;
  url: string;
  captchaUsed: boolean;
  captchaText?: string;
  error?: string;
}

async function acceptEulaIfPresent(page: Page): Promise<void> {
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count()) {
    await checkbox.check({ force: true }).catch(() => undefined);
  }
}

/**
 * EPP 전용 로그인 — CAPTCHA를 먼저 OCR한 뒤 필드를 한 번에 채움
 */
async function loginEpp(
  page: Page,
  options: ConsoleLoginOptions,
): Promise<ConsoleLoginResult> {
  const maxRetries = options.maxCaptchaRetries ?? 3;
  const { targetUrl, username, password } = options;

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3000);

  let lastCaptchaText: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const captcha = await detectCaptcha(page);
    let captchaText: string | null = null;

    if (captcha.hasCaptcha && captcha.imagePath) {
      const ocr = await ocrCaptchaImage(captcha.imagePath);
      if (!ocr.success || !ocr.text) {
        return {
          loginAttempted: true,
          loggedIn: false,
          url: page.url(),
          captchaUsed: true,
          error: ocr.error ?? 'CAPTCHA OCR failed',
        };
      }
      captchaText = ocr.text;
      lastCaptchaText = captchaText;
    }

    await acceptEulaIfPresent(page);

    const userInput = page.locator('#user, input[name="user"]').first();
    const passInput = page.locator('#password, input[name="password"], input[type="password"]').first();
    await userInput.fill(username);
    await passInput.fill(password);

    if (captchaText) {
      const captchaInput = page.locator('#code, input[name="captcha"], input[name="verify_code"], input[name="code"]').first();
      if (await captchaInput.count()) {
        await captchaInput.fill(captchaText);
      }
    }

    await page.waitForTimeout(200);
    const loginBtn = page.locator('#button, button:has-text("Log In"), input[type="submit"]').first();
    await loginBtn.click({ timeout: 5000 }).catch(async () => {
      await passInput.press('Enter');
    });
    await page.waitForTimeout(5000);

    const url = page.url();
    if (!url.includes('login')) {
      return {
        loginAttempted: true,
        loggedIn: true,
        url,
        captchaUsed: Boolean(captchaText),
        captchaText: lastCaptchaText,
      };
    }

    if (attempt < maxRetries - 1) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(3000);
    }
  }

  return {
    loginAttempted: true,
    loggedIn: false,
    url: page.url(),
    captchaUsed: Boolean(lastCaptchaText),
    captchaText: lastCaptchaText,
    error: `Login failed after ${maxRetries} attempts`,
  };
}

/**
 * IAG/CC — engineer-mcp loginToConsole (CAPTCHA OCR 내장, await 버그는 로컬 EPP 경로로 우회)
 */
async function loginViaChromeManager(
  page: Page,
  options: ConsoleLoginOptions,
): Promise<ConsoleLoginResult> {
  const credentials: LoginCredentials = {
    username: options.username,
    password: options.password,
    product: options.product,
    targetUrl: options.targetUrl,
  };

  try {
    await loginToConsole(page, credentials, options.maxCaptchaRetries ?? 3);
    return {
      loginAttempted: true,
      loggedIn: true,
      url: page.url(),
      captchaUsed: true,
    };
  } catch (error) {
    return {
      loginAttempted: true,
      loggedIn: false,
      url: page.url(),
      captchaUsed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loginSangforConsole(
  page: Page,
  options: ConsoleLoginOptions,
): Promise<ConsoleLoginResult> {
  if (options.product === 'EPP') {
    return loginEpp(page, options);
  }

  return loginViaChromeManager(page, options);
}
