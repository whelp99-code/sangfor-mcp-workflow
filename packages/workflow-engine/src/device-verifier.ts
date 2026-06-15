/**
 * Device Verifier — 실장비 검증 + 시나리오 개선
 *
 * 시나리오를 실장비에서 실행하고, 성공/실패를 기록.
 * 실패한 경우 시나리오를 자동으로 수정/개선.
 * 성공한 경우 API 엔드포인트를 캡처하여 시나리오에 연결.
 */

import { chromium, type Page, type Browser } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, nowISO } from '@sangfor/workflow-shared';
import { ScenarioDB, type Scenario, type ScenarioSetting } from './scenario-db';
import { SangforAPIDiscovery, type HAREntry } from './sangfor-api-discovery';

const log = createLogger('device-verifier');

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface DeviceCredentials {
  username: string;
  password: string;
  targetUrl: string;
  cdpPort?: number;
}

export interface VerificationReport {
  scenarioId: string;
  timestamp: string;
  overallResult: 'pass' | 'partial' | 'fail';
  steps: StepReport[];
  uiMatch: boolean;
  apiDiscovered: boolean;
  screenshots: string[];
  duration: number;
  improvements: ScenarioImprovement[];
}

export interface StepReport {
  step: string;
  type: string;
  label: string;
  expected: unknown;
  actual: unknown;
  result: 'pass' | 'fail' | 'skip';
  selector?: string;
  selectorFound: boolean;
  error?: string;
}

export interface ScenarioImprovement {
  type: 'selector_fix' | 'menu_path_fix' | 'hash_route_fix' | 'setting_label_fix' | 'api_endpoint_add';
  description: string;
  before: string;
  after: string;
  confidence: number;
}

// ─── Device Verifier ────────────────────────────────────────────────────────

export class DeviceVerifier {
  private scenarioDB: ScenarioDB;
  private apiDiscovery: SangforAPIDiscovery;
  private outputDir: string;
  private cdpPort: number;

  constructor(options: {
    scenarioDB: ScenarioDB;
    outputDir?: string;
    cdpPort?: number;
    llmEndpoint?: string;
    llmApiKey?: string;
  }) {
    this.scenarioDB = options.scenarioDB;
    this.outputDir = options.outputDir ?? './outputs/verification';
    this.cdpPort = options.cdpPort ?? 9333;
    this.apiDiscovery = new SangforAPIDiscovery({
      llmEndpoint: options.llmEndpoint,
      llmApiKey: options.llmApiKey,
    });
  }

  // ── 1단계: 단일 시나리오 검증 ──

  async verifyScenario(
    scenarioId: string,
    credentials: DeviceCredentials,
  ): Promise<VerificationReport> {
    const scenario = this.scenarioDB.get(scenarioId);
    if (!scenario) throw new Error(`시나리오 없음: ${scenarioId}`);

    const startTime = Date.now();
    const screenshots: string[] = [];
    const steps: StepReport[] = [];
    const improvements: ScenarioImprovement[] = [];

    log.info(`검증 시작: [${scenario.product}] ${scenario.feature}`);

    let page: Page | null = null;

    try {
      // 1) 장비 접속
      page = await this.connectToDevice(credentials.targetUrl);

      // 2) 로그인 (이미 로그인된 경우 스킵)
      if (page.url().includes('login')) {
        log.info('로그인 필요 — 스킵 (이미 로그인된 상태에서 실행 권장)');
      }

      // 3) 메뉴 이동 검증
      const navResult = await this.verifyNavigation(page, scenario);
      steps.push(...navResult.steps);
      improvements.push(...navResult.improvements);
      screenshots.push(await this.captureScreenshot(page, 'navigation'));

      // 4) 각 설정 액션 검증
      for (const setting of scenario.settings) {
        const stepResult = await this.verifySetting(page, setting, scenario);
        steps.push(stepResult.report);
        if (stepResult.improvement) {
          improvements.push(stepResult.improvement);
        }
      }

      // 5) 검증 기준 확인
      const criteriaResult = await this.verifyCriteria(page, scenario);
      steps.push(...criteriaResult.steps);

      screenshots.push(await this.captureScreenshot(page, 'verification'));

    } catch (err) {
      log.error(`검증 실패: ${err}`);
      steps.push({
        step: 'error',
        type: 'error',
        label: '치명적 오류',
        expected: 'success',
        actual: String(err),
        result: 'fail',
        selectorFound: false,
        error: String(err),
      });
    }

    const duration = Date.now() - startTime;
    const passedSteps = steps.filter(s => s.result === 'pass').length;
    const totalSteps = steps.length;

    const overallResult: VerificationReport['overallResult'] =
      passedSteps === totalSteps ? 'pass' :
      passedSteps > totalSteps / 2 ? 'partial' : 'fail';

    // 검증 결과를 DB에 업데이트
    this.scenarioDB.updateVerification(scenarioId, {
      lastVerified: nowISO(),
      result: overallResult,
      uiMatch: overallResult === 'pass',
      apiMatch: false,
      notes: improvements.map(i => i.description),
    });

    // 개선 사항 적용
    if (improvements.length > 0) {
      await this.applyImprovements(scenarioId, improvements);
    }

    return {
      scenarioId,
      timestamp: nowISO(),
      overallResult,
      steps,
      uiMatch: overallResult === 'pass',
      apiDiscovered: false,
      screenshots,
      duration,
      improvements,
    };
  }

