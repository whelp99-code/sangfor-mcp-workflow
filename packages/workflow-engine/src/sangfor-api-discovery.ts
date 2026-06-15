/**
 * Sangfor API Discovery — Integuru 패턴
 *
 * HAR 캡처 → LLM 분석 → API 엔드포인트 발견 → 의존성 그래프 구축.
 * Sangfor 콘솔의 내부 API를 자동으로 찾아내어 시나리오에 연결.
 *
 * Integuru (https://github.com/Integuru-AI/Integuru) 패턴을 TypeScript로 구현.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { createLogger, nowId, nowISO } from '@sangfor/workflow-shared';
import type { Scenario, ScenarioAPIEndpoint } from './scenario-db';

const log = createLogger('api-discovery');

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface HARRequest {
  id: string;
  method: string;
  url: string;
  path: string;
  host: string;
  headers: Record<string, string>;
  body?: string;
  contentType?: string;
  timestamp: string;
}

export interface HARResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  mimeType: string;
  size: number;
}

export interface HAREntry {
  request: HARRequest;
  response: HARResponse;
  duration: number;
  startedDateTime: string;
}

export interface APIEndpointCandidate {
  method: string;
  url: string;
  path: string;
  host: string;
  body?: string;
  responseSnippet: string;
  isMutation: boolean;
  confidence: number;
  dynamicParams: DynamicParam[];
}

export interface DynamicParam {
  name: string;
  value: string;
  type: 'id' | 'token' | 'session' | 'path' | 'query';
  sourceEndpoint?: string;
}

export interface APIAnalysisResult {
  endpoints: APIEndpointCandidate[];
  mutationEndpoints: APIEndpointCandidate[];
  getEndpoints: APIEndpointCandidate[];
  summary: string;
  recommendedForScenario: Map<string, ScenarioAPIEndpoint>;
}

export interface DependencyNode {
  id: string;
  endpoint: APIEndpointCandidate;
  dependsOn: string[];
  leaf: boolean;
}

export interface HARCaptureConfig {
  product: 'EPP' | 'IAG' | 'CC';
  targetUrl: string;
  outputDir: string;
  captureDurationMs?: number;
}

// ─── API Discovery ──────────────────────────────────────────────────────────

export class SangforAPIDiscovery {
  private llmEndpoint: string;
  private llmApiKey: string;
  private llmModel: string;

  constructor(options?: {
    llmEndpoint?: string;
    llmApiKey?: string;
    llmModel?: string;
  }) {
    this.llmEndpoint = options?.llmEndpoint ?? 'http://localhost:1234/v1/chat/completions';
    this.llmApiKey = options?.llmApiKey ?? process.env.OPENAI_API_KEY ?? 'lm-studio';
    this.llmModel = options?.llmModel ?? 'local-model';
  }

  // ── 1단계: HAR 캡처 ──

  async captureHAR(config: HARCaptureConfig): Promise<string> {
    const outputDir = config.outputDir;
    mkdirSync(outputDir, { recursive: true });

    const harPath = join(outputDir, `${config.product.toLowerCase()}_capture.har`);
    const cookiePath = join(outputDir, `${config.product.toLowerCase()}_cookies.json`);

    log.info(`HAR 캡처 시작: ${config.product} → ${config.targetUrl}`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      recordHar: {
        path: harPath,
        content: 'include',
        mode: 'full',
      },
    });
    const page = await context.newPage();

    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });

    log.info('브라우저가 열렸습니다.');
    log.info('Sangfor 콘솔에서 설정 작업을 수행하세요.');
    log.info('작업 완료 후 이 스크립트로 돌아와서 Enter를 누르세요.');

    // 사용자 입력 대기 (실제 환경에서는 stdin 또는 UI 연동)
    await this.waitForUserAction(config.captureDurationMs ?? 120_000);

    // 쿠키 저장
    const cookies = await context.cookies();
    writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf8');

    await context.close();
    await browser.close();

    log.info(`HAR 저장: ${harPath}`);
    log.info(`쿠키 저장: ${cookiePath}`);

    return harPath;
  }

  // ── 2단계: HAR 파싱 ──

  parseHAR(harPath: string): HAREntry[] {
    const har = JSON.parse(readFileSync(harPath, 'utf8'));
    const entries: HAREntry[] = [];

    for (const entry of har.log?.entries ?? []) {
      const req = entry.request;
      const res = entry.response;

      // 노이즈 필터링 (폰트, 이미지, analytics 등)
      const url = req.url;
      if (this.isNoiseRequest(url)) continue;

      const urlObj = new URL(url);

      entries.push({
        request: {
          id: nowId('req'),
          method: req.method,
          url,
          path: urlObj.pathname,
          host: urlObj.host,
          headers: Object.fromEntries(
            (req.headers ?? []).map((h: { name: string; value: string }) => [h.name.toLowerCase(), h.value]),
          ),
          body: req.postData?.text,
          contentType: req.postData?.mimeType,
          timestamp: entry.startedDateTime,
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(
            (res.headers ?? []).map((h: { name: string; value: string }) => [h.name.toLowerCase(), h.value]),
          ),
          body: res.content?.text?.slice(0, 10_000) ?? '',
          mimeType: res.content?.mimeType ?? '',
          size: res.content?.size ?? 0,
        },
        duration: entry.time ?? 0,
        startedDateTime: entry.startedDateTime,
      });
    }

    log.info(`HAR 파싱 완료: ${entries.length}개 요청 (노이즈 필터링 후)`);
    return entries;
  }

  // ── 3단계: LLM 기반 API 분석 (Integuru 패턴) ──

  async analyzeAPIs(
    entries: HAREntry[],
    action: string,
    product: string,
  ): Promise<APIAnalysisResult> {
    // 설정 변경 관련 요청만 필터링 (POST, PUT, PATCH)
    const mutationCandidates = entries.filter(e =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.request.method) &&
      e.request.path.includes('/api'),
    );

    const getEndpoints = entries.filter(e =>
      e.request.method === 'GET' &&
      e.request.path.includes('/api'),
    );

    log.info(`분석 대상: mutation ${mutationCandidates.length}개, GET ${getEndpoints.length}개`);

    // LLM에게 분석 요청
    const prompt = this.buildAnalysisPrompt(entries, action, product);
    const llmResponse = await this.callLLM(prompt);
    const analysis = this.parseLLMResponse(llmResponse, entries);

    return analysis;
  }

  // ── 4단계: 시나리오에 API 정보 연결 ──

  mapToScenario(
    analysis: APIAnalysisResult,
    scenario: Scenario,
  ): ScenarioAPIEndpoint | null {
    // 시나리오의 feature와 관련된 mutation 엔드포인트 찾기
    const featureLower = scenario.feature.toLowerCase();

    const candidates = analysis.mutationEndpoints.filter(ep => {
      const pathLower = ep.path.toLowerCase();
      return (
        pathLower.includes(featureLower.replace(/\s+/g, '-')) ||
        pathLower.includes(featureLower.replace(/\s+/g, '_')) ||
        ep.responseSnippet.toLowerCase().includes(featureLower)
      );
    });

    if (candidates.length === 0) return null;

    // 가장 신뢰도 높은 엔드포인트 선택
    const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];

    return {
      method: best.method,
      url: best.path,
      payload: best.body ? JSON.parse(best.body) : undefined,
      authType: 'bearer',
      discoveredBy: 'integuru_har',
      discoveredAt: nowISO(),
      confidence: best.confidence,
    };
  }

  // ── 5단계: 의존성 그래프 구축 ──

  buildDependencyGraph(endpoints: APIEndpointCandidate[]): DependencyNode[] {
    const nodes: DependencyNode[] = endpoints.map(ep => ({
      id: `${ep.method}_${ep.path}`,
      endpoint: ep,
      dependsOn: [],
      leaf: false,
    }));

    // 동적 파라미터 추적
    for (const node of nodes) {
      for (const param of node.endpoint.dynamicParams) {
        // 이 파라미터 값을 제공하는 다른 노드 찾기
        const source = nodes.find(n =>
          n.id !== node.id &&
          n.endpoint.responseSnippet.includes(param.value),
        );
        if (source) {
          node.dependsOn.push(source.id);
        }
      }

      // 의존성이 없으면 리프 노드 (쿠키/세션만으로 실행 가능)
      node.leaf = node.dependsOn.length === 0;
    }

    return nodes;
  }

  // ── 통합: HAR → 시나리오 자동 보강 ──

  async enrichScenarioFromHAR(
    harPath: string,
    action: string,
    scenario: Scenario,
  ): Promise<Scenario> {
    const entries = this.parseHAR(harPath);
    const analysis = await this.analyzeAPIs(entries, action, scenario.product);

    const apiEndpoint = this.mapToScenario(analysis, scenario);
    if (apiEndpoint) {
      scenario.apiEndpoint = apiEndpoint;
      scenario.source = {
        type: 'integuru_har',
        url: harPath,
        confidence: apiEndpoint.confidence,
        extractedAt: nowISO(),
      };
      log.info(`시나리오 [${scenario.id}]에 API 엔드포인트 연결: ${apiEndpoint.method} ${apiEndpoint.url}`);
    }

    return scenario;
  }

  // ── 내부 헬퍼 ──

  private isNoiseRequest(url: string): boolean {
    const noisePatterns = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf',
      'google-analytics', 'googletagmanager', 'hotjar', 'mixpanel', 'segment',
      'facebook.net', 'doubleclick.net', 'ads.', 'tracking.',
      '.css', '.map',
    ];
    const lower = url.toLowerCase();
    return noisePatterns.some(p => lower.includes(p));
  }

  private buildAnalysisPrompt(entries: HAREntry[], action: string, product: string): string {
    const requestSummaries = entries.slice(0, 50).map((e, i) => {
      const bodyPreview = e.request.body?.slice(0, 200) ?? '';
      return `[${i}] ${e.request.method} ${e.request.path} → ${e.response.status} (${e.response.mimeType})${bodyPreview ? `\n    Body: ${bodyPreview}` : ''}`;
    }).join('\n');

    return `
You are analyzing network traffic from a Sangfor ${product} security console.

The user performed this action: "${action}"

Here are the captured HTTP requests:
${requestSummaries}

Analyze and identify:
1. Which request(s) actually perform the setting change (mutation)?
2. Which request(s) are data-fetching (GET) that provide context?
3. For each mutation request, what are the dynamic parameters (IDs, tokens, session vars)?

Return JSON:
{
  "mutationEndpoints": [
    {
      "index": <request index>,
      "reason": "why this request performs the action",
      "dynamicParams": [
        { "name": "param_name", "value": "value_found", "type": "id|token|session|path|query" }
      ],
      "confidence": 0.0-1.0
    }
  ],
  "dataEndpoints": [
    {
      "index": <request index>,
      "reason": "why this request is data-fetching"
    }
  ],
  "summary": "overall analysis summary"
}
`;
  }

  private async callLLM(prompt: string): Promise<string> {
    try {
      const response = await fetch(this.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: [
            { role: 'system', content: 'You are an expert at reverse-engineering web APIs from network traffic.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new Error(`LLM API ${response.status}: ${await response.text().catch(() => 'unknown')}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      log.error(`LLM 호출 실패: ${err}`);
      throw err;
    }
  }

  private parseLLMResponse(response: string, entries: HAREntry[]): APIAnalysisResult {
    try {
      // JSON 추출 (마크다운 코드 블록 등 제거)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found in LLM response');

      const parsed = JSON.parse(jsonMatch[0]);

      const mutationEndpoints: APIEndpointCandidate[] = (parsed.mutationEndpoints ?? []).map((ep: any) => {
        const entry = entries[ep.index];
        if (!entry) return null;
        return {
          method: entry.request.method,
          url: entry.request.url,
          path: entry.request.path,
          host: entry.request.host,
          body: entry.request.body,
          responseSnippet: entry.response.body.slice(0, 500),
          isMutation: true,
          confidence: ep.confidence ?? 0.7,
          dynamicParams: (ep.dynamicParams ?? []).map((p: any) => ({
            name: p.name,
            value: p.value,
            type: p.type ?? 'id',
          })),
        };
      }).filter(Boolean);

      const getEndpoints: APIEndpointCandidate[] = (parsed.dataEndpoints ?? []).map((ep: any) => {
        const entry = entries[ep.index];
        if (!entry) return null;
        return {
          method: entry.request.method,
          url: entry.request.url,
          path: entry.request.path,
          host: entry.request.host,
          responseSnippet: entry.response.body.slice(0, 500),
          isMutation: false,
          confidence: 0.5,
          dynamicParams: [],
        };
      }).filter(Boolean);

      return {
        endpoints: [...mutationEndpoints, ...getEndpoints],
        mutationEndpoints,
        getEndpoints,
        summary: parsed.summary ?? '분석 완료',
        recommendedForScenario: new Map(),
      };
    } catch (err) {
      log.warn(`LLM 응답 파싱 실패: ${err}`);
      return {
        endpoints: [],
        mutationEndpoints: [],
        getEndpoints: [],
        summary: 'LLM 응답 파싱 실패',
        recommendedForScenario: new Map(),
      };
    }
  }

  private async waitForUserAction(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      process.stdin?.once?.('data', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
