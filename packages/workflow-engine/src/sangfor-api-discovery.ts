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
import type { Scenario, ScenarioAPIEndpoint } from './scenario-db.js';

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
  headless?: boolean;
}

// ─── API Discovery ──────────────────────────────────────────────────────────

export class SangforAPIDiscovery {
  private llmEndpoint: string;
  private llmApiKey: string;
  private llmModel: string;
  private headless: boolean;
  private autoMode: boolean;
  private maxPromptEntries: number;

  /** Sangfor 콘솔에서 흔히 사용하는 API 경로 패턴 */
  private static readonly API_PATH_PATTERNS = [
    '/api', '/cgi-bin', '/management', '/rest', '/auth', '/v1', '/v2', '/webapi',
  ];

  constructor(options?: {
    llmEndpoint?: string;
    llmApiKey?: string;
    llmModel?: string;
    headless?: boolean;
    autoMode?: boolean;
    maxPromptEntries?: number;
  }) {
    this.llmEndpoint = options?.llmEndpoint ?? 'http://localhost:1234/v1/chat/completions';
    this.llmApiKey = options?.llmApiKey ?? process.env.OPENAI_API_KEY ?? 'lm-studio';
    this.llmModel = options?.llmModel ?? 'local-model';
    this.headless = options?.headless ?? true;
    this.autoMode = options?.autoMode ?? false;
    this.maxPromptEntries = options?.maxPromptEntries ?? 80;
  }

  // ── 1단계: HAR 캡처 ──

  async captureHAR(config: HARCaptureConfig): Promise<string> {
    // [FIX #3] targetUrl 유효성 검사
    try { new URL(config.targetUrl); }
    catch { throw new Error(`잘못된 URL: ${config.targetUrl}`); }

    const outputDir = config.outputDir;
    mkdirSync(outputDir, { recursive: true });

    const harPath = join(outputDir, `${config.product.toLowerCase()}_capture.har`);
    const cookiePath = join(outputDir, `${config.product.toLowerCase()}_cookies.json`);

    log.info(`HAR 캡처 시작: ${config.product} → ${config.targetUrl}`);

    // [FIX #1] headless 옵션화 (기본 true, config에서 오버라이드 가능)
    const browser = await chromium.launch({ headless: config.headless ?? this.headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      recordHar: {
        path: harPath,
        content: 'embed',   // [FIX #2] 'include' → 'embed' (Playwright 유효값)
        mode: 'full',       // 유효한 옵션 유지
      },
    });
    const page = await context.newPage();

    // [FIX #10] SIGINT/SIGTERM 안전 처리 — HAR 저장 보장
    let closing = false;
    const gracefulShutdown = async (signal: string) => {
      if (closing) return;
      closing = true;
      log.warn(`${signal} 감지 — HAR 저장 중...`);
      try {
        await context.close();
        await browser.close();
      } catch { /* best effort */ }
      process.exit(128 + (signal === 'SIGINT' ? 2 : 15)); // [FIX] 표준 exit code
    };
    const onSigint = () => gracefulShutdown('SIGINT');
    const onSigterm = () => gracefulShutdown('SIGTERM');
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);

    try {
      // [FIX #3] goto 에러 핸들링 + 타임아웃
      try {
        await page.goto(config.targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
      } catch (err) {
        throw new Error(`타겟 접속 실패: ${config.targetUrl} — ${err}`);
      }

      log.info('브라우저가 열렸습니다.');
      log.info('Sangfor 콘솔에서 설정 작업을 수행하세요.');
      log.info('작업 완료 후 이 스크립트로 돌아와서 Enter를 누르세요.');

      // 사용자 입력 대기
      await this.waitForUserAction(config.captureDurationMs ?? 120_000);

      // 쿠키 저장
      const cookies = await context.cookies();
      writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), 'utf8');

      log.info(`HAR 저장: ${harPath}`);
      log.info(`쿠키 저장: ${cookiePath}`);

