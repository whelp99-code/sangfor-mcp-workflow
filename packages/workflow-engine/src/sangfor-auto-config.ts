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

import { chromium, type Page, type Browser, type ElementHandle } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type {
  AdapterBoundary,
  UIActionConstraint,
  OperationStep,
  StepResult,
} from './types.js';
import type { DeviceCredentials } from './device-verifier.js';

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
  private currentPage: Page | null = null;       // [FIX #3] CDP 연결 재사용
  private cdpPort: number;
  private outputDir: string;
  private configToId: Map<SangforConfig, string>; // [FIX #9] 역방향 맵

  constructor(options?: { cdpPort?: number; outputDir?: string }) {
    this.cdpPort = options?.cdpPort ?? 9333;
    this.outputDir = options?.outputDir ?? './outputs/auto-config';
    // [FIX #9] 역방향 맵 사전 구축
    this.configToId = new Map(
      Object.entries(CONFIG_SCENARIOS).map(([id, cfg]) => [cfg, id]),
    );
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
      const hasLoginForm = await this.hasInteractiveLoginForm(page);  // [FIX #5]
      if (hasLoginForm) {
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

      // 5) 저장 버튼 클릭 (성공한 설정이 있을 때만) [FIX #6]
      if (Object.keys(appliedSettings).length > 0) {
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
    // [REDTEAM] finally 블록 제거 — 연결 재사용 패턴이므로 close하지 않음
    // applyFromAuditItems/applyMultipleConfigs에서 close() 호출

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

    try {
      for (const item of auditItems) {
        const config = this.findByAuditItem(item);
        if (config) {
          const scenarioId = this.configToId.get(config);  // [FIX #9] 역방향 맵 사용
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
    } finally {
      // [FIX #3] 루프 종료 후 CDP 연결 정리
      await this.close();
    }

    return results;
  }

  // ── 여러 시나리오 일괄 적용 ──

  async applyMultipleConfigs(
    scenarioIds: string[],
    credentials: DeviceCredentials,
  ): Promise<ConfigResult[]> {
    const results: ConfigResult[] = [];
    try {
      for (const id of scenarioIds) {
        results.push(await this.applyConfig(id, credentials));
      }
    } finally {
      // [FIX #3] 루프 종료 후 CDP 연결 정리
      await this.close();
    }
    return results;
  }

  // ── CDP 연결 해제 [FIX #3] ──

  async close(): Promise<void> {
    if (this.browser?.isConnected()) {
      await this.browser.close().catch(() => {});
    }
    this.browser = null;
    this.currentPage = null;
  }

  // ─── PR-25: Adapter Boundary 실행 ────────────────────────────────────────

  /**
   * AdapterBoundary를 적용하여 step 실행
   * - UI adapter: selector 필수 검증, idempotency 확인
   * - dry-run 기본값 적용
   */
  async executeWithBoundary(
    step: OperationStep,
    boundary: AdapterBoundary,
    credentials?: DeviceCredentials,
  ): Promise<StepResult> {
    const startTime = Date.now();

    // boundary 제약 검증
    if (boundary.adapterType === 'ui' && boundary.constraints.selectorRequired) {
      const hasSelector = step.input['selector'] !== undefined
        && step.input['selector'] !== null
        && String(step.input['selector']).length > 0;
      if (!hasSelector) {
        return {
          stepId: step.id,
          success: false,
          output: {},
          errors: ['UI adapter requires selector but none provided'],
          duration: Date.now() - startTime,
          dryRun: false,
        };
      }
    }

    // 지원되는 action인지 확인
    if (boundary.supportedActions.length > 0) {
      const actionType = String(step.input['actionType'] ?? step.action);
      if (!boundary.supportedActions.includes(actionType)) {
        return {
          stepId: step.id,
          success: false,
          output: {},
          errors: [`Action not supported by adapter: ${actionType} (supported: ${boundary.supportedActions.join(', ')})`],
          duration: Date.now() - startTime,
          dryRun: false,
        };
      }
    }

    // dry-run은 승인 여부와 독립적으로 판단: 기본 true, 명시적으로 false일 때만 실실행
    const isDryRun = step.input['dryRun'] !== false;
    const executionApproved = step.input['executionApproved'] === true;

    if (isDryRun) {
      log.info(`[DRY-RUN] Step ${step.id}: ${step.title} — 실행 생략`);
      return {
        stepId: step.id,
        success: true,
        output: { dryRun: true, simulated: step.capability },
        errors: [],
        duration: Date.now() - startTime,
        dryRun: true,
      };
    }
    if (!executionApproved) {
      return {
        stepId: step.id,
        success: false,
        output: {},
        errors: ['Execution blocked: explicit approved execution context required'],
        duration: Date.now() - startTime,
        dryRun: false,
      };
    }

    // 실제 실행
    try {
      if (boundary.adapterType === 'ui' && credentials) {
        const result = await this.executeConfigStep(step, credentials, false);
        return {
          stepId: step.id,
          success: result.success,
          output: result.appliedSettings as Record<string, unknown>,
          errors: result.errors,
          duration: result.duration,
          dryRun: false,
        };
      }

      // api, ssh 등 다른 adapter 타입은 현재 UI 방식으로 fallback
      log.warn(`Adapter 타입 '${boundary.adapterType}' 미구현 — UI adapter로 fallback`);
      if (credentials) {
        const result = await this.executeConfigStep(step, credentials, false);
        return {
          stepId: step.id,
          success: result.success,
          output: result.appliedSettings as Record<string, unknown>,
          errors: result.errors,
          duration: result.duration,
          dryRun: false,
        };
      }

      return {
        stepId: step.id,
        success: false,
        output: {},
        errors: ['Credentials required for execution'],
        duration: Date.now() - startTime,
        dryRun: false,
      };
    } catch (err) {
      return {
        stepId: step.id,
        success: false,
        output: {},
        errors: [`Execution error: ${String(err)}`],
        duration: Date.now() - startTime,
        dryRun: false,
      };
    }
  }

  /**
   * OperationStep을 기반으로 설정 실행 (dryRun 파라미터 지원)
   * 저장 버튼은 성공한 변경이 있을 때만 수행
   */
  async executeConfigStep(
    step: OperationStep,
    credentials: DeviceCredentials,
    dryRun: boolean = true,
  ): Promise<ConfigResult> {
    const startTime = Date.now();
    const screenshots: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const appliedSettings: Record<string, unknown> = {};

    if (dryRun) {
      log.info(`[DRY-RUN] ConfigStep ${step.id}: ${step.title} — 설정 변경 생략`);
      return {
        success: true,
        appliedSettings: { dryRun: true, stepName: step.title },
        screenshots: [],
        errors: [],
        warnings: ['dry-run 모드 — 실제 변경 없음'],
        duration: Date.now() - startTime,
      };
    }

    let page: Page | null = null;
    try {
      page = await this.connectToDevice(credentials.targetUrl);

      const hasLoginForm = await this.hasInteractiveLoginForm(page);
      if (hasLoginForm) {
        await this.login(page, credentials);
      }

      // 해시 라우팅이 있으면 이동
      const hashRoute = step.input['hashRoute'] as string | undefined;
      if (hashRoute) {
        await this.navigateToHash(page, hashRoute);
      }

      // 설정 액션 실행
      const actions = step.input['actions'] as unknown as SettingAction[] | undefined;
      if (actions && Array.isArray(actions)) {
        for (const action of actions) {
          try {
            await this.executeSettingAction(page, action);
            appliedSettings[action.label] = action.value;
            log.info(`  ✅ ${action.label} = ${action.value}`);
          } catch (err) {
            const errorMsg = `설정 실패 [${action.label}]: ${String(err)}`;
            errors.push(errorMsg);
            log.error(errorMsg);
          }
        }
      }

      // 저장 버튼은 성공한 변경이 있을 때만 수행
      if (Object.keys(appliedSettings).length > 0) {
        await this.clickSaveButton(page);
        await page.waitForTimeout(3000);
        screenshots.push(await this.captureScreenshot(page, 'after_save'));
      } else {
        log.info('적용된 설정 없음 — 저장 버튼 클릭 생략');
      }
    } catch (err) {
      errors.push(`실행 오류: ${String(err)}`);
    } finally {
      // 단일 step 실행 경로는 기본적으로 연결을 정리해 누수를 방지한다.
      const keepSession = step.input['reuseSession'] === true;
      if (!keepSession) {
        await this.close();
      }
    }

    return {
      success: errors.length === 0,
      appliedSettings,
      screenshots,
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────────────

  /**
   * [FIX #3] CDP 연결 재사용 — 기존 연결이 유효하면 재사용, 없으면 새로 연결
   */
  private async connectToDevice(targetUrl: string): Promise<Page> {
    // 기존 연결 재사용
    if (this.browser?.isConnected() && this.currentPage && !this.currentPage.isClosed()) {
      return this.currentPage;
    }

    const cdpEndpoint = `http://127.0.0.1:${this.cdpPort}`;

    try {
      this.browser = await chromium.connectOverCDP(cdpEndpoint);
      const context = this.browser.contexts()[0];
      if (!context) throw new Error('브라우저 컨텍스트 없음');

      // 타겟 URL과 매칭되는 기존 탭 찾기
      const host = targetUrl.split('://')[1]?.split('/')[0] ?? '';
      const existingPage = context.pages().find(p => p.url().includes(host));
      this.currentPage = existingPage ?? context.pages()[0] ?? await context.newPage();
      return this.currentPage;
    } catch {
      this.browser = null;
      this.currentPage = null;
      throw new Error(
        `Chrome CDP 연결 실패: ${cdpEndpoint}\n` +
        `Chrome이 --remote-debugging-port=${this.cdpPort}로 실행 중인지 확인하세요.`,
      );
    }
  }

  private async login(page: Page, credentials: DeviceCredentials): Promise<void> {
    await page.goto(credentials.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);

    // [FIX #4] CAPTCHA 감지 — waitFor로 대기 의도 살리기
    const captchaLocator = page.locator('img[src*="randcode"], img[src*="captcha"], img[src*="verify"]');
    await captchaLocator.waitFor({ state: 'visible', timeout: 2000 }).catch((err) => {
      // [REDTEAM] TimeoutError만 무시, 다른 에러는 전파
      if (String(err).includes('Timeout') || String(err).includes('timeout')) return;
      throw err;
    });
    if (await captchaLocator.count() > 0 && await captchaLocator.isVisible()) {
      const captchaPath = join(this.outputDir, 'captcha.png');
      mkdirSync(this.outputDir, { recursive: true });
      await captchaLocator.first().screenshot({ path: captchaPath });
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

    // [FIX #5] 로그인 감지 — 실제 로그인 폼이 계속 보이는 경우만 실패 처리
    if (await this.hasInteractiveLoginForm(page)) {
      throw new Error('로그인 실패 — 자격 증명을 확인하세요.');
    }
  }

  private async hasInteractiveLoginForm(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const visible = (el: Element | null): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const passwordInputs = Array.from(document.querySelectorAll<HTMLInputElement>(
        'input[type="password"]:not([disabled]):not([readonly])',
      )).filter(visible);

      return passwordInputs.some((passwordInput) => {
        const container = passwordInput.closest('form, .login, .login-form, .x-window, .x-panel, .x-form, table, body');
        const scope = container ?? document.body;
        const hasUserInput = Array.from(scope.querySelectorAll<HTMLInputElement>(
          'input[name*="user" i], input[name*="account" i], input[name*="login" i], input[name*="name" i], input[type="text"]',
        )).some(visible);
        const hasSubmitControl = Array.from(scope.querySelectorAll<HTMLElement>(
          'button, input[type="submit"], input[type="button"], a[role="button"], .x-btn, [role="button"]',
        )).some((el) => {
          if (!visible(el)) return false;
          const text = `${el.textContent ?? ''} ${(el as HTMLInputElement).value ?? ''}`.trim().toLowerCase();
          return /log\s*in|login|sign\s*in|로그인|登录|登錄/.test(text) || el.getAttribute('type') === 'submit';
        });
        const formLooksLikeLogin = container instanceof HTMLFormElement
          && /login|auth|session/i.test(`${container.id} ${container.className} ${container.getAttribute('action') ?? ''}`);

        return hasUserInput && (hasSubmitControl || formLooksLikeLogin);
      });
    });
  }

  private async navigateToHash(page: Page, hashRoute: string): Promise<void> {
    const currentUrl = page.url();
    const cleanHash = hashRoute.startsWith('#') ? hashRoute.slice(1) : hashRoute;
    let baseUrl: string;

    try {
      // [FIX #7] about:blank는 예외를 던지지 않음 — origin이 "null" 문자열 반환
      const origin = new URL(currentUrl).origin;
      if (!currentUrl || currentUrl === 'about:blank' || origin === 'null') {
        // [REDTEAM] about:blank/data: 등 비정상 URL → 직접 goto 시도
        log.warn(`비정상 URL 상태: ${currentUrl}, 직접 이동 시도`);
        await page.goto(`/#${cleanHash}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});
        return;
      }
      baseUrl = origin;
    } catch {
      log.warn(`URL 파싱 실패: ${currentUrl}, 직접 이동 시도`);
      await page.goto(`/#${cleanHash}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});
      return;
    }

    await page.goto(`${baseUrl}/#${cleanHash}`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    }).catch(async () => {
      await page.evaluate((hash: string) => { window.location.hash = hash; }, cleanHash);
      await page.waitForLoadState('networkidle').catch(() => {});
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

  /**
   * [FIX #2] actionSelect — label 파라미터 사용 + selector 우선 + ExtJS 폴백
   */
  private async actionSelect(page: Page, action: SettingAction): Promise<void> {
    // 1) selector가 있으면 Playwright locator로 시도
    if (action.selector) {
      const loc = page.locator(action.selector);
      if (await loc.count() > 0) {
        await loc.selectOption({ label: action.value as string }).catch(async () => {
          await loc.selectOption({ value: action.value as string });
        });
        return;
      }
    }

    // 2) label 기반 native <select> 탐색
    const found = await page.evaluate((opts: { label: string; value: string }) => {
      let targetSelect: HTMLSelectElement | null = null;

      // label 기반: 해당 select 찾기
      const labels = Array.from(document.querySelectorAll('label, span, td, div'));
      const labelEl = labels.find(l => (l.textContent?.trim() ?? '').includes(opts.label));
      if (labelEl) {
        targetSelect = labelEl.parentElement?.querySelector('select') as HTMLSelectElement | null
          ?? labelEl.closest('tr')?.querySelector('select') as HTMLSelectElement | null
          ?? labelEl.closest('form')?.querySelector('select') as HTMLSelectElement | null;
      }

      // 전체 select 순회 (label 매칭 실패 시 폴백)
      if (!targetSelect) {
        const selects = Array.from(document.querySelectorAll('select'));
        targetSelect = selects[0];
      }

      if (!targetSelect) return false;

      const opt = Array.from(targetSelect.options).find(o =>
        (o.textContent ?? '').includes(opts.value) || o.value === opts.value,
      );
      if (opt) {
        targetSelect.value = opt.value;
        targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, { label: action.label, value: action.value as string });

    if (!found) {
      // 3) ExtJS 커스텀 드롭다운 폴백
      const extJsFound = await page.evaluate((opts: { label: string; value: string }) => {
        const visible = (el: Element | null): el is HTMLElement => {
          if (!(el instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const findLabelElement = () => Array.from(document.querySelectorAll('label, span, td, div'))
          .find(el => (el.textContent?.trim() ?? '').includes(opts.label));

        const labelEl = findLabelElement();
        if (labelEl) {
          const scope = labelEl.closest('tr, .x-form-item, .x-field, .form-group, .field, .x-container')
            ?? labelEl.parentElement;
          const triggers = Array.from(scope?.querySelectorAll<HTMLElement>(
            '.x-form-arrow-trigger, .x-form-trigger, .x-combo, [role="combobox"], input[readonly]',
          ) ?? []).filter(visible);
          for (const trigger of triggers) {
            trigger.click();
          }
        }

        const comboLists = Array.from(document.querySelectorAll('.x-combo-list, .x-boundlist, [role="listbox"]'));
        for (const list of comboLists.filter(visible)) {
          const items = Array.from(list.querySelectorAll('.x-combo-list-item, .x-boundlist-item, [role="option"]'));
          for (const item of items) {
            if ((item.textContent ?? '').includes(opts.value)) {
              (item as HTMLElement).click();
              return true;
            }
          }
        }
        return false;
      }, { label: action.label, value: action.value as string });

      if (!extJsFound) log.warn(`셀렉트 미발견 또는 옵션 없음: ${action.label} = ${action.value}`);
    }
  }

  /**
   * [FIX #8] React SPA 대응 — Playwright fill() 사용 + ElementHandle 직접 사용
   */
  private async actionInput(page: Page, action: SettingAction): Promise<void> {
    // 1) selector가 있으면 Playwright locator fill 사용
    if (action.selector) {
      const locator = page.locator(action.selector);
      if (await locator.count() > 0) {
        await locator.fill(action.value as string).catch(async () => {
          await this.fillExtJsInput(page, action.label, action.value as string, action.selector);
        });
        return;
      }
    }

    // 2) 라벨 기반: ElementHandle으로 input 찾기 → fill
    const inputHandle = await page.evaluateHandle((label: string) => {
      const labels = Array.from(document.querySelectorAll('label, span, td, div'));
      const labelEl = labels.find(l => (l.textContent?.trim() ?? '').includes(label));
      if (labelEl) {
        const forAttr = labelEl.getAttribute('for');
        if (forAttr) return document.getElementById(forAttr);
        return labelEl.parentElement?.querySelector('input, textarea');
      }
      return null;
    }, action.label);

    const element = inputHandle.asElement();
    if (element) {
      await (element as ElementHandle<HTMLInputElement>).fill(action.value as string).catch(async () => {
        await this.fillExtJsInput(page, action.label, action.value as string);
      });
      await element.dispose();
    } else {
      const filled = await this.fillExtJsInput(page, action.label, action.value as string);
      if (!filled) log.warn(`입력 필드 미발견: ${action.label}`);
    }
  }

  private async fillExtJsInput(
    page: Page,
    label: string,
    value: string,
    selector?: string,
  ): Promise<boolean> {
    return page.evaluate((opts: { label: string; value: string; selector?: string }) => {
      const visible = (el: Element | null): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      const candidates: HTMLElement[] = [];
      if (opts.selector) {
        const selected = document.querySelector<HTMLElement>(opts.selector);
        if (selected) candidates.push(selected);
      }

      const labelEl = Array.from(document.querySelectorAll('label, span, td, div'))
        .find(el => (el.textContent?.trim() ?? '').includes(opts.label));
      if (labelEl) {
        const scope = labelEl.closest('tr, .x-form-item, .x-field, .form-group, .field, .x-container')
          ?? labelEl.parentElement;
        candidates.push(...Array.from(scope?.querySelectorAll<HTMLElement>(
          'input, textarea, [contenteditable="true"], .x-form-field',
        ) ?? []));
      }

      const target = candidates.find(visible);
      if (!target) return false;

      target.focus();
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.value = opts.value;
      } else {
        target.textContent = opts.value;
      }
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: opts.value }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.blur();
      return true;
    }, { label, value, selector });
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

  /**
   * [FIX #10] path 변수명 충돌 해결 — filePath 사용
   */
  private async captureScreenshot(page: Page, name: string): Promise<string> {
    mkdirSync(this.outputDir, { recursive: true });
    const filePath = join(this.outputDir, `${name}_${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
  }

  private checkCriterion(pageText: string, criterion: string): boolean {
    const normalized = pageText.toLowerCase().replace(/\s+/g, ' ');
    return normalized.includes(criterion.toLowerCase().replace(/\s+/g, ' '));
  }
}
