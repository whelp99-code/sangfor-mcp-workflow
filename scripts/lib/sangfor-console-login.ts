/**
 * CAPTCHA OCR 로그인 — EPP/CC/IAG 공통 (loginToConsole await 버그 우회)
 */

import type { Locator, Page } from 'playwright';
import { detectCaptcha } from '@sangfor/chrome';
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

const PRODUCT_SELECTORS: Record<SangforProduct, {
  user: string;
  password: string;
  captcha: string;
}> = {
  EPP: {
    user: '#user, input[name="user"]',
    password: '#password, input[name="password"], input[type="password"]',
    captcha: '#code, input[name="captcha"], input[name="verify_code"], input[name="code"]',
  },
  CC: {
    user: 'input[name="name"]:not([readonly]), input[name="username"]:not([readonly])',
    password: 'input[name="password"]:not([readonly]), input[type="password"]',
    captcha: 'input[name="captcha"], input[name="verify_code"], input[name="code"]',
  },
  IAG: {
    user: 'input[name="name"]:not([readonly]), input[name="username"], input[name="user"]',
    password: 'input[name="password"], input[type="password"]',
    captcha: 'input[name="captcha"], input[name="verify_code"], input[name="code"]',
  },
};

/** EULA/DPA 링크 텍스트는 클릭하지 않음 — Terms 모달이 열림 */
async function acceptEulaCheckboxOnly(page: Page): Promise<void> {
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const box = checkboxes.nth(i);
    if (!(await box.isChecked().catch(() => false))) {
      await box.check({ force: true }).catch(() => undefined);
    }
  }
}

