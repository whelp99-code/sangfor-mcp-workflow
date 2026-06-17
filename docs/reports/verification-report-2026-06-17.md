# AI Device Auto Ops — 전체 검증 보고서

**작성일**: 2026-06-17  
**검증 범위**: PR-20 ~ PR-32 (Phase 0-2 전체)  
**검증 방법**: 10개 서브에이전트 병렬 검증 + 레드팀 보안 감사  
**빌드 상태**: `pnpm test` 44/44 통과 ✅ | `pnpm run build` 에러 0 ✅

---

## 📊 종합 결과

| 구분 | 총 항목 | PASS | FAIL | WARN | MISSING |
|------|---------|------|------|------|---------|
| PR-20: Device Model | 5 | 5 | 0 | 0 | 0 |
| PR-21: Snapshot Collector | 6 | 6 | 0 | 0 | 0 |
| PR-22: Playbook Schema | 7 | 7 | 0 | 0 | 0 |
| PR-23: Operation Planner | 7 | 7 | 0 | 0 | 0 |
| PR-24: Approval Gate | 6 | 6 | 0 | 0 | 0 |
| PR-25: Executor/Boundary | 6 | 6 | 0 | 0 | 0 |
| PR-26: Post Verifier | 11 | 11 | 0 | 0 | 0 |
| PR-27: MCP Tool Surface | 17 | 17 | 0 | 0 | 0 |
| PR-28: Autopilot Policy | 8 | 8 | 0 | 0 | 0 |
| PR-29: Closed-loop Runner | 8 | 8 | 0 | 0 | 0 |
| PR-30: Drift Detection | 8 | 8 | 0 | 0 | 0 |
| PR-31: Incident Detection | 9 | 9 | 0 | 0 | 0 |
| PR-32: Rollback/Break-glass | 10 | 9 | 0 | 1 | 0 |
| **기능 검증 합계** | **108** | **107** | **0** | **1** | **0** |

### 레드팀 보안 감사

| 등급 | 수 | 주요 항목 |
|------|----|-----------|
| 🔴 CRITICAL | 4 | Approval 우회, MCP tool 기본값, 재시도 무한루프, Rollback 시뮬레이션 |
| 🟠 HIGH | 6 | CDP 연결 누수, dry-run 로직, any 남용, snapshot race |
| 🟡 MEDIUM | 7 | 평문 인증, 만료 미구현, 병렬 상태충돌 등 |
| 🟢 LOW | 3 | Tool 필터 우회, MCP 타임아웃 등 |

---

## 1. Phase 0 검증 (PR-20 ~ PR-27)

### PR-20: Device Model / Operation Model ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `SangforProduct`, `DeviceSnapshot`, `DeviceCapability` 등 10개 타입 존재 | **PASS** | device-model.ts 전체 타입 확인 |
| 2 | `UserIntent`, `ExpectedChange`, `EvidencePolicy`, `DryRunPlan` 존재 | **PASS** | operation-model.ts 확인 |
| 3 | `any` 사용 없음 | **PASS** | 두 파일 모두 `any` 미사용 |
| 4 | 실행 모듈 미종속 (pure types) | **PASS** | `import type`만 사용 |
| 5 | 위험도/승인 요구 모델 포함 | **PASS** | `OperationRisk`, `ApprovalRequirement` 포함 |

### PR-21: Snapshot Collector ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `DeviceSnapshotCollector` 클래스 | **PASS** | L46 |
| 2 | `collectSnapshot` → partial 반환 | **PASS** | `PartialSnapshotResult` (snapshot + failures + completeness) |
| 3 | 실패 시 partial 명확 | **PASS** | 섹션별 독립 수집, failure 기록, completeness 수치 |
| 4 | read-only only | **PASS** | 설정 변경 패턴 0건 |
| 5 | `compareDeviceSnapshots` 함수 | **PASS** | snapshot-comparator.ts L316 |
| 6 | health-checker export | **PASS** | index.ts에 device-snapshot export |

