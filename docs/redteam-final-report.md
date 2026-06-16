# 🔴 레드팀 검증 결과 종합 + 최종 수정안

## 검증 완료: 2026-06-16 15:05

---

# Part 1: `sangfor-api-discovery.ts` (HAR 캡처 + LLM API 역공학)

## 레드팀 판정 요약

| 이슈 | 수정안 판정 | 레드팀 최종 |
|------|-----------|-----------|
| #1 headless 하드코딩 | ✅ OK | ✅ |
| #2 recordHar.mode | ❌ **진짜 버그 놓침** | 🔴 `content: 'include'` → `content: 'embed'` |
| #3 goto 에러 핸들링 | ✅ OK | ✅ |
| #4 stdin 의존 | ⚠️ 불완전 | ⚠️ stdin paused 모드 미해결 |
| #5 /api 경로 필터 | ⚠️ **dead code** | 🔴 LLM에 전체 entries 전달, 필터 미사용 |
| #6 JSON.parse 크래시 | ✅ OK | ✅ |
| #7 정규식 과매칭 | ✅ OK (한계 인정) | ✅ |
| #8 HAR 50개 제한 | ❌ **인덱스 불일치 버그** | 🔴 정렬 후 LLM 인덱스 ≠ 원본 인덱스 |
| #9 .js 노이즈 필터 | ❌ **.json API 대량 필터링** | 🔴 `.includes('.js')` → `.json` 매칭 |
| #10 SIGINT 처리 | ⚠️ 불완전 | ⚠️ async 시그널 + exit code |

## 🔴 크리티컬 레드팀 발견사항

### 발견 1: `recordHar.content: 'include'`는 유효하지 않은 값
- Playwright 1.61.0 허용값: `'omit' | 'embed' | 'attach'`
- `'include'` → 컴파일 에러 또는 무시됨
- **→ `content: 'embed'`로 수정 필수**

### 발견 2: `mutationCandidates` / `getEndpoints`는 **dead code**
- `analyzeAPIs()`에서 필터링 결과를 `log.info`에만 사용
- 실제 LLM 분석에는 **전체 entries** 전달
- **→ 필터를 LLM 프롬프트 전달에도 적용하거나, 프롬프트에 Sangfor 경로 힌트 추가**

### 발견 3: HAR 정렬 → 인덱스 불일치 (수정안이 버그 도입)
- `buildAnalysisPrompt`에서 mutation-first 정렬 후 제한
- `parseLLMResponse`에서 원본 entries로 인덱스 조회
- **→ 정렬 시 원본 인덱스 보존 필수**

### 발견 4: `.js` 노이즈 패턴 → `.json` API 대량 필터링
- `url.includes('.js')` → `.json` URL도 매칭됨
- **→ `urlPath.endsWith('.js')` + `.json` 예외 처리**

---

# Part 2: `sangfor-auto-config.ts` (Playwright 실장비 자동화)

## 레드팀 판정 요약

| 이슈 | 수정안 판정 | 레드팀 최종 |
|------|-----------|-----------|
| #1 해시 ## 중복 | ✅ OK | ✅ |
| #2 actionSelect label | ⚠️ 불완전 | ⚠️ ExtJS 드롭다운 미대응 |
| #3 CDP 연결 누수 | ✅ OK | ✅ (close() finally 추가 제안) |
| #4 isVisible timeout | ⚠️ 불완전 | ⚠️ waitFor로 대기 의도 살리기 |
| #5 로그인 감지 | ⚠️ 불완전 | ⚠️ password+button 조합 |
| #6 Save 조건 | ✅ OK | ✅ |
| #7 about:blank | ⚠️ 불완전 | ⚠️ 다른 비정상 URL도 커버 |
| #8 React input | ❌ **new Locator() 컴파일 에러** | 🔴 Locator는 class가 아닌 interface |
| #9 ID 매핑 비효율 | ✅ OK | ✅ |
| #10 path 변수명 | ✅ OK | ✅ |

## 🔴 크리티컬 레드팀 발견사항

### 발견 5: `new Locator(page, element)` — 컴파일 에러
- Playwright `Locator`는 **interface**, class가 아님
- `new Locator()` 생성자 사용 불가
- **→ `element.fill()` 직접 사용 또는 `page.locator()` 래핑**

### 발견 6: Sangfor UI는 ExtJS 기반 — `<select>` 탐색 불가
- Sangfor EPP/IAG는 ExtJS `.x-combo-list`, `.x-boundlist` 사용
- `document.querySelectorAll('select')`로는 탐색 불가
- **→ ExtJS 커스텀 드롭다운 폴백 로직 필요**

### 발견 7: `isVisible({ timeout: 2000 })`은 deprecated이지만 에러는 아님
- Playwright 1.61.0에서 `timeout` 옵션은 받지만 **ignored**
- 컴파일 에러는 아니나 2초 대기 없이 즉시 반환
- **→ `waitFor({ state: 'visible', timeout })` 사용**

---

# 최종 수정안 (레드팀 피드백 반영)

## `sangfor-api-discovery.ts` 수정 우선순위

### 🔴 P0 (즉시 수정 — 동작 불가)

1. **recordHar content 수정**: `'include'` → `'embed'`
2. **HAR 인덱스 보존**: 정렬 시 원본 인덱스 유지
3. **`.js` → `.endsWith` + `.json` 예외**

### 🟠 P1 (긴급 수정 — 부분 동작)

4. **dead code 해소**: LLM에 필터된 entries 전달 또는 프롬프트에 경로 힌트
5. **stdin paused 모드**: `process.stdin.resume()` 추가
6. **SIGINT exit code**: `128 + signal` + async 안전 처리

### 🟡 P2 (권장 수정 — 안정성)

7. headless 옵션화 ✅
8. goto 에러 핸들링 ✅
9. JSON.parse 안전 처리 ✅
10. 정규식 개선 ✅

---

## `sangfor-auto-config.ts` 수정 우선순위

### 🔴 P0 (즉시 수정 — 컴파일/동작 불가)

1. **`new Locator()` 제거**: `element.fill()` 직접 사용
2. **해시 ## 중복**: `cleanHash` 로직
3. **CDP 연결 누수**: 연결 재사용 + `close()` 메서드

### 🟠 P1 (긴급 수정 — 오동작)

4. **actionSelect**: label 사용 + ExtJS 폴백
5. **isVisible**: `waitFor` 사용
6. **로그인 감지**: password + button 조합

### 🟡 P2 (권장 수정 — 안정성)

7. Save 조건 개선 ✅
8. about:blank 처리 ✅
9. React input fill() ✅ ( Locator 수정 후 )
10. path 변수명 ✅

---

## 아키텍처 레벨 레드팀 권고

> **두 모듈 모두 실제 Sangfor 장비에서 한 번도 테스트되지 않은 코드입니다.**
>
> 1. **Sangfor UI가 ExtJS 기반**이라는 점을 고려하면, 현재 DOM 쿼리 방식(`querySelectorAll('select')`, `querySelectorAll('label')`)은 **대부분의 Sangfor 제품에서 동작하지 않을 것**입니다.
>
> 2. **HAR 캡처 → LLM 분석** 파이프라인의 핵심 전제가 "HAR 파일이 생성된다"인데, `content: 'include'` 오류로 인해 **파일이 비어있거나 생성되지 않을 수 있습니다**.
>
> 3. **가장 중요한 수정**: 실제 Sangfor 장비(EPP 10.80.1.106)에서 Playwright CDP로 접속 → DOM 구조 확인 → selector 검증 → 그 후 코드 수정. 코드만으로는 한계가 있습니다.