async function dismissIagLicenseOverlay(page: Page): Promise<void> {
  const exitBtn = page.getByText('Exit', { exact: true });
  if (await exitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exitBtn.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
}

async function stabilizeIagSession(page: Page, targetUrl: string): Promise<void> {
  await page.waitForURL(/10\.80\.1\.\d+\/(index\.php|#)/, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);

  const probeUrl = `${targetUrl.replace(/\/$/, '')}/#/onlineActivities/accessPolicy`;
  if (!page.url().includes('/#/')) {
    await page.goto(probeUrl, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
  }

  await dismissIagLicenseOverlay(page);
}

async function selectIagAccountTabIfNeeded(page: Page): Promise<void> {
  const onSmsTab = await page.getByText('Email Address').isVisible().catch(() => false);
  if (!onSmsTab) {
    return;
  }

  const accountTab = page.getByText('Account', { exact: true });
  const count = await accountTab.count();
  for (let i = 0; i < count; i++) {
    const tab = accountTab.nth(i);
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function clickLoginButton(
  page: Page,
  product: SangforProduct,
  passInput: Locator,
): Promise<void> {
  if (product === 'EPP') {
    const eppBtn = page.locator('#button').first();
    if (await eppBtn.isVisible().catch(() => false)) {
      await eppBtn.click({ timeout: 5000 });
      return;
    }
  }

  const loginBtn = page.getByRole('button', { name: /^Log In$/i });
  if (await loginBtn.count()) {
    await loginBtn.first().click({ timeout: 5000 });
    return;
  }

  await passInput.press('Enter');
}

async function refreshCaptchaIfPresent(page: Page): Promise<void> {
  const refresh = page.locator(
    'a:has-text("Refresh"), span:has-text("Refresh"), button:has-text("Refresh"), .refresh, [class*="refresh"]',
  ).first();
  if (await refresh.count()) {
    await refresh.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
}

function isLoggedIn(url: string, product?: SangforProduct): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('login') || lower.includes('login.php')) {
    return false;
  }
  if (product === 'IAG') {
    return lower.includes('/#/') && !lower.includes('errorpage');
  }
  if (url.includes('/#/') || url.includes('/ui/#') || url.includes('/ui/index')) {
    return true;
  }
  try {
    const { pathname } = new URL(url);
    return pathname !== '/' && pathname !== '' && pathname !== '/index.php';
  } catch {
    return false;
  }
}

async function pageLooksLoggedIn(page: Page, product: SangforProduct): Promise<boolean> {
  if (product === 'IAG') {
    if (!page.url().includes('/#/')) {
      return false;
    }
    await dismissIagLicenseOverlay(page);
    if (await page.getByText(/404\s*not\s*found/i).isVisible().catch(() => false)) {
      return false;
    }
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/authorization code:/i.test(bodyText) && /license key:/i.test(bodyText)) {
      return false;
    }
    return true;
  }

  if (!isLoggedIn(page.url(), product)) {
    return false;
  }
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/404\s*not\s*found/i.test(bodyText)) {
    return false;
  }
  return true;
}

async function isLoginFormVisible(page: Page, passwordSelector: string): Promise<boolean> {
  const count = await page.locator(passwordSelector).count();
  return count > 0;
}

async function loginWithCaptchaOcr(
  page: Page,
  options: ConsoleLoginOptions,
): Promise<ConsoleLoginResult> {
  const maxRetries = options.maxCaptchaRetries ?? 5;
  const { targetUrl, username, password, product } = options;
  const selectors = PRODUCT_SELECTORS[product];

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000);

  const initialUrl = page.url();
  if (await pageLooksLoggedIn(page, product)) {
    return {
      loginAttempted: false,
      loggedIn: true,
      url: initialUrl,
      captchaUsed: false,
    };
  }

  await page.waitForSelector(
    'input[type="password"], input[name="password"], #password',
    { timeout: 30_000 },
  ).catch(() => undefined);
  await page.waitForTimeout(1000);

  if (product === 'IAG') {
    await selectIagAccountTabIfNeeded(page);
  }

  if (!(await isLoginFormVisible(page, selectors.password))) {
    const url = page.url();
    if (await pageLooksLoggedIn(page, product)) {
      return {
        loginAttempted: false,
        loggedIn: true,
        url,
        captchaUsed: false,
      };
    }
  }

  let lastCaptchaText: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (await pageLooksLoggedIn(page, product)) {
      return {
        loginAttempted: attempt > 0,
        loggedIn: true,
        url: page.url(),
        captchaUsed: Boolean(lastCaptchaText),
        captchaText: lastCaptchaText,
      };
    }

    if (!(await isLoginFormVisible(page, selectors.password))) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(3000);
      if (product === 'IAG') {
        await selectIagAccountTabIfNeeded(page);
      }
    }

    if (!(await isLoginFormVisible(page, selectors.password))) {
      continue;
    }

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

    const userInput = product === 'IAG'
      ? page.locator('input[name="name"]:visible, input[name="username"]:visible, input[name="user"]:visible, input[type="text"]:visible').first()
      : page.locator(selectors.user).first();
    const passInput = page.locator(selectors.password).first();
    await userInput.fill(username);
    await passInput.fill(password);

    if (captchaText) {
      const captchaInput = page.locator(selectors.captcha).first();
      if (await captchaInput.count()) {
        await captchaInput.fill(captchaText);
      }
    }

    await acceptEulaCheckboxOnly(page);

    await clickLoginButton(page, product, passInput);
    if (product === 'IAG') {
      await stabilizeIagSession(page, targetUrl);
    } else {
      await page.waitForTimeout(5000);
    }

    const url = page.url();
    if (await pageLooksLoggedIn(page, product)) {
      return {
        loginAttempted: true,
        loggedIn: true,
        url,
        captchaUsed: Boolean(captchaText),
        captchaText: lastCaptchaText,
      };
    }

    if (attempt < maxRetries - 1) {
      await refreshCaptchaIfPresent(page);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(3000);
      if (product === 'IAG') {
        await selectIagAccountTabIfNeeded(page);
      }
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

export async function loginSangforConsole(
  page: Page,
  options: ConsoleLoginOptions,
): Promise<ConsoleLoginResult> {
  return loginWithCaptchaOcr(page, options);
}
