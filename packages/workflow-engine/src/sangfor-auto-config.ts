/**
 * Sangfor Auto Config — Sangfor 설정 자동화
 *
 * 핵심 기능:
 * 1. 감사항목 → 설정 시나리오 매핑
 * 2. Playwright CDP 기반 실장비 UI 자동 조작
 * 3. 해시 라우팅 / 메뉴 클릭 네비게이션
 * 4. 체크박스/셀렉트/입력/토글 등 다양한 UI 액션 실행
 * 5. 단계별 스크린샷 + 검증
 */

import { chromium, type Page, type Browser } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('sangfor-auto-config');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type ProductCode = 'EPP' | 'IAG' | 'CC';

export interface SangforConfig {
  product: ProductCode;
  feature: string;
  menuPath: string[];
  hashRoute?: string;
  settings: SettingAction[];
  prerequisites: string[];
  validation: {
    method: 'api' | 'webui' | 'manual';
    criteria: string[];
  };
}

/** 실행 가능한 설정 액션 */
export interface SettingAction {
  type: 'toggle' | 'select' | 'input' | 'checkbox' | 'click_button';
  label: string;
  value?: string | boolean;
  selector?: string;
  waitAfter?: number;
  screenshot?: boolean;
}

export interface ConfigResult {
  success: boolean;
  appliedSettings: Record<string, any>;
  screenshots: string[];
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface VerificationResult {
  verified: boolean;
  passedCriteria: string[];
  failedCriteria: string[];
  evidence: string[];
  screenshotPath?: string;
}

export interface DeviceCredentials {
  username: string;
  password: string;
  targetUrl: string;
}

// ─── 제품별 설정 시나리오 ────────────────────────────────────────────────────

const CONFIG_SCENARIOS: Record<string, SangforConfig> = {
  // ── EPP: 악성코드 보호 ──
  epp_malware_protection: {
    product: 'EPP',
    feature: 'Anti-Virus / Malware Protection',
    menuPath: ['Defense', 'Malware Scan'],
    hashRoute: '#/policy/antiMalware',
    settings: [
      { type: 'checkbox', label: '실시간 보호', value: true, selector: '[data-ref="realtimeCheck"]', waitAfter: 1000 },
      { type: 'select', label: '스캔 스케줄', value: '매일 오전 2시', selector: '[data-ref="scanSchedule"]', waitAfter: 500 },
      { type: 'select', label: '엔진 업데이트', value: '자동', selector: '[data-ref="engineUpdate"]', waitAfter: 500 },
      { type: 'checkbox', label: '격리 활성화', value: true, selector: '[data-ref="quarantine"]', waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['실시간 보호 활성화', '스캔 스케줄 설정', '엔진 업데이트 자동'] },
  },

  // ── EPP: 소프트웨어 제어 ──
  epp_app_control: {
    product: 'EPP',
    feature: 'Application Control',
    menuPath: ['Policies', 'App Control'],
    hashRoute: '#/policy/appControl',
    settings: [
      { type: 'checkbox', label: '비인가 소프트웨어 차단', value: true, waitAfter: 1000 },
      { type: 'checkbox', label: '화이트리스트 모드', value: true, waitAfter: 500 },
      { type: 'checkbox', label: '차단 로그 기록', value: true, waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['비인가 소프트웨어 차단', '화이트리스트 설정'] },
  },

  // ── EPP: 장치 제어 (USB 차단) ──
  epp_device_control: {
    product: 'EPP',
    feature: 'Device Control',
    menuPath: ['Policies', 'Behavior Control'],
    hashRoute: '#/policy/deviceControl',
    settings: [
      { type: 'checkbox', label: 'USB 저장 장치 차단', value: true, waitAfter: 1000 },
      { type: 'checkbox', label: 'CD/DVD 차단', value: true, waitAfter: 500 },
      { type: 'checkbox', label: '장치 접근 로그', value: true, waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['USB 차단', 'CD 차단', '장치 접근 로그'] },
  },

  // ── EPP: Syslog 설정 ──
  epp_syslog: {
    product: 'EPP',
    feature: 'Syslog Settings',
    menuPath: ['System', 'Data Sync', 'Syslog Reporting'],
    hashRoute: '#/system/dataSync',
    settings: [
      { type: 'checkbox', label: 'Syslog 활성화', value: true, waitAfter: 1000 },
      { type: 'input', label: 'Syslog 서버', value: '', waitAfter: 500 },
      { type: 'select', label: '프로토콜', value: 'UDP', waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['Syslog 활성화', '서버 설정'] },
  },

  // ── EPP: 보안 이벤트 ──
  epp_security_events: {
    product: 'EPP',
    feature: 'Security Events',
    menuPath: ['Detection and Response', 'Security Events'],
    hashRoute: '#/event',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['보안 이벤트 조회 가능'] },
  },

  // ── EPP: 에이전트 배포 ──
  epp_agent_deployment: {
    product: 'EPP',
    feature: 'Agent Deployment',
    menuPath: ['System', 'Agent Deployment'],
    hashRoute: '#/deployment',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['에이전트 배포 가능'] },
  },

  // ── IAG: URL 필터링 ──
  iag_url_filtering: {
    product: 'IAG',
    feature: 'URL Filtering',
    menuPath: ['Security', 'URL Filtering'],
    hashRoute: '#/policy/urlFilter',
    settings: [
      { type: 'checkbox', label: 'URL 필터링 활성화', value: true, waitAfter: 1000 },
      { type: 'checkbox', label: '악성 URL 차단', value: true, waitAfter: 500 },
      { type: 'checkbox', label: '로그 기록', value: true, waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['URL 필터링 활성화', '악성 URL 차단'] },
  },

  // ── IAG: DLP ──
  iag_dlp: {
    product: 'IAG',
    feature: 'Data Loss Prevention',
    menuPath: ['Activity Audit', 'DLP Policy'],
    hashRoute: '#/activityAudit/dlpPolicy',
    settings: [
      { type: 'checkbox', label: 'DLP 활성화', value: true, waitAfter: 1000 },
      { type: 'checkbox', label: '키워드 탐지', value: true, waitAfter: 500 },
      { type: 'checkbox', label: '파일 차단', value: true, waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['DLP 활성화', '키워드 탐지', '파일 차단'] },
  },

  // ── IAG: 접근 제어 ──
  iag_access_policy: {
    product: 'IAG',
    feature: 'Access Policy',
    menuPath: ['Online Activities', 'Access Policy'],
    hashRoute: '#/onlineActivities/accessPolicy',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['접근 제어 정책 확인'] },
  },

  // ── IAG: 인터넷 로그 ──
  iag_internet_logs: {
    product: 'IAG',
    feature: 'Internet Access Logs',
    menuPath: ['Logs', 'Internet Access'],
    hashRoute: '#/logs/internetAccess',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['인터넷 접근 로그 조회 가능'] },
  },

  // ── CC: 로그 관리 ──
  cc_log_management: {
    product: 'CC',
    feature: 'Log Management',
    menuPath: ['System', 'Log Settings'],
    hashRoute: '#/system/logSettings',
    settings: [
      { type: 'checkbox', label: '중앙 로그 수집', value: true, waitAfter: 1000 },
      { type: 'select', label: '로그 보존 기간', value: '365일', waitAfter: 500 },
      { type: 'checkbox', label: '알림 활성화', value: true, waitAfter: 500 },
    ],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['중앙 로그 수집', '로그 보존 1년', '알림 설정'] },
  },

  // ── CC: 탐지 로그 ──
  cc_detection_logs: {
    product: 'CC',
    feature: 'Detection Logs',
    menuPath: ['Detection', 'Logs'],
    hashRoute: '#/detection/logs',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['탐지 로그 조회 가능'] },
  },

  // ── CC: 위협 분석 ──
  cc_threats: {
    product: 'CC',
    feature: 'Threat Analysis',
    menuPath: ['Detection', 'Threats'],
    hashRoute: '#/detection/threats',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['위협 분석 조회 가능'] },
  },