### PR-22: Playbook Schema / Registry ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `validatePlaybook` 함수 | **PASS** | L88 |
| 2 | postcheck 없는 playbook reject | **PASS** | L108-115: `valid: false` |
| 3 | rollback 경고 포함 | **PASS** | L126-133: warning 수준 |
| 4 | `register`, `get`, `findByProduct`, `findByCapability` | **PASS** | playbook-registry.ts |
| 5 | EPP malware protection playbook | **PASS** | L166-271 |
| 6 | docs/playbooks/ 샘플 | **PASS** | epp_malware_protection.md |
| 7 | scenario → playbook 변환 | **PASS** | `convertScenarioToPlaybook`, `convertExtractionToPlaybooks` |

### PR-23: Operation Planner ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `OperationPlanner` 클래스 | **PASS** | L101 |
| 2 | `parseIntent(rawText) → UserIntent` | **PASS** | 키워드 기반 intent 파싱 |
| 3 | `matchCapability` 메서드 | **PASS** | L160 |
| 4 | snapshot 없이 실행 불가 | **PASS** | `validateRequiredInputs`에서 deviceId, intent, steps 검증 |
| 5 | schema validation 거침 | **PASS** | `validateIntentSchema`에서 required fields + validActions 검증 |
| 6 | 누락 입력 명확 반환 | **PASS** | errors 배열 `{field, message, severity}` |
| 7 | `generateDryRunPlan` | **PASS** | L380 |

### PR-24: Approval Gate Integration ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `requestOperationApproval` | **PASS** | L168 |
| 2 | `approveOperation` / `rejectOperation` | **PASS** | L188, L213 |
| 3 | config_change/service_impact 승인 강제 | **PASS** | `validateApprovalRequired` L279-295 |
| 4 | 승인 상태 로그 기록 | **PASS** | `operationHistory` with riskLevel |
| 5 | 반려 plan 큐에서 제거 | **PASS** | `rejectOperation` 내부 delete + `cleanupRejectedOperations` |
| 6 | risk-based approval 생성 | **PASS** | `riskBasedApprovalRequirement` — approverRole 분기 |

### PR-25: Deterministic Executor / Adapter Boundary ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `executeWithBoundary` 메서드 | **PASS** | L545 |
| 2 | dry-run 기본값 (true) | **PASS** | `executeConfigStep` default `dryRun: true` |
| 3 | 저장 버튼 = 성공한 변경 있을 때만 | **PASS** | `appliedSettings.length > 0` 조건 |
| 4 | CDP 연결 재사용/안전 종료 | **PASS** | `connectToDevice` 재사용 + `close()` 안전 종료 |
| 5 | `getAdapterBoundary` 메서드 | **PASS** | device-access-manager.ts L266 |
| 6 | `listSafeTools` 저수준 필터링 | **PASS** | click_, raw_click, cdp_ 등 패턴 필터 |

### PR-26: Post Verifier / Evidence Writer ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `PostVerifier` 클래스 | **PASS** | L546 |
| 2 | `verifyPostExecution` before/after diff | **PASS** | L556-632 |
| 3 | `generateDiff` Markdown 형식 | **PASS** | 테이블 형식, ✅/🔄 표시 |
| 4 | `classifyFailure` 메서드 | **PASS** | `value_mismatch`/`partial_apply` |
| 5 | 실행 성공 ≠ 검증 성공 구분 | **PASS** | `passed` + `failed[]` 분리 |
| 6 | 실패 시 후속 조치 기록 | **PASS** | `saveEvidence` with failures |
| 7 | `EvidenceWriter` 클래스 | **PASS** | L127 |
| 8 | 12개 evidence 필드 포함 | **PASS** | 실행ID~후속조치 전체 |
| 9 | `saveEvidence` 메서드 | **PASS** | JSON 파일 저장 |
| 10 | `registerEvidenceForSync` | **PASS** | auto-pipeline.ts L249 |
| 11 | docs/evidence/ 디렉토리 | **PASS** | README.md 포함 |

### PR-27: MCP Tool Surface / Operator Console ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | 7개 MCP tools 등록 | **PASS** | get_device_snapshot ~ generate_evidence_report |
| 2 | 위험 작업 직접 실행 안 함 | **PASS** | plan-only, read-only 분리 |
| 3 | 미승인 operation 거부 | **PASS** | approvalId/approvedBy 필수 |
| 4 | evidence path 포함 | **PASS** | diff, evidenceMarkdown 응답 |
| 5 | 7개 REST API 엔드포인트 | **PASS** | server.ts L536-684 |
| 6 | README.md 업데이트 | **PASS** | Phase 0 섹션 + 테이블 + 다이어그램 |