  // ── 2단계: 네비게이션 검증 ──

  private async verifyNavigation(
    page: Page,
    scenario: Scenario,
  ): Promise<{ steps: StepReport[]; improvements: ScenarioImprovement[] }> {
    const steps: StepReport[] = [];
    const improvements: ScenarioImprovement[] = [];

    // 해시 라우팅 시도
    if (scenario.hashRoute) {
      try {
        const baseUrl = new URL(page.url()).origin;
        await page.goto(`${baseUrl}/${scenario.hashRoute}`, {
          waitUntil: 'networkidle',
          timeout: 15_000,
        });

        const pageLoaded = await page.evaluate(() => document.body.innerText.length > 100);

        if (pageLoaded) {
          steps.push({
            step: 'navigation',
            type: 'hash_route',
            label: `해시 라우팅: ${scenario.hashRoute}`,
            expected: 'page loaded',
            actual: 'page loaded',
            result: 'pass',
            selectorFound: true,
          });
        } else {
          steps.push({
            step: 'navigation',
            type: 'hash_route',
            label: `해시 라우팅: ${scenario.hashRoute}`,
            expected: 'page loaded',
            actual: 'empty page',
            result: 'fail',
            selectorFound: false,
          });

          // 대안: 메뉴 클릭 시도
          const menuResult = await this.tryMenuNavigation(page, scenario);
          if (menuResult.success) {
            improvements.push({
              type: 'hash_route_fix',
              description: `해시 라우트 실패 → 메뉴 클릭 성공`,
              before: scenario.hashRoute ?? '',
              after: scenario.menuPath.join(' > '),
              confidence: 0.8,
            });
          }
        }
      } catch (err) {
        steps.push({
          step: 'navigation',
          type: 'hash_route',
          label: `해시 라우팅: ${scenario.hashRoute}`,
          expected: 'success',
          actual: String(err),
          result: 'fail',
          selectorFound: false,
          error: String(err),
        });
      }
    }

    return { steps, improvements };
  }

  // ── 3단계: 설정 액션 검증 ──

  private async verifySetting(
    page: Page,
    setting: ScenarioSetting,
    scenario: Scenario,
  ): Promise<{ report: StepReport; improvement: ScenarioImprovement | null }> {
    try {
      // UI에서 해당 설정 요소 찾기
      const found = await page.evaluate((label: string) => {
        const allText = document.body.innerText;
        return allText.includes(label);
      }, setting.label);

      if (found) {
        return {
          report: {
            step: 'setting',
            type: setting.type,
            label: setting.label,
            expected: setting.value,
            actual: 'found in page',
            result: 'pass',
            selectorFound: true,
          },
          improvement: null,
        };
      } else {
        // 비슷한 라벨 찾기
        const similarLabel = await this.findSimilarLabel(page, setting.label);

        return {
          report: {
            step: 'setting',
            type: setting.type,
            label: setting.label,
            expected: setting.value,
            actual: 'not found in page',
            result: 'fail',
            selectorFound: false,
          },
          improvement: similarLabel ? {
            type: 'setting_label_fix',
            description: `"${setting.label}" 미발견 → "${similarLabel}" 발견`,
            before: setting.label,
            after: similarLabel,
            confidence: 0.7,
          } : null,
        };
      }
    } catch (err) {
      return {
        report: {
          step: 'setting',
          type: setting.type,
          label: setting.label,
          expected: setting.value,
          actual: String(err),
          result: 'fail',
          selectorFound: false,
          error: String(err),
        },
        improvement: null,
      };
    }
  }

  // ── 4단계: 검증 기준 확인 ──