  // ── CC: 대응 ──
  cc_response: {
    product: 'CC',
    feature: 'Response',
    menuPath: ['Response'],
    hashRoute: '#/response',
    settings: [],
    prerequisites: [],
    validation: { method: 'webui', criteria: ['대응 정책 확인'] },
  },
};

// ─── 감사항목 → 시나리오 매핑 테이블 ────────────────────────────────────────

const AUDIT_TO_SCENARIO: Record<string, string> = {
  'Malware Infection Prevention': 'epp_malware_protection',
  'Anti-Virus': 'epp_malware_protection',
  'Software Control': 'epp_app_control',
  'Application Control': 'epp_app_control',
  'Device Control': 'epp_device_control',
  'USB': 'epp_device_control',
  'USB Device Control': 'epp_device_control',
  'Storage Media': 'epp_device_control',
  'Log Settings': 'epp_syslog',
  'Syslog': 'epp_syslog',
  'Security Events': 'epp_security_events',
  'Agent Deployment': 'epp_agent_deployment',
  'Endpoint Inventory': 'epp_security_events',
  'URL Filtering': 'iag_url_filtering',
  'Network Access Control': 'iag_url_filtering',
  'Data Loss Prevention': 'iag_dlp',
  'DLP': 'iag_dlp',
  'Access Policy': 'iag_access_policy',
  'Internet Access Logs': 'iag_internet_logs',
  'Log Management': 'cc_log_management',
  'Security Monitoring': 'cc_log_management',
  'Detection Logs': 'cc_detection_logs',
  'Threat Analysis': 'cc_threats',
  'Response': 'cc_response',
};

