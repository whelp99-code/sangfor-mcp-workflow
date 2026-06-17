import { chromium } from 'playwright';
import { detectCaptcha, ocrCaptcha, loginToConsole } from '@sangfor/chrome';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

loadEnv();

const product = process.argv.includes('--product') ? process.argv[process.argv.indexOf('--product') + 1].toUpperCase() : 'EPP';
const targets = { EPP: 'https://10.80.1.106', CC: 'https://10.80.1.107' };
const passwords = { EPP: process.env.EPP_PASSWORD, CC: process.env.CC_PASSWORD };
process.env.SANGFOR_OCR_DIR = join(process.cwd(), 'outputs', 'captcha-ocr');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  if (process.argv.includes('--login')) {
    await loginToConsole(page, {
      product,
      targetUrl: targets[product],
      username: 'admin',
      password: passwords[product],
    }, 8);
    console.log('login ok', page.url());
    await browser.close();
    return;
  }

  await page.goto(targets[product], { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const c = await detectCaptcha(page);
  console.log('detect', c);
  if (c.imagePath) {
    const r = await ocrCaptcha(c.imagePath);
    console.log('ocr', r);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
