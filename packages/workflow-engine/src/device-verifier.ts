/**
 * Device Verifier — 실장비 검증 + 시나리오 개선 + 실행 후 검증
 *
 * 시나리오를 실장비에서 실행하고, 성공/실패를 기록.
 * 실패한 경우 시나리오를 자동으로 수정/개선.
 * 성공한 경우 API 엔드포인트를 캡처하여 시나리오에 연결.
 *
 * PostVerifier: 설정 변경 전후 스냅샷 비교 + evidence 생성
 */

import { chromium, type Page, type Browser } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, nowISO, nowId } from '@sangfor/workflow-shared';
import { ScenarioDB, type Scenario, type ScenarioSetting } from './scenario-db.js';
import { SangforAPIDiscovery, type HAREntry } from './sangfor-api-discovery.js';

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
  private browser: Browser | null = null;
  private currentPage: Page | null = null;

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
    } finally {
      await this.close();
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
          const setting = scenario.settings.find((s: ScenarioSetting) => s.label === imp.before);
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
    if (this.browser?.isConnected() && this.currentPage && !this.currentPage.isClosed()) {
      return this.currentPage;
    }

    const cdpEndpoint = `http://127.0.0.1:${this.cdpPort}`;

    try {
      this.browser = await chromium.connectOverCDP(cdpEndpoint);
      const context = this.browser.contexts()[0];
      if (!context) throw new Error('브라우저 컨텍스트 없음');

      const host = targetUrl.split('://')[1]?.split('/')[0] ?? '';
      const existingPage = context.pages().find(p => p.url().includes(host));
      this.currentPage = existingPage ?? context.pages()[0] ?? await context.newPage();
      return this.currentPage;
    } catch {
      this.browser = null;
      this.currentPage = null;
      throw new Error(`Chrome CDP 연결 실패: ${cdpEndpoint}`);
    }
  }

  async close(): Promise<void> {
    if (this.browser?.isConnected()) {
      await this.browser.close().catch(() => {});
    }
    this.browser = null;
    this.currentPage = null;
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

      for (const el of Array.from(allElements)) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// PostVerifier — 실행 후 검증 (PR-26)
// ═══════════════════════════════════════════════════════════════════════════════

const postLog = createLogger('post-verifier');

// ─── 타입 ────────────────────────────────────────────────────────────────────

/** 장비 스냅샷: 키-값 쌍으로 표현되는 장비 상태 */
export interface PostVerifierSnapshot {
  product: string;
  version: string;
  capturedAt: string;
  sections: Record<string, SnapshotSection>;
}

export interface SnapshotSection {
  title: string;
  items: Record<string, string>;
}

/** 검증용 기대 변경 사항 */
export interface VerificationExpectedChange {
  section: string;
  key: string;
  expectedValue: string;
  description: string;
  critical: boolean;  // 필수 변경 여부
}

/** 검증 실패 분류 */
export type FailureCategory =
  | 'value_mismatch'      // 값이 기대와 다름
  | 'missing_key'         // 키가 존재하지 않음
  | 'unexpected_change'   // 예상치 못한 변경 발생
  | 'partial_apply'       // 일부만 적용됨
  | 'timeout'             // 검증 타임아웃
  | 'snapshot_error';     // 스냅샷 수집 오류

/** 실행 후 검증 결과 */
export interface PostCheckResult {
  id: string;
  executionId: string;
  passed: boolean;
  failed: PostCheckFailure[];
  diff: string;
  evidencePath: string;
  checkedAt: string;
  duration: number;
}

export interface PostCheckFailure {
  section: string;
  key: string;
  expected: string;
  actual: string;
  category: FailureCategory;
  description: string;
}

// ─── PostVerifier 클래스 ─────────────────────────────────────────────────────

export class PostVerifier {
  private outputDir: string;

  constructor(options?: { outputDir?: string }) {
    this.outputDir = options?.outputDir ?? './outputs/evidence';
  }

  /**
   * 실행 전후 스냅샷을 비교하여 검증 결과를 반환
   */
  verifyPostExecution(
    executionId: string,
    before: PostVerifierSnapshot,
    after: PostVerifierSnapshot,
    expectedChanges: VerificationExpectedChange[],
  ): PostCheckResult {
    const startTime = Date.now();
    const failed: PostCheckFailure[] = [];

    postLog.info(`Post-check 시작: ${executionId} (${expectedChanges.length} 항목)`);

    for (const expected of expectedChanges) {
      const afterSection = after.sections[expected.section];
      const beforeSection = before.sections[expected.section];

      // 키 존재 여부 확인
      if (!afterSection || !(expected.key in afterSection.items)) {
        failed.push({
          section: expected.section,
          key: expected.key,
          expected: expected.expectedValue,
          actual: '<missing>',
          category: 'missing_key',
          description: expected.description,
        });
        continue;
      }

      const actualValue = afterSection.items[expected.key];

      // 값 비교
      if (actualValue !== expected.expectedValue) {
        const category = this.classifyFailure(
          expected,
          beforeSection?.items[expected.key],
          actualValue,
        );
        failed.push({
          section: expected.section,
          key: expected.key,
          expected: expected.expectedValue,
          actual: actualValue,
          category,
          description: expected.description,
        });
      }
    }

    // 예상치 못한 변경 감지
    const unexpectedChanges = this.detectUnexpectedChanges(before, after, expectedChanges);
    for (const uc of unexpectedChanges) {
      failed.push(uc);
    }

    const passed = failed.length === 0;
    const diff = this.generateDiff(before, after);
    const evidencePath = this.saveEvidence(executionId, before, after, failed, diff);
    const duration = Date.now() - startTime;

    const result: PostCheckResult = {
      id: nowId('postcheck'),
      executionId,
      passed,
      failed,
      diff,
      evidencePath,
      checkedAt: nowISO(),
      duration,
    };

    postLog.info(
      `Post-check 완료: ${passed ? 'PASS' : 'FAIL'} — ` +
      `${failed.length}건 실패, ${duration}ms`,
    );

    return result;
  }

  /**
   * 전후 스냅샷을 사람이 읽을 수 있는 Markdown diff로 변환
   */
  generateDiff(before: PostVerifierSnapshot, after: PostVerifierSnapshot): string {
    const lines: string[] = [];

    lines.push('## 장비 상태 변경 Diff');
    lines.push('');
    lines.push(`| 항목 | 변경 전 | 변경 후 | 상태 |`);
    lines.push(`|------|---------|---------|------|`);

    // 모든 섹션의 모든 키를 비교
    const allSections = new Set([
      ...Object.keys(before.sections),
      ...Object.keys(after.sections),
    ]);

    for (const sectionName of Array.from(allSections)) {
      const beforeSection = before.sections[sectionName];
      const afterSection = after.sections[sectionName];

      const allKeys = new Set([
        ...(beforeSection ? Object.keys(beforeSection.items) : []),
        ...(afterSection ? Object.keys(afterSection.items) : []),
      ]);

      for (const key of Array.from(allKeys)) {
        const beforeVal = beforeSection?.items[key] ?? '<없음>';
        const afterVal = afterSection?.items[key] ?? '<없음>';

        if (beforeVal === afterVal) {
          lines.push(`| ${sectionName}/${key} | ${beforeVal} | ${afterVal} | ✅ 동일 |`);
        } else {
          lines.push(`| ${sectionName}/${key} | ${beforeVal} | ${afterVal} | 🔄 변경됨 |`);
        }
      }
    }

    lines.push('');
    lines.push(`**스냅샷 시간**: 변경 전 ${before.capturedAt} → 변경 후 ${after.capturedAt}`);

    return lines.join('\n');
  }

  /**
   * 실패 원인을 카테고리로 분류
   */
  classifyFailure(
    expected: VerificationExpectedChange,
    beforeValue: string | undefined,
    actualValue: string,
  ): FailureCategory {
    // 값이 비어있으면 부분 적용
    if (!actualValue || actualValue === '') {
      return 'partial_apply';
    }

    // 이전 값과 동일하면 변경이 아예 안 됨
    if (beforeValue === actualValue) {
      return 'value_mismatch';
    }

    // 값이 다르면 mismatch
    return 'value_mismatch';
  }

  /**
   * 예상치 못한 변경을 감지
   */
  private detectUnexpectedChanges(
    before: PostVerifierSnapshot,
    after: PostVerifierSnapshot,
    expectedChanges: VerificationExpectedChange[],
  ): PostCheckFailure[] {
    const failures: PostCheckFailure[] = [];
    const expectedKeys = new Set(
      expectedChanges.map(ec => `${ec.section}/${ec.key}`),
    );

    const allSections = new Set([
      ...Object.keys(before.sections),
      ...Object.keys(after.sections),
    ]);

    for (const sectionName of Array.from(allSections)) {
      const beforeSection = before.sections[sectionName];
      const afterSection = after.sections[sectionName];
      if (!beforeSection || !afterSection) continue;

      for (const key of Object.keys(afterSection.items)) {
        const compositeKey = `${sectionName}/${key}`;
        if (expectedKeys.has(compositeKey)) continue;

        const beforeVal = beforeSection.items[key];
        const afterVal = afterSection.items[key];

        if (beforeVal !== undefined && beforeVal !== afterVal) {
          failures.push({
            section: sectionName,
            key,
            expected: beforeVal,
            actual: afterVal,
            category: 'unexpected_change',
            description: `예상치 못한 변경: ${compositeKey}`,
          });
        }
      }
    }

    return failures;
  }

  /**
   * evidence 파일을 저장하고 경로를 반환
   */
  private saveEvidence(
    executionId: string,
    before: PostVerifierSnapshot,
    after: PostVerifierSnapshot,
    failures: PostCheckFailure[],
    diff: string,
  ): string {
    mkdirSync(this.outputDir, { recursive: true });

    const evidence = {
      executionId,
      checkedAt: nowISO(),
      product: after.product,
      version: after.version,
      passed: failures.length === 0,
      failureCount: failures.length,
      failures,
      diff,
      beforeSnapshot: before,
      afterSnapshot: after,
    };

    const filePath = join(this.outputDir, `postcheck_${executionId}_${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify(evidence, null, 2), 'utf-8');

    postLog.info(`Evidence 저장: ${filePath}`);
    return filePath;
  }
}