      return harPath;
    } finally {
      // [FIX #10] 시그널 리스너 정리 (named 참조 사용)
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
      if (!closing) {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
      }
    }
  }

  // ── 2단계: HAR 파싱 ──

  parseHAR(harPath: string): HAREntry[] {
    const rawHar = readFileSync(harPath, 'utf8');
    let har: unknown;
    try {
      har = JSON.parse(rawHar);
    } catch (err) {
      log.warn(`HAR JSON 파싱 실패: ${harPath} (${err})`);
      return [];
    }

    const harEntries = this.getHarLogEntries(har);
    if (!harEntries.length) {
      log.warn(`HAR entries 없음 또는 형식 불일치: ${harPath}`);
      return [];
    }

    const entries: HAREntry[] = [];

    for (const entry of harEntries) {
      const req = entry.request;
      const res = entry.response;
      if (!req?.url || !req.method || !res) continue;

      const url = req.url;
      if (this.isNoiseRequest(url)) continue;

      let urlObj: URL;
      try {
        urlObj = new URL(url);
      } catch {
        log.warn(`잘못된 HAR request URL 스킵: ${url}`);
        continue;
      }

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

  private getHarLogEntries(har: unknown): Array<{
    request?: {
      method?: string;
      url?: string;
      headers?: Array<{ name: string; value: string }>;
      postData?: { text?: string; mimeType?: string };
    };
    response?: {
      status?: number;
      statusText?: string;
      headers?: Array<{ name: string; value: string }>;
      content?: { text?: string; mimeType?: string; size?: number };
    };
    time?: number;
    startedDateTime?: string;
  }> {
    if (!har || typeof har !== 'object') return [];
    const logNode = (har as { log?: unknown }).log;
    if (!logNode || typeof logNode !== 'object') return [];
    const entries = (logNode as { entries?: unknown }).entries;
    return Array.isArray(entries) ? entries : [];
  }

  // ── 3단계: LLM 기반 API 분석 (Integuru 패턴) ──

  async analyzeAPIs(
    entries: HAREntry[],
    action: string,
    product: string,
  ): Promise<APIAnalysisResult> {
    // [FIX #5] dead code 해소: 필터된 엔트리를 LLM에도 전달
    const isAPIPath = (path: string) =>
      SangforAPIDiscovery.API_PATH_PATTERNS.some(p => path.includes(p));

    const relevantEntries = entries.filter(e =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.request.method) ||
      (e.request.method === 'GET' && isAPIPath(e.request.path)),
    );

    const allRelevant = relevantEntries.length > 0 ? relevantEntries : entries;

    const mutationCount = allRelevant.filter(e =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.request.method),
    ).length;
    const getCount = allRelevant.filter(e => e.request.method === 'GET').length;

    log.info(`분석 대상: mutation ${mutationCount}개, GET ${getCount}개 (총 ${allRelevant.length}개)`);

    // LLM에게 분석 요청 — 필터된 엔트리 전달
    const prompt = this.buildAnalysisPrompt(allRelevant, action, product);
    const llmResponse = await this.callLLM(prompt);
    const analysis = this.parseLLMResponse(llmResponse, allRelevant);

    return analysis;
  }

  // ── 4단계: 시나리오에 API 정보 연결 ──

  mapToScenario(
    analysis: APIAnalysisResult,
    scenario: Scenario,
  ): ScenarioAPIEndpoint | null {
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

    const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];

    return {
      method: best.method,
      url: best.url,  // [FIX] path만이 아닌 전체 URL 사용 (호스트 정보 보존)
      payload: best.body ? (this.safeParseJSON(best.body) as Record<string, unknown> | undefined) : undefined,
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

    for (const node of nodes) {
      for (const param of node.endpoint.dynamicParams) {
        const source = nodes.find(n =>
          n.id !== node.id &&
          n.endpoint.responseSnippet.includes(param.value),
        );
        if (source) {
          node.dependsOn.push(source.id);
        }
      }

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
        confidence: apiEndpoint.confidence ?? 0.5,  // [FIX] strict mode 타입 안전
        extractedAt: nowISO(),
      };
      log.info(`시나리오 [${scenario.id}]에 API 엔드포인트 연결: ${apiEndpoint.method} ${apiEndpoint.url}`);
    }

    return scenario;
  }

  // ── 내부 헬퍼 ──

  /**
   * [FIX #9] 노이즈 필터링 — .js는 endsWith로, .json과 구분
   * 확장자는 URL 경로 끝에서만 매칭하여 .json API误필터링 방지
   */
  private isNoiseRequest(url: string): boolean {
    const staticExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
      '.woff', '.woff2', '.ttf', '.eot',
      '.css', '.map',
    ];
    const lower = url.toLowerCase();
    const urlPath = lower.split('?')[0]; // 쿼리스트링 제거

    // 확장자는 URL 경로 끝에서만 매칭
    if (staticExtensions.some(ext => urlPath.endsWith(ext))) return true;

    // .js는 정확히 끝부분만 매칭 (.json과 구분)
    if (urlPath.endsWith('.js') || urlPath.endsWith('.mjs')) return true;

    // 도메인/경로 기반 노이즈
    const noisePatterns = [
      'google-analytics', 'googletagmanager', 'hotjar', 'mixpanel', 'segment',
      'facebook.net', 'doubleclick.net', 'ads.', 'tracking.',
    ];
    return noisePatterns.some(p => lower.includes(p));
  }

  private buildAnalysisPrompt(entries: HAREntry[], action: string, product: string): string {
    // [FIX #8] 원본 인덱스 보존 + mutation 우선 정렬
    const indexed = entries.map((e, i) => ({ entry: e, originalIndex: i }));
    indexed.sort((a, b) => {
      const aMut = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(a.entry.request.method) ? 0 : 1;
      const bMut = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(b.entry.request.method) ? 0 : 1;
      return aMut - bMut;
    });
    const limited = indexed.slice(0, this.maxPromptEntries);

    const requestSummaries = limited.map(({ entry: e, originalIndex: i }) => {
      const bodyPreview = e.request.body?.slice(0, 200) ?? '';
      return `[${i}] ${e.request.method} ${e.request.path} → ${e.response.status} (${e.response.mimeType})${bodyPreview ? `\n    Body: ${bodyPreview}` : ''}`;
    }).join('\n');

    return `
You are analyzing network traffic from a Sangfor ${product} security console.

The user performed this action: "${action}"

Here are the captured HTTP requests (numbered by original capture order):
${requestSummaries}

Pay special attention to requests with paths containing:
/cgi-bin, /management, /rest, /auth, /webapi — these are common Sangfor API patterns.

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

  /**
   * [FIX #7] 마크다운 코드 블록 우선 추출 + 중괄호 깊이 카운팅
   */
  private parseLLMResponse(response: string, entries: HAREntry[]): APIAnalysisResult {
    try {
      let jsonStr: string | null = null;

      // 1) 코드 블록 내 JSON 우선
      const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // 2) 중괄호 매칭 (중첩 지원)
        const start = response.indexOf('{');
        if (start !== -1) {
          let depth = 0;
          for (let i = start; i < response.length; i++) {
            if (response[i] === '{') depth++;
            if (response[i] === '}') depth--;
            if (depth === 0) {
              jsonStr = response.slice(start, i + 1);
              break;
            }
          }
        }
      }

      if (!jsonStr) throw new Error('JSON not found in LLM response');

      const parsed = JSON.parse(jsonStr);

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

  /**
   * [FIX #4] stdin paused 모드 해결 + autoMode 지원
   * - autoMode: 타임아웃만 대기 (CI/헤드리스 환경)
   * - 비-autoMode: stdin resume() → flowing 전환 후 data 이벤트 대기
   */
  private async waitForUserAction(timeoutMs: number): Promise<void> {
    if (this.autoMode) {
      await new Promise(resolve => setTimeout(resolve, timeoutMs));
      return;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try { process.stdin?.pause(); } catch { /* ignore */ }
          resolve();
        }
      };
      const timer = setTimeout(cleanup, timeoutMs);

      if (process.stdin && typeof process.stdin.resume === 'function') {
        process.stdin.setEncoding('utf8');
        process.stdin.resume();  // paused → flowing 전환
        process.stdin.once('data', cleanup);
      } else {
        // stdin unavailable — fallback to timeout
        cleanup();
      }
    });
  }

  /**
   * [FIX #6] safe JSON 파싱 — 비-JSON body 대응
   * [REDTEAM] 반환 타입을 Record<string, unknown>으로 명시 (strict mode 대응)
   */
  private safeParseJSON(text: string): Record<string, unknown> {
    try { return JSON.parse(text) as Record<string, unknown>; }
    catch { return { _unparsed: text }; }
  }
}