// ─── Sangfor Auto Config ────────────────────────────────────────────────────

export class SangforAutoConfig {
  private browser: Browser | null = null;
  private cdpPort: number;
  private outputDir: string;

  constructor(options?: { cdpPort?: number; outputDir?: string }) {
    this.cdpPort = options?.cdpPort ?? 9333;
    this.outputDir = options?.outputDir ?? './outputs/auto-config';
  }

  // ── 시나리오 조회 ──

  findByAuditItem(auditItem: string): SangforConfig | null {
    for (const [key, scenarioId] of Object.entries(AUDIT_TO_SCENARIO)) {
      if (auditItem.includes(key)) {
        return CONFIG_SCENARIOS[scenarioId] ?? null;
      }
    }
    return null;
  }

  findByProduct(product: ProductCode): SangforConfig[] {
    return Object.values(CONFIG_SCENARIOS).filter(c => c.product === product);
  }

  findByFeature(feature: string): SangforConfig | null {
    const lower = feature.toLowerCase();
    return Object.values(CONFIG_SCENARIOS).find(c =>
      c.feature.toLowerCase().includes(lower),
    ) ?? null;
  }

  listScenarios(): Array<{ id: string; product: ProductCode; feature: string }> {
    return Object.entries(CONFIG_SCENARIOS).map(([id, cfg]) => ({
      id,
      product: cfg.product,
      feature: cfg.feature,
    }));
  }

  // ── 설정 적용 (핵심 실행 로직) ──

