# 수정안: sangfor-auto-config.ts (Playwright 실장비 자동화)

## 이슈 #1: 해시 라우트 `##` 중복 (L568-577)
- **문제**: `navigateToHash`에서 `hashRoute`가 `#/policy/...`로 시작. `page.evaluate`에서 `window.location.hash = '#/policy/...'` 설정 시 hash가 `##policy/...`가 됨 (hash 자체에 `#` 포함)
- **수정**: hashRoute에서 선행 `#` 제거 후 설정

```typescript
// Before
await page.evaluate((hash: string) => { window.location.hash = hash; }, hashRoute);

// After
const cleanHash = hashRoute.startsWith('#') ? hashRoute.slice(1) : hashRoute;
await page.evaluate((hash: string) => { window.location.hash = hash; }, cleanHash);
```

## 이슈 #2: `actionSelect` label 파라우터 무시 (L646-658)
- **문제**: `opts.label`을 받지만 사용하지 않음. 페이지의 **첫 번째** `<select>`에 값을 적용 → 의도하지 않은 select가 변경됨
- **수정**: label 기반으로 해당 select를 찾아서 적용

```typescript
// Before
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

// After
private async actionSelect(page: Page, action: SettingAction): Promise<void> {
  const found = await page.evaluate((opts: { label: string; value: string; selector?: string }) => {
    let targetSelect: HTMLSelectElement | null = null;

    // 1) 셀렉터 우선
    if (opts.selector) {
      targetSelect = document.querySelector(opts.selector) as HTMLSelectElement | null;
    }

    // 2) 라벨 기반 탐색
    if (!targetSelect) {
      const labels = Array.from(document.querySelectorAll('label, span, td, div'));
      const label = labels.find(l => (l.textContent?.trim() ?? '').includes(opts.label));
      if (label) {
        // 라벨의 형제/부모에서 select 찾기
        targetSelect = label.parentElement?.querySelector('select') as HTMLSelectElement | null
          ?? label.closest('tr')?.querySelector('select') as HTMLSelectElement | null
          ?? label.closest('form')?.querySelector('select') as HTMLSelectElement | null;
      }
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
  }, { label: action.label, value: action.value as string, selector: action.selector });

  if (!found) log.warn(`셀렉트 미발견 또는 옵션 없음: ${action.label} = ${action.value}`);
}
```

## 이슈 #3: CDP 연결 리소스 누수 (L465-508, L512-532)
- **문제**: `applyFromAuditItems`에서 루프마다 `applyConfig` → `connectToDevice` 호출. 이전 CDP 연결 미종료 → 브라우저 프로세스 고갈
- **수정**: 연결을 한 번만 수립하고 재사용. `close()` 메서드 추가

```typescript
// 클래스 필드 추가
private currentPage: Page | null = null;

// connectToDevice 수정 — 재사용 로직
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

    const host = targetUrl.split('://')[1]?.split('/')[0] ?? '';
    const existingPage = context.pages().find(p => p.url().includes(host));
    this.currentPage = existingPage ?? context.pages()[0] ?? await context.newPage();
    return this.currentPage;
  } catch {
    throw new Error(
      `Chrome CDP 연결 실패: ${cdpEndpoint}\n` +
      `Chrome이 --remote-debugging-port=${this.cdpPort}로 실행 중인지 확인하세요.`,
    );
  }
}

// close() 메서드 추가
async close(): Promise<void> {
  if (this.browser?.isConnected()) {
    await this.browser.close().catch(() => {});
  }
  this.browser = null;
  this.currentPage = null;
}
```

## 이슈 #4: `isVisible({ timeout })` 잘못된 API (L539-544)
- **문제**: Playwright Locator `isVisible()`는 파라우터를 받지 않음. `.catch(() => false)`가 에러를 마스킹
- **수정**: `isVisible()`은 인자 없이 호출, timeout은 별도 처리

```typescript
// Before
if (await captchaImg.isVisible({ timeout: 2000 }).catch(() => false)) {

// After
const captchaExists = await captchaImg.count() > 0;
if (captchaExists && await captchaImg.isVisible()) {
```

## 이슈 #5: 로그인 감지 로직 불안정 (L357)
- **문제**: URL 문자열 포함 검사로 로그인 여부 판단 — false positive/negative 가능
- **수정**: 로그인 폼 요소 존재 여부로 판단

