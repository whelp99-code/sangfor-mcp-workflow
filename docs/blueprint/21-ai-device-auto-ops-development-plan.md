# AI Device Auto Ops — 상세 개발 계획서

**작성일**: 2026-06-17  
**버전**: v1.0  
**범위**: Phase 0(Level 0-2), Phase 1(Level 3-4), Phase 2(Level 5)

---

## 1. 개발 목표

AI가 Sangfor 장비 설정을 직접 수행할 수 있도록 다음 운영 루프를 구현한다.

```text
의도 분석 -> 상태 수집 -> 매뉴얼/Playbook 근거화 -> 계획 생성 -> 승인 -> 실행 -> 검증 -> evidence -> 학습
```

기존 소스는 최대한 재사용한다.

| 기존 모듈 | 활용 방향 |
|-----------|-----------|
| `packages/workflow-engine/src/sangfor-auto-config.ts` | Playwright UI adapter로 축소/안정화 |
| `packages/workflow-engine/src/device-verifier.ts` | postcheck/diff verifier로 확장 |
| `packages/workflow-engine/src/approval-manager.ts` | risk gate로 확장 |
| `packages/workflow-engine/src/execution-logger.ts` | evidence writer로 확장 |
| `packages/workflow-engine/src/manual-scenario-extractor.ts` | manual -> playbook 변환의 초안 도구 |
| `packages/workflow-engine/src/rag-indexer.ts` | playbook 근거 문서 검색 |
| `packages/health-checker` | snapshot collector로 확장 |
| `packages/wiki-sync` | 성공/실패 교훈과 evidence 동기화 |
| `apps/operator-console` | 계획 검토/승인/실행 현황 UI |
| `apps/mcp-server` | 고수준 AI tool surface |

---

## 2. Phase 0 — Level 0-2 통합

### 목표

읽기 전용 상태 수집, 실행 계획 생성, 승인 후 설정 실행, 설정 후 검증까지의 최소 안전 루프를 완성한다.

### 포함 레벨

| Level | 구현 내용 |
|-------|-----------|
| Level 0 | 장비 snapshot 수집 |
| Level 1 | 목표 상태 기반 plan 생성 |
| Level 2 | 승인된 plan 실행 및 postcheck |

### 주요 산출물

| 산출물 | 경로 |
|--------|------|
| Device/Capability 타입 | `packages/workflow-engine/src/device-model.ts` |
| Snapshot 타입/collector | `packages/health-checker/src/device-snapshot.ts` |
| Playbook schema/registry | `packages/workflow-engine/src/playbook-registry.ts` |
| Operation planner | `packages/workflow-engine/src/operation-planner.ts` |
| Approval gate 확장 | `packages/workflow-engine/src/approval-manager.ts` |
| Verifier 확장 | `packages/workflow-engine/src/device-verifier.ts` |
| MCP tools | `apps/mcp-server/src/index.ts` |
| Operator API/UI | `apps/operator-console/src/server.ts` |
| Evidence 문서 | `docs/evidence/` 또는 `docs/reports/` |

### 구현 항목

1. DeviceSnapshot 스키마 정의
2. Sangfor 제품군별 capability model 정의
3. Manual scenario를 playbook schema로 변환
4. 사용자 요청을 OperationPlan으로 변환
5. 모든 변경 작업 전 snapshot 필수화
6. 위험도별 approval requirement 생성
7. 승인된 step만 실행
8. postcheck와 expectedChange 검증
9. execution evidence Markdown 생성
10. MCP 고수준 tool 추가

### Phase 0 완료 조건

- `get_device_snapshot`이 read-only로 동작한다.
- `plan_configuration_change`가 precheck, steps, postcheck, rollback을 포함한다.
- `validate_operation_plan`이 누락된 입력과 위험도를 반환한다.
- 승인되지 않은 `config_change` step은 실행되지 않는다.
- 실행 후 전후 diff와 evidence 문서가 생성된다.
- 최소 1개 기능 예제에 대해 end-to-end dry-run이 가능하다.

### 검증 명령

```bash
pnpm test
pnpm run lint
pnpm run build
```

### 실장비 검증

실장비 변경 전에는 dry-run만 수행한다.

```bash
pnpm run health:check -- --product EPP --target <target-url>
pnpm run dev:mcp
```

변경 실행은 사용자 승인 후 별도 진행한다.

---

## 3. Phase 1 — Level 3-4 통합

### 목표

저위험 변경은 정책 기반으로 자동 실행하고, 실패 시 상태를 재수집해 재계획하는 폐쇄 루프를 구현한다.

### 포함 레벨

| Level | 구현 내용 |
|-------|-----------|
| Level 3 | 저위험 autopilot |
| Level 4 | closed-loop 재계획/재검증 |

### 주요 산출물