  async applyConfig(scenarioId: string, credentials: DeviceCredentials): Promise<ConfigResult> {
    const startTime = Date.now();
    const config = CONFIG_SCENARIOS[scenarioId];
    if (!config) {
      return {
        success: false,
        appliedSettings: {},
        screenshots: [],
        errors: [`시나리오 없음: ${scenarioId}`],
        warnings: [],
        duration: 0,
      };
    }

    log.info(`[${config.product}] 설정 적용 시작: ${config.feature}`);
    const screenshots: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const appliedSettings: Record<string, any> = {};

    let page: Page | null = null;

    try {
      // 1) Chrome CDP 연결
      page = await this.connectToDevice(credentials.targetUrl);
      log.info('Chrome CDP 연결 성공');

      // 2) 로그인 (이미 로그인된 경우 스킵)
      const isLoggedIn = !(page.url().includes('login') || page.url() === credentials.targetUrl + '/');
      if (!isLoggedIn) {
        await this.login(page, credentials);
        log.info('로그인 성공');
      } else {
        log.info('이미 로그인됨 — 스킵');
      }
      screenshots.push(await this.captureScreenshot(page, 'after_login'));

      // 3) 메뉴 이동
      if (config.hashRoute) {
        await this.navigateToHash(page, config.hashRoute);
        log.info(`해시 라우팅 이동: ${config.hashRoute}`);
      } else {
        await this.navigateToMenu(page, config.menuPath);
        log.info(`메뉴 클릭 이동: ${config.menuPath.join(' > ')}`);
      }
      await page.waitForTimeout(3000);
      screenshots.push(await this.captureScreenshot(page, 'menu_loaded'));

      // 4) 설정 액션 실행
      for (const action of config.settings) {
        try {
          await this.executeSettingAction(page, action);
          appliedSettings[action.label] = action.value;
          log.info(`  ✅ ${action.label} = ${action.value}`);
          if (action.screenshot) {
            screenshots.push(await this.captureScreenshot(page, `after_${action.label}`));
          }
        } catch (err) {
          const errorMsg = `설정 실패 [${action.label}]: ${String(err)}`;
          errors.push(errorMsg);
          log.error(errorMsg);
        }
      }

      // 5) 저장 버튼 클릭 (설정 액션이 있을 때만)
      if (config.settings.length > 0) {
        await this.clickSaveButton(page);
        await page.waitForTimeout(3000);
        screenshots.push(await this.captureScreenshot(page, 'after_save'));
        log.info('저장 완료');
      }

      // 6) 검증
      const verification = await this.verifyConfig(page, config);
      if (!verification.verified) {
        warnings.push(`검증 실패: ${verification.failedCriteria.join(', ')}`);
      }
      if (verification.screenshotPath) {
        screenshots.push(verification.screenshotPath);
      }

    } catch (err) {
      errors.push(`치명적 오류: ${String(err)}`);
      log.error(`설정 적용 실패: ${err}`);
    }

    const duration = Date.now() - startTime;
    log.info(`설정 적용 완료: ${config.feature} (${duration}ms, ${errors.length}개 오류)`);

    return {
      success: errors.length === 0,
      appliedSettings,
      screenshots,
      errors,
      warnings,
      duration,
    };
  }

  // ── 설정 검증 ──

  async verifyConfig(page: Page, config: SangforConfig): Promise<VerificationResult> {
    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const evidence: string[] = [];

    try {
      const pageText = await page.evaluate(() => document.body.innerText);

      for (const criterion of config.validation.criteria) {
        const found = this.checkCriterion(pageText, criterion);
        if (found) {
          passedCriteria.push(criterion);
          evidence.push(`✅ ${criterion}: 페이지에서 확인됨`);
        } else {
          failedCriteria.push(criterion);
          evidence.push(`❌ ${criterion}: 페이지에서 미확인`);
        }
      }
    } catch (err) {
      evidence.push(`검증 오류: ${String(err)}`);
    }

    const screenshotPath = await this.captureScreenshot(page, 'verification');

    return {
      verified: failedCriteria.length === 0,
      passedCriteria,
      failedCriteria,
      evidence,
      screenshotPath,
    };
  }

  // ── 감사항목 기반 일괄 적용 ──

  async applyFromAuditItems(
    auditItems: string[],
    credentials: DeviceCredentials,
  ): Promise<Array<{ item: string; result: ConfigResult }>> {
    const results: Array<{ item: string; result: ConfigResult }> = [];

    for (const item of auditItems) {
      const config = this.findByAuditItem(item);
      if (config) {
        const scenarioId = Object.keys(CONFIG_SCENARIOS).find(
          k => CONFIG_SCENARIOS[k] === config,
        );
        if (scenarioId) {
          const result = await this.applyConfig(scenarioId, credentials);
          results.push({ item, result });
        } else {
          results.push({
            item,
            result: { success: false, appliedSettings: {}, screenshots: [], errors: [`시나리오 ID 매핑 실패`], warnings: [], duration: 0 },
          });
        }
      } else {
        results.push({
          item,
          result: { success: false, appliedSettings: {}, screenshots: [], errors: [`매핑 없음: ${item}`], warnings: [], duration: 0 },
        });
      }
    }

    return results;
  }