```typescript
// Before
const isLoggedIn = !(page.url().includes('login') || page.url() === credentials.targetUrl + '/');

// After
const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
const isLoggedIn = !hasLoginForm;
```

## 이슈 #6: 설정 전체 실패 시에도 Save 버튼 클릭 (L393-399)
- **문제**: 모든 설정 액션이 실패했는데도 Save 클릭 → 불필요한 요청/상태 변경 위험
- **수정**: 성공한 설정이 있을 때만 저장

```typescript
// Before
if (config.settings.length > 0) {
  await this.clickSaveButton(page);

// After
if (Object.keys(appliedSettings).length > 0) {
  await this.clickSaveButton(page);
```

## 이슈 #7: `about:blank`에서 `new URL()` 예외 (L569)
- **문제**: `page.url()`이 `about:blank` 반환 시 `new URL()` 크래시
- **수정**: URL 유효성 검사 추가

```typescript
// Before
const baseUrl = new URL(page.url()).origin;

// After
const currentUrl = page.url();
if (!currentUrl || currentUrl === 'about:blank') {
  throw new Error('페이지가 아직 로드되지 않았습니다. about:blank 상태입니다.');
}
const baseUrl = new URL(currentUrl).origin;
```

## 이슈 #8: React SPA에서 `input.value` 직접 할당 (L660-673)
- **문제**: React/Vue 등 프레임워크는 `input.value = x` 감지를 못 함 → 상태 업데이트 안 됨
- **수정**: Playwright `fill()` 사용으로 변경

```typescript
// Before
private async actionInput(page: Page, action: SettingAction): Promise<void> {
  await page.evaluate((opts: { label: string; value: string }) => {
    // ... DOM 직접 조작
  }, { label: action.label, value: action.value as string });
}

// After
private async actionInput(page: Page, action: SettingAction): Promise<void> {
  // 셀렉터가 있으면 Playwright fill 사용
  if (action.selector) {
    const locator = page.locator(action.selector);
    if (await locator.count() > 0) {
      await locator.fill(action.value as string);
      return;
    }
  }

  // 라벨 기반: input 찾기 → fill
  const inputLocator = await this.findInputByLabel(page, action.label);
  if (inputLocator) {
    await inputLocator.fill(action.value as string);
  } else {
    log.warn(`입력 필드 미발견: ${action.label}`);
  }
}

private async findInputByLabel(page: Page, label: string): Promise<Locator | null> {
  // Playwright getByLabel 시도
  try {
    const loc = page.getByLabel(label, { exact: false });
    if (await loc.count() > 0) return loc.first();
  } catch { /* fallback */ }

  // 수동 탐색
  const handle = await page.evaluateHandle((text: string) => {
    const labels = Array.from(document.querySelectorAll('label, span'));
    const labelEl = labels.find(l => (l.textContent?.trim() ?? '').includes(text));
    if (labelEl) {
      const forAttr = labelEl.getAttribute('for');
      if (forAttr) return document.getElementById(forAttr);
      return labelEl.parentElement?.querySelector('input, textarea');
    }
    return null;
  }, label);

  const element = handle.asElement();
  if (element) return new Locator(page, element);
  return null;
}
```

## 이슈 #9: `applyFromAuditItems`에서 시나리오 ID 매핑 비효율 (L474-476)
- **문제**: 매번 `Object.keys`로 전체 순회
- **수정**: 역방향 맵 사전 구축

```typescript
// Before
const scenarioId = Object.keys(CONFIG_SCENARIOS).find(
  k => CONFIG_SCENARIOS[k] === config,
);

// After
// 클래스 초기화 시 역방향 맵 구축
private configToId: Map<SangforConfig, string>;

constructor(options?: { cdpPort?: number; outputDir?: string }) {
  // ... existing code ...
  this.configToId = new Map(
    Object.entries(CONFIG_SCENARIOS).map(([id, cfg]) => [cfg, id]),
  );
}

// 사용 시
const scenarioId = this.configToId.get(config);
```

## 이슈 #10: `captureScreenshot`에서 `path` 변수명 충돌 (L712-717)
- **문제**: `node:path` 모듈 import와 동일한 이름의 지역 변수 → 혼동 가능
- **수정**: 변수명 변경

```typescript
// Before
const path = join(this.outputDir, `${name}_${Date.now()}.png`);

// After
const filePath = join(this.outputDir, `${name}_${Date.now()}.png`);
await page.screenshot({ path: filePath, fullPage: false });
return filePath;
```