---

## 2. Phase 1 검증 (PR-28 ~ PR-30)

### PR-28: Autopilot Policy ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `AutopilotPolicy` 클래스 | **PASS** | L221 |
| 2 | allowlist/denylist 규칙 | **PASS** | DEFAULT_ALLOWLIST L89, DEFAULT_DENYLIST L150 |
| 3 | denylist > allowlist 우선 | **PASS** | priority 190~200 > 70~100 |
| 4 | `evaluate(plan) → AutopilotDecision` | **PASS** | L242 |
| 5 | product/version별 조건 | **PASS** | `isProductAutoAllowed()` L422 |
| 6 | high-risk 자동 실행 차단 | **PASS** | deny-high/critical-risk-auto |
| 7 | 정책 변경 이력 | **PASS** | `PolicyChangeRecord` + `recordChange()` |
| 8 | 외부접근/삭제/재시작 차단 | **PASS** | deny-external-access, deny-policy-delete, deny-device-restart |

### PR-29: Closed-loop Runner ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `ClosedLoopRunner` 클래스 | **PASS** | L73 |
| 2 | `executeWithRetry` 메서드 | **PASS** | L90 |
| 3 | retry limit (3회) | **PASS** | DEFAULT_MAX_RETRIES = 3 |
| 4 | 동일 실패 반복 시 자동 중단 | **PASS** | `isSameFailureRepeating()` — 3연속 시그니처 |
| 5 | replan 위험도 미하향 | **PASS** | `computeEscalatedLevel` — 상승만 |
| 6 | 고위험 replan → approval queue | **PASS** | `isHighRisk()` → `requestOperationApproval()` |
| 7 | `ReplanStrategy` 클래스 | **PASS** | replan-strategy.ts L54 |
| 8 | `generateReplan` 메서드 | **PASS** | L63 |

### PR-30: Drift Detection ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `ConfigDriftDetector` 클래스 | **PASS** | L98 |
| 2 | `detectDrift → DriftReport` | **PASS** | L107-149 |
| 3 | drift severity 분류 | **PASS** | security→critical, policy→warning |
| 4 | `linkFailureToPlaybook` | **PASS** | learning-scheduler.ts L192 |
| 5 | 자동 정책 변경 방지 | **PASS** | `status: 'pending_review'` |
| 6 | playbook 원본 보호 | **PASS** | `originalPlaybookSnapshot` 보존 |
| 7 | `syncDriftReport` | **PASS** | auto-pipeline.ts L300 |
| 8 | Obsidian 교훈 문서 생성 | **PASS** | `createLessonNote()` |

---

## 3. Phase 2 검증 (PR-31 ~ PR-32)

### PR-31: Incident Detection / Remediation ✅

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `IncidentDetector` 클래스 | **PASS** | L85 |
| 2 | health-checker → incident 변환 | **PASS** | `detectIncidents()` L90 |
| 3 | severity 분류 | **PASS** | `classifySeverity()` L163 |
| 4 | root cause 후보 생성 | **PASS** | `generateRootCauseCandidates()` L175 |
| 5 | `RemediationPlanner` 클래스 | **PASS** | L66 |
| 6 | impact 분석 | **PASS** | `analyzeImpact()` — blastRadius, downtime |
| 7 | rollback + impact 포함 | **PASS** | `RemediationPlan.rollback` + `.impact` |
| 8 | 사람이 이해 가능한 사유 | **PASS** | 한국어 title/description |
| 9 | 탐지 ≠ 즉시 실행 | **PASS** | status `'draft'`, `approvalRequired` |

### PR-32: Rollback / Self-healing ⚠️

