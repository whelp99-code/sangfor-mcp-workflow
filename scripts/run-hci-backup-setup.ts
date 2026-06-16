#!/usr/bin/env tsx
/**
 * HCI 백업 정책 자동 설정 — Phase 5
 *
 * 핵심 발견: 회색 텍스트 = 비활성화
 * 1. "Enable Backup" 클릭 → 백업 기능 활성화
 * 2. "New Policy" 클릭 → 정책 생성 다이얼로그
 * 3. 정책 설정 (이름, 스케줄, 보존)
 */

import { chromium, type Page, type Browser } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
function getArg(name: string, def: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : def;
}

const TARGET_URL = getArg('target', 'https://211.53.60.26');
const USERNAME = getArg('user', 'admin');
const PASSWORD = getArg('pass', 'aztech123!@#');
const POLICY_NAME = getArg('name', 'Daily-VM-Backup');
const OUTPUT_DIR = join(process.cwd(), 'outputs', 'hci-backup-setup');
mkdirSync(OUTPUT_DIR, { recursive: true });

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function ss(page: Page, name: string) {
  const path = join(OUTPUT_DIR, `${name}_${Date.now()}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`  📸 ${name}`);
  return path;
}

async function dumpText(page: Page, label: string) {
  const text = await page.evaluate(() => document.body.innerText);
  writeFileSync(join(OUTPUT_DIR, `${label}.txt`), text, 'utf-8');
  log(`  📄 ${label}.txt`);
  return text;
}

// ── 버튼 활성화 상태 확인 ──
async function checkButtonStates(page: Page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"], span.btn, .sfis-btn'));
    return buttons.map(el => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        text: (el.textContent ?? '').trim().slice(0, 50),
        class: (el as HTMLElement).className?.slice(0, 100),
        disabled: (el as HTMLButtonElement).disabled ?? el.classList.contains('disabled'),
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        color: style.color,
        visible: r.width > 0 && r.height > 0,
        x: Math.round(r.x),
        y: Math.round(r.y),
      };
    }).filter(b => b.text && b.visible);
  });
}

async function main() {
  log('='.repeat(60));
  log('HCI 백업 정책 자동 설정 — Phase 5');
  log('='.repeat(60));

  let browser: Browser | null = null;

  try {
    // 1) 브라우저
    log('\n[1] 브라우저 실행...');
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-web-security', '--ignore-certificate-errors'],
    });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    // 2) 로그인
    log('\n[2] 로그인...');
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);
    await page.locator('input[name="user"], input[name="username"], input[type="text"]').first().fill(USERNAME);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button:has-text("Log In"), button:has-text("Login"), button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    if (page.url().includes('login')) throw new Error('로그인 실패');
    log('  ✅ 로그인 성공');

    // 3) 백업 페이지 이동
    log('\n[3] 백업 페이지 이동...');
    await page.locator('text=Reliability').first().click();
    await page.waitForTimeout(2000);
    await page.locator('text=Scheduled Backup/CDP').first().click();
    await page.waitForTimeout(3000);
    await ss(page, 'p5_backup_page');

    // 버튼 상태 확인
    log('\n[3-1] 버튼 상태 확인...');
    const btnStates = await checkButtonStates(page);
    for (const b of btnStates) {
      const status = b.disabled || b.opacity === '0.5' || b.pointerEvents === 'none' ? '🔴 DISABLED' : '🟢 ACTIVE';
      log(`    ${status} "${b.text}" opacity=${b.opacity} pe=${b.pointerEvents} cls=${b.class.slice(0, 40)}`);
    }

    // 4) "Enable Backup" 클릭 — 백업 기능 활성화
    log('\n[4] Enable Backup 클릭...');

    // "Enable Backup" 텍스트를 가진 요소 찾기
    const enableBackup = page.locator('text=Enable Backup').first();
    if (await enableBackup.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('  Enable Backup 버튼 발견');
      await enableBackup.click();
      await page.waitForTimeout(3000);
      await ss(page, 'p5_after_enable_backup');

      // 확인 다이얼로그 처리
      const confirmBtn = page.locator('button:has-text("OK"), button:has-text("Confirm"), button:has-text("Yes"), button:has-text("확인")').first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        log('  확인 다이얼로그 발견 — OK 클릭');
        await confirmBtn.click();
        await page.waitForTimeout(3000);
      }
    } else {
      log('  Enable Backup 미발견 또는 이미 활성화됨');
    }

    await ss(page, 'p5_after_enable');
    await dumpText(page, 'p5_after_enable_text');

    // 5) 활성화 후 버튼 상태 재확인
    log('\n[5] 활성화 후 버튼 상태 재확인...');
    const btnStates2 = await checkButtonStates(page);
    for (const b of btnStates2) {
      const status = b.disabled || b.opacity === '0.5' || b.pointerEvents === 'none' ? '🔴 DISABLED' : '🟢 ACTIVE';
      log(`    ${status} "${b.text}" opacity=${b.opacity} pe=${b.pointerEvents}`);
    }

    // 6) "New Policy" 클릭
    log('\n[6] New Policy 클릭...');
    const newPolicyBtn = page.locator('a:has-text("New Policy"), button:has-text("New Policy"), span:has-text("New Policy")').first();
    if (await newPolicyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await newPolicyBtn.evaluate(el => {
        const style = window.getComputedStyle(el);
        return (el as HTMLButtonElement).disabled ||
          el.classList.contains('disabled') ||
          style.opacity === '0.5' ||
          style.pointerEvents === 'none';
      });

      if (isDisabled) {
        log('  ❌ New Policy 버튼이 여전히 비활성화됨');
      } else {
        log('  ✅ New Policy 버튼 활성화 — 클릭!');
        await newPolicyBtn.click();
        await page.waitForTimeout(4000);
        await ss(page, 'p5_new_policy_dialog');
        await dumpText(page, 'p5_new_policy_dialog_text');

        // 다이얼로그 입력 필드 분석
        const dialogInputs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }).map(el => ({
            tag: el.tagName,
            type: (el as HTMLInputElement).type ?? '',
            id: (el as HTMLInputElement).id ?? '',
            name: (el as HTMLInputElement).name ?? '',
            placeholder: (el as HTMLInputElement).placeholder ?? '',
            value: (el as HTMLInputElement).value ?? '',
            x: Math.round(el.getBoundingClientRect().x),
            y: Math.round(el.getBoundingClientRect().y),
            w: Math.round(el.getBoundingClientRect().width),
          }));
        });
        log(`  다이얼로그 입력 필드: ${dialogInputs.length}개`);
        for (const inp of dialogInputs) {
          log(`    [${inp.tag}.${inp.type}] id=${inp.id.slice(0, 40)} ph="${inp.placeholder}" val="${inp.value}" pos=(${inp.x},${inp.y}) w=${inp.w}`);
        }
      }
    } else {
      log('  ❌ New Policy 버튼 미발견');
    }

    // 7) "Edit" 클릭 (기존 기본 정책 편집)
    log('\n[7] Edit 클릭 (기존 기본 정책)...');
    const editLink = page.locator('a:has-text("Edit"), span:has-text("Edit")').first();
    if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await editLink.evaluate(el => {
        const style = window.getComputedStyle(el);
        return el.classList.contains('disabled') || style.opacity === '0.5' || style.pointerEvents === 'none';
      });

      if (isDisabled) {
        log('  ❌ Edit 버튼 비활성화됨');
      } else {
        log('  ✅ Edit 클릭!');
        await editLink.click();
        await page.waitForTimeout(4000);
        await ss(page, 'p5_edit_dialog');
        await dumpText(page, 'p5_edit_dialog_text');

        // 편집 다이얼로그 분석
        const editInputs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }).map(el => ({
            tag: el.tagName,
            type: (el as HTMLInputElement).type ?? '',
            id: (el as HTMLInputElement).id ?? '',
            placeholder: (el as HTMLInputElement).placeholder ?? '',
            value: (el as HTMLInputElement).value ?? '',
            x: Math.round(el.getBoundingClientRect().x),
            y: Math.round(el.getBoundingClientRect().y),
          }));
        });
        log(`  편집 다이얼로그 입력 필드: ${editInputs.length}개`);
        for (const inp of editInputs) {
          log(`    [${inp.tag}.${inp.type}] id=${inp.id.slice(0, 40)} ph="${inp.placeholder}" val="${inp.value}" pos=(${inp.x},${inp.y})`);
        }
      }
    } else {
      log('  ❌ Edit 링크 미발견');
    }

    log('\n' + '='.repeat(60));
    log('✅ Phase 5 완료');
    log('='.repeat(60));

  } catch (err) {
    log(`\n❌ 오류: ${String(err)}`);
    console.error(err);
  } finally {
    if (browser) {
      log('\n⏳ 브라우저 유지 (Ctrl+C 종료)');
      await new Promise(() => {});
    }
  }
}

main().catch(console.error);
