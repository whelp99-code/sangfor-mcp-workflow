# 수정안: sangfor-api-discovery.ts (HAR 캡처 + LLM API 역공학)

## 이슈 #1: `headless: false` 하드코딩 (L117)
- **문제**: CI/서버 환경에서 실행 불가
- **수정**: 생성자 옵션에 `headless` 추가, 기본값 `true`

```typescript
// Before
const browser = await chromium.launch({ headless: false });

// After
constructor(options?: {
  llmEndpoint?: string;
  llmApiKey?: string;
  llmModel?: string;
  headless?: boolean;  // ← 추가
})

const browser = await chromium.launch({ headless: this.headless });
```

## 이슈 #2: `recordHar.mode: 'full'` 잘못된 옵션 (L120-124)
- **문제**: Playwright HAR recordHar에 `mode` 옵션 없음. HAR은 context.close() 시에만 디스크에 기록됨
- **수정**: `mode` 제거, `content: 'include'`만 유지

```typescript
// Before
recordHar: {
  path: harPath,
  content: 'include',
  mode: 'full',        // ← Playwright에 없는 옵션
},

// After
recordHar: {
  path: harPath,
  content: 'include',
},
```

## 이슈 #3: `page.goto()` 에러 핸들링 없음 (L128)
- **문제**: 타겟 서버 접속 실패 시 크래시
- **수정**: try-catch + 타임아웃 명시

```typescript
// Before
await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });

// After
try {
  await page.goto(config.targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
} catch (err) {
  await context.close();
  await browser.close();
  throw new Error(`타겟 접속 실패: ${config.targetUrl} — ${err}`);
}
```

## 이슈 #4: `waitForUserAction` stdin 의존 (L130-135, L465-473)
- **문제**: 헤드리스/CI 환경에서 stdin 입력 불가 → 타임아웃까지 무한 대기
- **수정**: `autoMode` 옵션 추가. autoMode=true면 타임아웃만 대기, stdin 리스너 없음

```typescript
// 생성자 옵션 추가
autoMode?: boolean;

// waitForUserAction 수정
private async waitForUserAction(timeoutMs: number): Promise<void> {
  if (this.autoMode) {
    // 자동 모드: 타임아웃만 대기
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
    return;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        process.stdin?.removeListener?.('data', onData);
        resolve();
      }
    };
    const onData = () => cleanup();
    const timer = setTimeout(cleanup, timeoutMs);
    process.stdin?.once?.('data', onData);
  });
}
```

## 이슈 #5: `/api` 경로 필터 누락 (L207-215)
- **문제**: Sangfor 콘솔은 `/cgi-bin/`, `/management/`, `/rest/`, `/auth/` 등 다양한 API 경로 사용
- **수정**: Sangfor 특화 경로 패턴 추가

```typescript
// Before
e.request.path.includes('/api'),

// After
const API_PATH_PATTERNS = ['/api', '/cgi-bin', '/management', '/rest', '/auth', '/v1', '/v2', '/webapi'];

const mutationCandidates = entries.filter(e =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.request.method) &&
  API_PATH_PATTERNS.some(p => e.request.path.includes(p)),
);
```

## 이슈 #6: `JSON.parse(body)` 비-JSON body 크래시 (L253)
- **문제**: form-encoded, multipart 등 비-JSON body에서 예외 발생
- **수정**: safe JSON 파싱

```typescript
// Before
payload: best.body ? JSON.parse(best.body) : undefined,

// After
payload: best.body ? this.safeParseJSON(best.body) : undefined,

// 헬퍼 추가
private safeParseJSON(text: string): unknown {
  try { return JSON.parse(text); }
  catch { return { _raw: text }; }
}
```

## 이슈 #7: 정규식 과매칭 (L406)
- **문제**: `/\{[\s\S]*\}/` — LLM 응답에 JSON 외 중괄호가 있으면 과매칭
- **수정**: 마크다운 코드 블록 우선 추출 + greedy→non-greedy

```typescript
// Before
const jsonMatch = response.match(/\{[\s\S]*\}/);

// After
// 1) 코드 블록 내 JSON 우선
const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
const jsonStr = codeBlockMatch
  ? codeBlockMatch[1].trim()
  : (() => {
      // 2) 중괄호 매칭 (중첩 지원)
      const start = response.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < response.length; i++) {
        if (response[i] === '{') depth++;
        if (response[i] === '}') depth--;
        if (depth === 0) return response.slice(start, i + 1);
      }
      return response.slice(start);
    })();

if (!jsonStr) throw new Error('JSON not found in LLM response');
const parsed = JSON.parse(jsonStr);
```

## 이슈 #8: HAR 엔트리 50개 제한 (L330)
- **문제**: 중요 API 누락 가능
- **수정**: 설정 가능한 limit, mutation 우선 정렬

```typescript
// Before
entries.slice(0, 50)

// After
const MAX_ENTRIES = this.maxPromptEntries ?? 80;
// mutation 우선 정렬 후 제한
const sorted = [...entries].sort((a, b) => {
  const aIsMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(a.request.method) ? 0 : 1;
  const bIsMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(b.request.method) ? 0 : 1;
  return aIsMutation - bIsMutation;
});
const limited = sorted.slice(0, MAX_ENTRIES);
```

## 이슈 #9: `isNoiseRequest`에 `.js` 누락 (L318-327)
- **문제**: JS 파일 요청이 API 후보로 포함됨
- **수정**: `.js`, `.mjs` 패턴 추가

```typescript
const noisePatterns = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf',
  '.css', '.map', '.js', '.mjs',  // ← 추가
  'google-analytics', 'googletagmanager', 'hotjar', 'mixpanel', 'segment',
  'facebook.net', 'doubleclick.net', 'ads.', 'tracking.',
];
```

## 이슈 #10: `process.exit` 시 HAR 미저장 가능 (L138-147)
- **문제**: 프로세스 강제 종료 시 context.close() 호출 안 됨 → HAR 파일 비어있음
- **수정**: process signal 핸들러 추가

```typescript
// captureHAR 내부, context 생성 후
const saveAndExit = async () => {
  log.warn('인터럽트 감지 — HAR 저장 중...');
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', saveAndExit);
process.on('SIGTERM', saveAndExit);

// try-finally에서 정리
try {
  // ... 기존 로직 ...
} finally {
  process.removeListener('SIGINT', saveAndExit);
  process.removeListener('SIGTERM', saveAndExit);
  await context.close();
  await browser.close();
}
```
