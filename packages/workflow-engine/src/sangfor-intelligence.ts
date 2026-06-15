/**
 * Sangfor Intelligence — 통합 파이프라인 오케스트레이터
 *
 * 전체 지능화 파이프라인을 조율:
 *   Stage 1: 수집 (KB 문서, 매뉴얼)
 *   Stage 2: 시나리오 추출 (패턴 + LLM)
 *   Stage 3: API 발견 (Integuru HAR 패턴)
 *   Stage 4: 실장비 검증 + 개선
 *   Stage 5: 문서화 도구 연동
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, nowISO } from '@sangfor/workflow-shared';
import { ScenarioDB, type Scenario } from './scenario-db';
import { ManualScenarioExtractor, type ExtractionResult } from './manual-scenario-extractor';
import { SangforAPIDiscovery, type HARCaptureConfig } from './sangfor-api-discovery';
import { DeviceVerifier, type DeviceCredentials, type VerificationReport } from './device-verifier';

const log = createLogger('sangfor-intelligence');

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface IntelligenceConfig {
  scenarioDBPath?: string;
  outputDir?: string;
  cdpPort?: number;
  llmEndpoint?: string;
  llmApiKey?: string;
  llmModel?: string;
}

export interface PipelineResult {
  stage: string;
  timestamp: string;
  duration: number;
  success: boolean;
  data: unknown;
  errors: string[];
}

export interface FullPipelineReport {
  startTime: string;
  endTime: string;
  totalDuration: number;
  stages: PipelineResult[];
  summary: {
    scenariosExtracted: number;
    scenariosWithAPI: number;
    scenariosVerified: number;
    scenariosPassed: number;
    scenariosImproved: number;
  };
}

// ─── Sangfor Intelligence ───────────────────────────────────────────────────

export class SangforIntelligence {
  private scenarioDB: ScenarioDB;
  private extractor: ManualScenarioExtractor;
  private apiDiscovery: SangforAPIDiscovery;
  private verifier: DeviceVerifier;
  private config: IntelligenceConfig;

  constructor(config: IntelligenceConfig = {}) {
    this.config = config;

    this.scenarioDB = new ScenarioDB(config.scenarioDBPath ?? 'data/scenarios');
    this.scenarioDB.init();
    this.scenarioDB.loadAll();

    this.extractor = new ManualScenarioExtractor({
      scenarioDB: this.scenarioDB,
      llmEndpoint: config.llmEndpoint,
      llmApiKey: config.llmApiKey,
      llmModel: config.llmModel,
    });

    this.apiDiscovery = new SangforAPIDiscovery({
      llmEndpoint: config.llmEndpoint,
      llmApiKey: config.llmApiKey,
      llmModel: config.llmModel,
    });

    this.verifier = new DeviceVerifier({
      scenarioDB: this.scenarioDB,
      outputDir: config.outputDir ?? './outputs/intelligence',
      cdpPort: config.cdpPort,
      llmEndpoint: config.llmEndpoint,
      llmApiKey: config.llmApiKey,
    });
  }

  // ── Stage 1: 문서에서 시나리오 추출 ──

  async stageExtract(input: {
    sourceDir?: string;
    files?: string[];
    product?: string;
  }): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let extracted = 0;

    try {
      const files = input.files ?? this.discoverFiles(input.sourceDir ?? 'data/sources/raw');

      for (const file of files) {
        try {
          const result = await this.extractor.extractFromFile(file, input.product);
          await this.extractor.saveToDB(result);
          extracted += result.scenarios.length;
          log.info(`[${file}] ${result.scenarios.length}개 시나리오 추출`);
        } catch (err) {
          errors.push(`${file}: ${String(err)}`);
        }
      }

      this.scenarioDB.rebuildIndex();

      return {
        stage: 'extract',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: errors.length === 0,
        data: { filesProcessed: files.length, scenariosExtracted: extracted },
        errors,
      };
    } catch (err) {
      return {
        stage: 'extract',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: false,
        data: { scenariosExtracted: extracted },
        errors: [String(err)],
      };
    }
  }

  // ── Stage 2: HAR 캡처로 API 발견 ──

  async stageAPIDiscovery(input: {
    product: 'EPP' | 'IAG' | 'CC';
    harPath?: string;
    captureConfig?: HARCaptureConfig;
  }): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let enriched = 0;

    try {
      let harPath = input.harPath;

      // HAR 파일이 없으면 캡처
      if (!harPath && input.captureConfig) {
        harPath = await this.apiDiscovery.captureHAR(input.captureConfig);
      }

      if (!harPath || !existsSync(harPath)) {
        throw new Error('HAR 파일 없음');
      }

      // HAR 분석
      const entries = this.apiDiscovery.parseHAR(harPath);
      const analysis = await this.apiDiscovery.analyzeAPIs(entries, '설정 변경', input.product);

      log.info(`API 분석 완료: mutation ${analysis.mutationEndpoints.length}개 발견`);

      // 시나리오에 API 정보 연결
      const scenarios = this.scenarioDB.findByProduct(input.product);
      for (const scenario of scenarios) {
        const apiEndpoint = this.apiDiscovery.mapToScenario(analysis, scenario);
        if (apiEndpoint) {
          this.scenarioDB.updateAPIEndpoint(scenario.id, apiEndpoint);
          enriched++;
          log.info(`[${scenario.id}] API 엔드포인트 연결: ${apiEndpoint.method} ${apiEndpoint.url}`);
        }
      }

      return {
        stage: 'api_discovery',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: true,
        data: {
          harEntries: entries.length,
          mutationEndpoints: analysis.mutationEndpoints.length,
          scenariosEnriched: enriched,
        },
        errors,
      };
    } catch (err) {
      return {
        stage: 'api_discovery',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: false,
        data: { scenariosEnriched: enriched },
        errors: [String(err)],
      };
    }
  }

  // ── Stage 3: 실장비 검증 ──

  async stageVerify(input: {
    product: string;
    credentials: DeviceCredentials;
    scenarioIds?: string[];
  }): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const reports: VerificationReport[] = [];

    try {
      const scenarioIds = input.scenarioIds ??
        this.scenarioDB.findByProduct(input.product).map(s => s.id);

      for (const id of scenarioIds) {
        try {
          const report = await this.verifier.verifyScenario(id, input.credentials);
          reports.push(report);
        } catch (err) {
          errors.push(`${id}: ${String(err)}`);
        }
      }

      const passed = reports.filter(r => r.overallResult === 'pass').length;
      const improved = reports.filter(r => r.improvements.length > 0).length;

      return {
        stage: 'verify',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: errors.length === 0,
        data: {
          verified: reports.length,
          passed,
          partial: reports.filter(r => r.overallResult === 'partial').length,
          failed: reports.filter(r => r.overallResult === 'fail').length,
          improved,
        },
        errors,
      };
    } catch (err) {
      return {
        stage: 'verify',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: false,
        data: { verified: reports.length },
        errors: [String(err)],
      };
    }
  }

  // ── Stage 4: 문서화 도구 연동 ──

  async stageDocumentify(): Promise<PipelineResult> {
    const startTime = Date.now();

    try {
      const scenarios = this.scenarioDB.loadAll();

      // 시나리오별 가이드 생성을 위한 데이터 구성
      const guides = scenarios.map(s => ({
        id: s.id,
        product: s.product,
        feature: s.feature,
        description: s.description,
        menuPath: s.menuPath,
        hashRoute: s.hashRoute,
        hasAPI: !!s.apiEndpoint,
        apiEndpoint: s.apiEndpoint ? {
          method: s.apiEndpoint.method,
          url: s.apiEndpoint.url,
        } : undefined,
        settings: s.settings.map(setting => ({
          type: setting.type,
          label: setting.label,
          value: setting.value,
          description: setting.description,
        })),
        validationCriteria: s.validation.criteria,
        verification: s.verification,
        riskLevel: s.riskLevel,
      }));

      // setting-guide-generator에 전달할 수 있는 형태로 저장
      const { writeFileSync } = await import('node:fs');
      const { mkdirSync } = await import('node:fs');
      const outputDir = join(this.config.outputDir ?? './outputs/intelligence', 'docs');
      mkdirSync(outputDir, { recursive: true });

      // 제품별 가이드 데이터
      for (const product of ['EPP', 'IAG', 'CC']) {
        const productGuides = guides.filter(g => g.product === product);
        writeFileSync(
          join(outputDir, `${product.toLowerCase()}_guides.json`),
          JSON.stringify(productGuides, null, 2),
          'utf8',
        );
      }

      // 전체 인덱스
      writeFileSync(
        join(outputDir, '_all_guides.json'),
        JSON.stringify(guides, null, 2),
        'utf8',
      );

      log.info(`문서화 데이터 생성 완료: ${guides.length}개 시나리오 → ${outputDir}`);

      return {
        stage: 'documentify',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: true,
        data: { guidesGenerated: guides.length, outputDir },
        errors: [],
      };
    } catch (err) {
      return {
        stage: 'documentify',
        timestamp: nowISO(),
        duration: Date.now() - startTime,
        success: false,
        data: {},
        errors: [String(err)],
      };
    }
  }

  // ── 전체 파이프라인 실행 ──

  async runFullPipeline(input: {
    sourceDir?: string;
    products?: string[];
    credentials?: Record<string, DeviceCredentials>;
    harPaths?: Record<string, string>;
    skipHARCapture?: boolean;
    skipVerification?: boolean;
  }): Promise<FullPipelineReport> {
    const startTime = Date.now();
    const stages: PipelineResult[] = [];

    log.info('=== 전체 파이프라인 시작 ===');

    // Stage 1: 추출
    log.info('[Stage 1] 문서에서 시나리오 추출');
    const extractResult = await this.stageExtract({
      sourceDir: input.sourceDir,
      product: input.products?.[0],
    });
    stages.push(extractResult);

    // Stage 2: API 발견 (HAR 파일이 있는 경우만)
    if (!input.skipHARCapture) {
      for (const product of input.products ?? ['EPP', 'IAG', 'CC']) {
        const harPath = input.harPaths?.[product];
        if (harPath) {
          log.info(`[Stage 2] API 발견: ${product}`);
          const apiResult = await this.stageAPIDiscovery({
            product: product as 'EPP' | 'IAG' | 'CC',
            harPath,
          });
          stages.push(apiResult);
        }
      }
    }

    // Stage 3: 실장비 검증
    if (!input.skipVerification && input.credentials) {
      for (const [product, creds] of Object.entries(input.credentials)) {
        log.info(`[Stage 3] 실장비 검증: ${product}`);
        const verifyResult = await this.stageVerify({
          product,
          credentials: creds,
        });
        stages.push(verifyResult);
      }
    }

    // Stage 4: 문서화
    log.info('[Stage 4] 문서화 데이터 생성');
    const docResult = await this.stageDocumentify();
    stages.push(docResult);

    const endTime = Date.now();

    // 요약
    const extractData = extractResult.data as { scenariosExtracted?: number };
    const verifyStages = stages.filter(s => s.stage === 'verify');
    const verifyData = verifyStages.reduce(
      (acc, s) => {
        const d = s.data as { verified?: number; passed?: number; improved?: number };
        return {
          verified: (acc.verified ?? 0) + (d.verified ?? 0),
          passed: (acc.passed ?? 0) + (d.passed ?? 0),
          improved: (acc.improved ?? 0) + (d.improved ?? 0),
        };
      },
      { verified: 0, passed: 0, improved: 0 },
    );

    const apiStages = stages.filter(s => s.stage === 'api_discovery');
    const apiData = apiStages.reduce(
      (acc, s) => {
        const d = s.data as { scenariosEnriched?: number };
        return { enriched: (acc.enriched ?? 0) + (d.scenariosEnriched ?? 0) };
      },
      { enriched: 0 },
    );

    return {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalDuration: endTime - startTime,
      stages,
      summary: {
        scenariosExtracted: extractData.scenariosExtracted ?? 0,
        scenariosWithAPI: apiData.enriched,
        scenariosVerified: verifyData.verified ?? 0,
        scenariosPassed: verifyData.passed ?? 0,
        scenariosImproved: verifyData.improved ?? 0,
      },
    };
  }

  // ── 접근자 ──

  getScenarioDB(): ScenarioDB {
    return this.scenarioDB;
  }

  getExtractor(): ManualScenarioExtractor {
    return this.extractor;
  }

  getAPIDiscovery(): SangforAPIDiscovery {
    return this.apiDiscovery;
  }

  getVerifier(): DeviceVerifier {
    return this.verifier;
  }

  // ── 내부 헬퍼 ──

  private discoverFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.yaml'))
      .map(f => join(dir, f));
  }
}