| 산출물 | 경로 |
|--------|------|
| Autopilot policy | `packages/workflow-engine/src/autopilot-policy.ts` |
| Closed-loop runner | `packages/workflow-engine/src/closed-loop-runner.ts` |
| Drift detector | `packages/workflow-engine/src/config-drift-detector.ts` |
| Retry/replan strategy | `packages/workflow-engine/src/replan-strategy.ts` |
| Operator dashboard 확장 | `apps/operator-console/src/server.ts` |
| Wiki learning 확장 | `packages/wiki-sync/src/auto-pipeline.ts` |

### 구현 항목

1. 저위험 작업 allowlist 정의
2. 자동 실행 가능 조건 정의
3. 실행 실패 시 snapshot 재수집
4. expectedChange 미충족 시 replan 생성
5. 동일 실패 반복 시 자동 중단
6. high-risk step은 자동 승인 금지
7. 성공/실패 사례를 playbook 개선 후보로 저장
8. Operator Console에서 plan, 실행 로그, 재계획 이력을 조회

### 자동 실행 허용 예시

| 작업 | 조건 |
|------|------|
| read-only snapshot | 항상 허용 |
| dry-run plan 생성 | 항상 허용 |
| 임시 report/evidence 생성 | 외부 전송 없음 |
| 저위험 객체 생성 | 충돌 없음, rollback 있음, 정책 allowlist 포함 |

### 자동 실행 금지 예시

| 작업 | 이유 |
|------|------|
| 기존 정책 삭제 | 서비스 영향 가능 |
| 외부 접근 허용 정책 생성 | 보안 영향 |
| 인증 서버 변경 | 로그인 장애 가능 |
| 운영 장비 재시작 | 서비스 중단 |

### Phase 1 완료 조건

- low-risk operation은 승인 없이 실행된다.
- high-risk operation은 항상 approval queue로 이동한다.
- 실패 후 snapshot 재수집과 replan이 자동 수행된다.
- 같은 실패가 2회 이상 반복되면 자동 중단된다.
- 모든 replan 사유가 evidence에 남는다.

---

## 4. Phase 2 — Level 5

### 목표

장애 감지 후 자동 진단, 복구 계획, 승인 기반 복구 실행, 롤백까지 지원한다.

### 포함 레벨

| Level | 구현 내용 |
|-------|-----------|
| Level 5 | self-healing operations |

### 주요 산출물

| 산출물 | 경로 |
|--------|------|
| Incident detector | `packages/workflow-engine/src/incident-detector.ts` |
| Remediation planner | `packages/workflow-engine/src/remediation-planner.ts` |
| Rollback manager | `packages/workflow-engine/src/rollback-manager.ts` |
| Break-glass policy | `packages/workflow-engine/src/breakglass-policy.ts` |
| Incident evidence report | `docs/reports/` |

### 구현 항목

1. health-checker의 정기 점검 결과를 incident 후보로 변환
2. 장애 유형 분류
3. 원인 후보와 복구 playbook 매핑
4. 복구 전 impact 분석
5. rollback plan 생성
6. 승인 후 복구 실행
7. 복구 후 서비스 정상성 검증
8. 실패 시 rollback 또는 수동 조치 요청

### Phase 2 완료 조건

- 정기 점검 결과에서 incident 후보를 생성한다.
- 복구 작업은 승인 전 실행되지 않는다.
- 복구 plan은 rollback과 impact 분석을 포함한다.
- 복구 성공/실패 timeline이 evidence로 남는다.
- 수동 조치 필요 여부가 명확히 표시된다.

---

## 5. 공통 품질 기준

### 코드 기준

- TypeScript strict 유지
- `any` 사용 금지. 불가피하면 이유 주석 필요
- adapter와 planner 분리
- UI 자동화는 `sangfor-auto-config` 내부로 제한
- snapshot 없는 설정 실행 금지
- approval 우회 금지

### 테스트 기준

| 테스트 | 범위 |
|--------|------|
| Unit | planner, risk gate, playbook validator |
| Integration | snapshot -> plan -> approval -> execution dry-run |
| E2E | operator-console approval flow |
| Regression | 기존 pipeline, health-check, wiki-sync |

### Evidence 기준

각 실행은 다음 항목을 남긴다.

```text
- 실행 ID
- 요청 원문
- 장비/제품/버전
- 수집 snapshot 요약
- 사용한 playbook과 근거 문서
- precheck 결과
- 승인 상태
- 실행 step 결과
- postcheck 결과
- 전후 diff
- 실패 원인
- 후속 조치
```

---

## 6. Cursor + opencode 작업 방식

### opencode 우선 작업

- 타입/인터페이스 초안
- playbook schema 초안
- unit test skeleton
- MCP tool handler 초안
- Markdown evidence template 초안

### Cursor 우선 작업

- 기존 코드와 통합
- 타입 오류 수정
- 테스트 보강
- Operator Console API/UI 연결
- Playwright adapter 안정화

### Codex 최종 검토 기준

- Phase 목표와 PR scope 일치 여부
- 위험 작업 승인 누락 여부
- 실장비 변경 전 read-only snapshot 강제 여부
- postcheck/evidence 누락 여부
- 기존 기능 회귀 여부
- `pnpm test`, `pnpm run lint`, `pnpm run build` 결과