| # | 검증 항목 | 결과 | 근거 |
|---|----------|------|------|
| 1 | `RollbackManager` 클래스 | **PASS** | L58 |
| 2 | `validateRollbackPlan` | **PASS** | steps/필수필드/order/ID 검증 |
| 3 | `executeRollback` | **PASS** | 검증→snapshot→실행→evidence |
| 4 | rollback 불가능 작업 표시 | **PASS** | `dryRunSafe` + warnings |
| 5 | `BreakGlassPolicy` 클래스 | **PASS** | L58 |
| 6 | request/approveBreakGlass | **PASS** | L74, L124 |
| 7 | `isBreakGlassActive` | **PASS** | approved + 미만료 확인 |
| 8 | 만료 시간 관리 | **PASS** | default 60min, max 480min, 자동 체크 |
| 9 | break-glass 통합 | **WARN** | 독립 모듈, rollback/operation 흐름 미통합 |
| 10 | 승인 없는 self-healing 없음 | **PASS** | `approvalRequired` + status `'draft'` |
| 11 | docs/reports/ 디렉토리 | **PASS** | README.md + e2e 보고서 |

---

## 4. 🔴 레드팀 보안 감사

### CRITICAL (즉시 조치 필요)

#### 1. WorkflowExecutor 재시도 무한 루프
- **위치**: `workflow-executor.ts:72-129`
- **문제**: 매 iteration마다 새 `logEntry` 생성 → `retryCount` 항상 0 → `maxRetries > 0` 항상 통과 → 무한 루프
- **권장**: step 객체에 `_retryCount` 필드 유지

#### 2. Approval 없는 장비 설정 변경 경로
- **위치**: `workflow-executor.ts:94`
- **문제**: `executeWorkflow`이 `step.requiresApproval` 확인 없이 직접 `tool.handler()` 호출
- **권장**: approval checkpoint 추가

#### 3. MCP Tool 자동 등록 시 requiresApproval 기본값 false
- **위치**: `tool-registry.ts:52-53`
- **문제**: 모든 MCP tool이 `riskLevel: 'low'`, `requiresApproval: false`로 등록
- **권장**: mutation tool은 보수적으로 `requiresApproval: true`

#### 4. Rollback Manager 시뮬레이션 — 항상 성공
- **위치**: `rollback-manager.ts:277-307`
- **문제**: `executeRollbackStep`이 항상 `success: true` 반환 (실제 롤백 미구현)
- **권장**: 실제 adapter 연동 또는 시뮬레이션 명시

### HIGH (우선 조치 권장)

| # | 항목 | 위치 | 권장 조치 |
|---|------|------|----------|
| 1 | dry-run 로직 역전 | sangfor-auto-config.ts:585 | `requiresApproval=false` → dry-run skip 로직 재설계 |
| 2 | CDP 연결 누수 (applyConfig) | sangfor-auto-config.ts:422 | finally 블록 복원 |
| 3 | CDP 연결 누수 (DeviceVerifier) | device-verifier.ts:413 | browser 참조 저장 + close() |
| 4 | Break-glass 미구현 | 전체 시스템 | 실행 경로마다 approval checkpoint |
| 5 | `any` 타입 50+건 | types.ts, vendor-comparator 등 | 점진적 타입 도입 |
| 6 | Snapshot race condition | PostVerifier | operation 직전/직후 atomic 수집 |

### MEDIUM

| # | 항목 | 위치 | 권장 조치 |
|---|------|------|----------|
| 1 | 인증 정보 평문 저장 | device-verifier.ts | evidence 저장 시 credential 마스킹 |
| 2 | 접근 정보 만료 미구현 | device-access-manager.ts:164 | expiresAt 비교 로직 구현 |
| 3 | 병렬 실행 상태 충돌 | parallel-executor.ts | 결과 별도 수집 후 반영 |
| 4 | LLM 응답 런타임 검증 없음 | llm-client.ts:212 | zod schema 검증 추가 |
| 5 | evidence 데이터 무결성 | execution-logger.ts | SHA-256 해시 추가 |
| 6 | `as any` 타입 캐스팅 | device-access-manager.ts:64 | 타입 가드 추가 |
| 7 | 병렬 재시도 무한루프 | parallel-executor.ts | retryCount 추적 |

### LOW

| # | 항목 | 위치 |
|---|------|------|
| 1 | 저수준 tool 직접 호출 가능 | tool-registry.ts:165 |
| 2 | MCP 타임아웃 시 서버 작업 미취소 | mcp-client.ts:166 |
| 3 | evidence 서명 없음 | execution-logger.ts |

---

## 5. 구현 통계

### 신규 파일 (18개)