  // ── 여러 시나리오 일괄 적용 ──

  async applyMultipleConfigs(
    scenarioIds: string[],
    credentials: DeviceCredentials,
  ): Promise<ConfigResult[]> {
    const results: ConfigResult[] = [];
    for (const id of scenarioIds) {
      results.push(await this.applyConfig(id, credentials));
    }
    return results;
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────────────

  private async connectToDevice(targetUrl: string): Promise<Page> {
    const cdpEndpoint = `http://127.0.0.1:${this.cdpPort}`;

    try {
      this.browser = await chromium.connectOverCDP(cdpEndpoint);
      const context = this.browser.contexts()[0];
      if (!context) throw new Error('브라우저 컨텍스트 없음');

      // 타겟 URL과 매칭되는 기존 탭 찾기
      const host = targetUrl.split('://')[1]?.split('/')[0] ?? '';
      const existingPage = context.pages().find(p => p.url().includes(host));
      if (existingPage) return existingPage;

      return context.pages()[0] ?? await context.newPage();
    } catch {
      throw new Error(
        `Chrome CDP 연결 실패: ${cdpEndpoint}\n` +
        `Chrome이 --remote-debugging-port=${this.cdpPort}로 실행 중인지 확인하세요.`,
      );
    }
  }

  private async login(page: Page, credentials: DeviceCredentials): Promise<void> {
    await page.goto(credentials.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);

    // CAPTCHA 감지
    const captchaImg = page.locator('img[src*="randcode"], img[src*="captcha"], img[src*="verify"]');
    if (await captchaImg.isVisible({ timeout: 2000 }).catch(() => false)) {
      const captchaPath = join(this.outputDir, 'captcha.png');
      mkdirSync(this.outputDir, { recursive: true });
      await captchaImg.screenshot({ path: captchaPath });
      throw new Error(`CAPTCHA 감지됨. 스크린샷: ${captchaPath} — 수동 입력 후 재시도하세요.`);
    }

    // 로그인 필드 채우기
    const userInput = page.locator(
      'input[name="user"], input[name="username"], input[name="account"], input[name="name"]',
    ).first();
    const passInput = page.locator('input[type="password"]').first();

    await userInput.fill(credentials.username);
    await passInput.fill(credentials.password);

    // 로그인 버튼 클릭
    const loginBtn = page.locator(
      'button:has-text("Log In"), button:has-text("로그인"), input[id="button"], button[type="submit"]',
    ).first();
    await loginBtn.click();
    await page.waitForTimeout(5000);

    if (page.url().includes('login') || page.url().includes('Login')) {
      throw new Error('로그인 실패 — 자격 증명을 확인하세요.');
    }
  }

  private async navigateToHash(page: Page, hashRoute: string): Promise<void> {
    const baseUrl = new URL(page.url()).origin;
    await page.goto(`${baseUrl}/${hashRoute}`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    }).catch(async () => {
      // goto 실패 시 해시 직접 변경
      await page.evaluate((hash: string) => { window.location.hash = hash; }, hashRoute);
      await page.waitForLoadState('networkidle');
    });
  }

  private async navigateToMenu(page: Page, menuPath: string[]): Promise<void> {
    for (const menuName of menuPath) {
      const clicked = await page.evaluate((text: string) => {
        const items = Array.from(document.querySelectorAll('a, span, div, button'));
        const item = items.find((el: Element) => {
          const t = el.textContent?.trim() ?? '';
          return t === text || t.includes(text);
        });
        if (item) { (item as HTMLElement).click(); return true; }
        return false;
      }, menuName);

      if (!clicked) {
        log.warn(`메뉴 미발견: ${menuName}`);
      }
      await page.waitForTimeout(2000);
    }
  }

  // ── 설정 액션 실행 ──