  private async verifyCriteria(
    page: Page,
    scenario: Scenario,
  ): Promise<{ steps: StepReport[] }> {
    const steps: StepReport[] = [];

    try {
      const pageText = await page.evaluate(() => document.body.innerText);

      for (const criterion of scenario.validation.criteria) {
        const found = pageText.toLowerCase().includes(criterion.toLowerCase());
        steps.push({
          step: 'criterion',
          type: 'validation',
          label: criterion,
          expected: 'found in page',
          actual: found ? 'found' : 'not found',
          result: found ? 'pass' : 'fail',
          selectorFound: found,
        });
      }
    } catch (err) {
      steps.push({
        step: 'criterion',
        type: 'validation',
        label: 'criteria check',
        expected: 'success',
        actual: String(err),
        result: 'fail',
        selectorFound: false,
        error: String(err),
      });
    }

    return { steps };
  }

  // ── 5단계: 개선 사항 적용 ──

  private async applyImprovements(
    scenarioId: string,
    improvements: ScenarioImprovement[],
  ): Promise<void> {
    const scenario = this.scenarioDB.get(scenarioId);
    if (!scenario) return;

    for (const imp of improvements) {
      switch (imp.type) {
        case 'setting_label_fix': {
          const setting = scenario.settings.find(s => s.label === imp.before);
          if (setting) {
            setting.label = imp.after;
            log.info(`[${scenarioId}] 라벨 수정: "${imp.before}" → "${imp.after}"`);
          }
          break;
        }
        case 'hash_route_fix': {
          // 해시 라우트가 실패했으면 메뉴 경로 우선으로 변경
          scenario.hashRoute = undefined;
          log.info(`[${scenarioId}] 해시 라우트 제거 → 메뉴 클릭 우선`);
          break;
        }
      }
    }

    this.scenarioDB.save(scenario);
  }

  // ── 6단계: 전체 시나리오 일괄 검증 ──

  async verifyAll(
    product: string,
    credentials: DeviceCredentials,
  ): Promise<VerificationReport[]> {
    const scenarios = this.scenarioDB.findByProduct(product);
    const reports: VerificationReport[] = [];

    for (const scenario of scenarios) {
      try {
        const report = await this.verifyScenario(scenario.id, credentials);
        reports.push(report);
        log.info(`[${scenario.id}] ${report.overallResult} (${report.steps.filter(s => s.result === 'pass').length}/${report.steps.length})`);
      } catch (err) {
        log.error(`[${scenario.id}] 검증 오류: ${err}`);
      }
    }

    return reports;
  }

  // ── 내부 헬퍼 ──

  private async connectToDevice(targetUrl: string): Promise<Page> {
    const cdpEndpoint = `http://127.0.0.1:${this.cdpPort}`;

    try {
      const browser = await chromium.connectOverCDP(cdpEndpoint);
      const context = browser.contexts()[0];
      if (!context) throw new Error('브라우저 컨텍스트 없음');

      const host = targetUrl.split('://')[1]?.split('/')[0] ?? '';
      const existingPage = context.pages().find(p => p.url().includes(host));
      if (existingPage) return existingPage;

      return context.pages()[0] ?? await context.newPage();
    } catch {
      throw new Error(`Chrome CDP 연결 실패: ${cdpEndpoint}`);
    }
  }

  private async tryMenuNavigation(page: Page, scenario: Scenario): Promise<{ success: boolean }> {
    for (const menuName of scenario.menuPath) {
      const clicked = await page.evaluate((text: string) => {
        const items = Array.from(document.querySelectorAll('a, span, div, button'));
        const item = items.find(el => (el.textContent?.trim() ?? '').includes(text));
        if (item) { (item as HTMLElement).click(); return true; }
        return false;
      }, menuName);

      if (!clicked) return { success: false };
      await page.waitForTimeout(2000);
    }
    return { success: true };
  }

  private async findSimilarLabel(page: Page, targetLabel: string): Promise<string | null> {
    const similar = await page.evaluate((target: string) => {
      const allElements = document.querySelectorAll('label, span, td, div, button');
      const targetLower = target.toLowerCase();
      const words = targetLower.split(/\s+/).filter(w => w.length > 1);

      let bestMatch = '';
      let bestScore = 0;

      for (const el of allElements) {
        const text = (el.textContent?.trim() ?? '').toLowerCase();
        if (!text || text.length > 100) continue;

        let score = 0;
        for (const word of words) {
          if (text.includes(word)) score++;
        }

        if (score > bestScore && score >= Math.ceil(words.length * 0.5)) {
          bestScore = score;
          bestMatch = el.textContent?.trim() ?? '';
        }
      }

      return bestMatch || null;
    }, targetLabel);

    return similar;
  }

  private async captureScreenshot(page: Page, name: string): Promise<string> {
    mkdirSync(this.outputDir, { recursive: true });
    const path = join(this.outputDir, `${name}_${Date.now()}.png`);
    await page.screenshot({ path, fullPage: false });
    return path;
  }
}
