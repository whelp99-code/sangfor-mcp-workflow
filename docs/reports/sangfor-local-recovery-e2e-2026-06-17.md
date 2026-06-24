# Sangfor Local Recovery and Read-only E2E Report

검증 일시: 2026-06-17 00:38 KST

## 1. 로컬 저장소 복구

- 기존 작업 폴더를 백업으로 이동: `/Users/jmpark/Playground/sangfor-mcp-workflow.backup-20260617-003244`
- 원격 main을 fresh clone으로 재구성
- `.env`만 새 작업 폴더에 복원
- `.hermes`, `outputs`, `uploads`는 일부 파일 읽기 timeout이 있어 새 작업 폴더로 복원하지 않고 백업 폴더에 보존
- `pnpm install` 재실행 완료
- `git status --short --branch` 정상 응답 확인

## 2. 검증 결과

| 항목 | 결과 | 비고 |
|---|---:|---|
| `pnpm install` | PASS | 8개 workspace, 246 packages 설치 |
| `pnpm test` | PASS | 4 files, 44 tests |
| `pnpm lint` | FAIL | ESLint 9 flat config 파일 부재 |
| `pnpm build` | FAIL | 기존 `device-verifier`, `manual-scenario-extractor`, `sangfor-intelligence`, barrel export 오류 |
| 수정 파일 문법 검증 | PASS | `sangfor-api-discovery.ts`, `run-sangfor-readonly-e2e.ts` diagnostics 0 |

## 3. Read-only Sangfor DOM/HAR E2E

새 스크립트:

```bash
pnpm run e2e:sangfor -- --product EPP --target https://211.53.60.26 --duration-ms 3000
```

결과:

- read-only 실행 성공
- 설정 저장/적용/삭제/배포 동작 없음
- 로그인 폼 감지 및 credential 입력 시도
- 대상 화면: Hyper-Converged Infrastructure 로그인 페이지
- 로그인 결과: 실패 메시지 확인 (`Username or password is incorrect. You have 3 attempts left.`)
- DOM 요약: forms 1, passwordInputs 1, inputs 5, buttons 3
- HAR 파싱: 19개 요청, GET/POST 포함

생성된 로컬 증거:

- `outputs/sangfor-readonly-e2e/epp-2026-06-16T15-38-53-115Z.json`
- `outputs/sangfor-readonly-e2e/epp-2026-06-16T15-38-53-115Z.har`
- `outputs/sangfor-readonly-e2e/epp-2026-06-16T15-38-53-115Z.png`

## 4. 네트워크 확인

| URL | 결과 |
|---|---|
| `https://10.80.1.106` | 443 timeout |
| `https://10.80.1.108` | 443 timeout |
| `https://10.80.1.107` | 443 timeout |
| `https://211.53.60.26` | HTTP 302 to `./login` |

## 5. 남은 리스크

- 현재 `.env`의 EPP 계정은 `https://211.53.60.26` HCI 로그인에 맞지 않는 것으로 보임
- 실제 HCI 계정 또는 제품별 올바른 target URL이 필요
- `pnpm build` green을 위해 기존 TypeScript 오류 정리 필요
- ESLint 9용 `eslint.config.js` 추가 또는 ESLint 8 고정 필요