  private async executeSettingAction(page: Page, action: SettingAction): Promise<void> {
    switch (action.type) {
      case 'checkbox':
        await this.actionCheckbox(page, action);
        break;
      case 'select':
        await this.actionSelect(page, action);
        break;
      case 'input':
        await this.actionInput(page, action);
        break;
      case 'toggle':
        await this.actionToggle(page, action);
        break;
      case 'click_button':
        await this.actionClickButton(page, action);
        break;
    }
    if (action.waitAfter) await page.waitForTimeout(action.waitAfter);
  }

  private async actionCheckbox(page: Page, action: SettingAction): Promise<void> {
    const found = await page.evaluate((opts: { label: string; value: boolean; selector?: string }) => {
      // 셀렉터 우선
      if (opts.selector) {
        const el = document.querySelector(opts.selector) as HTMLInputElement | null;
        if (el) {
          if (el.checked !== opts.value) el.click();
          return true;
        }
      }
      // 라벨 기반 탐색
      const labels = Array.from(document.querySelectorAll('label, span, td, div'));
      const label = labels.find(l => (l.textContent?.trim() ?? '').includes(opts.label));
      if (label) {
        const cb = label.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (cb && cb.checked !== opts.value) cb.click();
        return !!cb;
      }
      return false;
    }, { label: action.label, value: action.value as boolean, selector: action.selector });

    if (!found) log.warn(`체크박스 미발견: ${action.label}`);
  }

  private async actionSelect(page: Page, action: SettingAction): Promise<void> {
    await page.evaluate((opts: { label: string; value: string }) => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        const opt = Array.from(sel.options).find(o => (o.textContent ?? '').includes(opts.value));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
    }, { label: action.label, value: action.value as string });
  }

  private async actionInput(page: Page, action: SettingAction): Promise<void> {
    await page.evaluate((opts: { label: string; value: string }) => {
      const labels = Array.from(document.querySelectorAll('label, span'));
      const label = labels.find(l => (l.textContent?.trim() ?? '').includes(opts.label));
      if (label) {
        const input = label.parentElement?.querySelector('input, textarea') as HTMLInputElement | null;
        if (input) {
          input.value = opts.value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }, { label: action.label, value: action.value as string });
  }

  private async actionToggle(page: Page, action: SettingAction): Promise<void> {
    await page.evaluate((label: string) => {
      const labels = Array.from(document.querySelectorAll('label, span'));
      const labelEl = labels.find(l => (l.textContent?.trim() ?? '').includes(label));
      if (labelEl) {
        const toggle = labelEl.parentElement?.querySelector(
          '.x-toggle, [role="switch"], .switch, input[type="checkbox"]',
        ) as HTMLElement | null;
        if (toggle) toggle.click();
      }
    }, action.label);
  }

  private async actionClickButton(page: Page, action: SettingAction): Promise<void> {
    await page.evaluate((label: string) => {
      const btns = Array.from(document.querySelectorAll('button, a[role="button"], input[type="button"]'));
      const btn = btns.find(b => (b.textContent?.trim() ?? '').includes(label));
      if (btn) (btn as HTMLElement).click();
    }, action.label);
  }

  private async clickSaveButton(page: Page): Promise<void> {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a[role="button"], input[type="button"]'));
      const saveBtn = btns.find(b => {
        const t = (b.textContent?.trim() ?? '').toLowerCase();
        return t.includes('save') || t.includes('저장') || t.includes('apply') || t.includes('적용');
      });
      if (saveBtn) { (saveBtn as HTMLElement).click(); return true; }
      return false;
    });

    if (!clicked) {
      log.warn('저장 버튼 미발견');
    }
  }

  private async captureScreenshot(page: Page, name: string): Promise<string> {
    mkdirSync(this.outputDir, { recursive: true });
    const path = join(this.outputDir, `${name}_${Date.now()}.png`);
    await page.screenshot({ path, fullPage: false });
    return path;
  }

  private checkCriterion(pageText: string, criterion: string): boolean {
    const normalized = pageText.toLowerCase().replace(/\s+/g, ' ');
    return normalized.includes(criterion.toLowerCase().replace(/\s+/g, ' '));
  }
}