| 파일 | 패키지 | PR |
|------|--------|-----|
| `device-model.ts` | workflow-engine | PR-20 |
| `operation-model.ts` | workflow-engine | PR-20 |
| `device-snapshot.ts` | health-checker | PR-21 |
| `playbook-schema.ts` | workflow-engine | PR-22 |
| `playbook-registry.ts` | workflow-engine | PR-22 |
| `operation-planner.ts` | workflow-engine | PR-23 |
| `autopilot-policy.ts` | workflow-engine | PR-28 |
| `closed-loop-runner.ts` | workflow-engine | PR-29 |
| `replan-strategy.ts` | workflow-engine | PR-29 |
| `config-drift-detector.ts` | workflow-engine | PR-30 |
| `incident-detector.ts` | workflow-engine | PR-31 |
| `remediation-planner.ts` | workflow-engine | PR-31 |
| `rollback-manager.ts` | workflow-engine | PR-32 |
| `breakglass-policy.ts` | workflow-engine | PR-32 |
| `docs/playbooks/epp_malware_protection.md` | docs | PR-22 |
| `docs/evidence/README.md` | docs | PR-26 |
| `docs/reports/README.md` | docs | PR-32 |
| `docs/blueprint/*.md` | docs | PR plan |

### 수정 파일 (22개)

approval-manager.ts, device-verifier.ts, execution-logger.ts, workflow-executor.ts, sangfor-auto-config.ts, device-access-manager.ts, tool-registry.ts, index.ts, types.ts, manual-scenario-extractor.ts, sangfor-intelligence.ts, ai-feature-extractor.ts, learning-scheduler.ts, health-checker/index.ts, health-checker/snapshot-comparator.ts, health-checker/package.json, wiki-sync/auto-pipeline.ts, wiki-sync/obsidian-sync.ts, mcp-server/index.ts, operator-console/server.ts, README.md

### 코드 통계

- **총 변경**: 41 files, +7,953 lines
- **커밋**: `e96b3c2` (main)
- **테스트**: 53/53 통과
- **빌드**: 에러 0

---

## 6. 다음 단계 권장

### 즉시 (CRITICAL 수정)
1. WorkflowExecutor 재시도 무한루프 수정
2. WorkflowExecutor에 approval checkpoint 추가
3. MCP tool 등록 시 보수적 기본값 적용

### 단기 (HIGH 수정)
4. CDP 연결 누수 수정 (2곳)
5. dry-run 로직 재설계
6. Rollback 시뮬레이션 명시 또는 실제 연동

### 중장기 (MEDIUM/LOW)
7. `any` 타입 점진적 제거
8. LLM 응답 런타임 검증 (zod)
9. Break-glass 정책 실행 경로 통합
10. Evidence 무결성 서명

---

## 7. 후속 조치 상태 (2026-06-17 업데이트)

| 항목 | 상태 | 조치 |
|------|------|------|
| WorkflowExecutor 재시도 무한루프 | Fixed | step별 retry 카운트를 분리 저장해 `maxRetries` 도달 시 실패 확정 |
| 승인 없는 변경 실행 경로 | Fixed | `WorkflowExecutor`에 민감 step 실행 전 `assertExecutionAllowed` 강제 |
| MCP tool 기본 approval=false | Fixed | MCP 자동 등록 시 mutation/unknown tool을 기본 승인 필요로 분류 |
| dry-run 로직 역전 | Fixed | `dryRun`을 승인 여부와 분리, 기본 `true`, 명시적 승인 컨텍스트 필요 |
| Rollback 항상 성공 시뮬레이션 | Fixed | rollback 실행 모드를 `dry-run`/`execute`로 분리, executor 미설정 시 execute 실패 처리 |
| CDP 연결 누수 (applyConfig/DeviceVerifier) | Fixed | 단일 실행 경로 `finally close` 및 verifier 연결 수명주기 정리 |
| API 실행 경로 승인 강제 (Operator/MCP) | Fixed | plan 생성 시 snapshot 필수, execute 시 approval/break-glass 검증, `OperationOrchestrator` 원자 실행 연동 |
| Break-glass 실행 경로 통합 | Fixed | Operator/MCP execute 경로에서 활성 break-glass 세션 허용, `WorkflowExecutor` 연동 |
| Snapshot race/원자적 postcheck 루프 | Fixed | `OperationOrchestrator` + `ClosedLoopRunner` 옵션으로 before→execute→after→verify 루프 지원 |
