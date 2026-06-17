# AI Device Auto Ops — PR별 상세 개발 계획서

**작성일**: 2026-06-17  
**버전**: v1.0  
**대상 작업자**: Cursor + opencode  
**검토자**: Codex

---

## PR 운영 원칙

1. PR은 작게 나눈다.
2. 장비 변경 가능성이 있는 PR은 dry-run과 approval gate를 먼저 구현한다.
3. 실장비 변경 코드는 기본값을 dry-run으로 둔다.
4. 각 PR은 테스트와 evidence 샘플을 포함한다.
5. Codex 검토 전 `pnpm test`, `pnpm run lint`, `pnpm run build`를 실행한다.

---

## Phase 0 — Level 0-2

### PR-20: Device Model / Operation Model

**목표**: 장비 상태, capability, operation plan의 공통 타입을 정의한다.

**변경 파일**

- `packages/workflow-engine/src/device-model.ts`
- `packages/workflow-engine/src/operation-model.ts`
- `packages/workflow-engine/src/index.ts`
- `packages/workflow-engine/src/types.ts`

**구현 내용**

- `SangforProduct`
- `DeviceSnapshot`
- `DeviceCapability`
- `DesiredState`
- `OperationPlan`
- `OperationStep`
- `OperationCheck`
- `OperationRisk`
- `ApprovalRequirement`
- `EvidenceRef`

**검증 방법**

```bash
pnpm --filter @sangfor/workflow-engine test
pnpm run build
```

**Codex 검토 포인트**

- 타입이 실행 모듈에 종속되지 않는지
- `any`가 없는지
- 위험도와 승인 요구가 모델에 포함됐는지

---

### PR-21: Snapshot Collector

**목표**: Level 0 read-only 장비 상태 수집 기반을 만든다.

**변경 파일**

- `packages/health-checker/src/device-snapshot.ts`
- `packages/health-checker/src/health-checker.ts`
- `packages/health-checker/src/snapshot-comparator.ts`
- `packages/health-checker/src/index.ts`
- `tests/` 또는 패키지 테스트 파일

**구현 내용**

- 장비 버전, 제품군, 라이선스, 정책, 객체, 인증 소스, 알람 요약 수집 타입 정의
- 현재 구현 가능한 항목과 확인 불가 항목을 분리
- snapshot diff 생성
- 실장비 조회 실패 시 partial snapshot 반환

**검증 방법**

```bash
pnpm --filter @sangfor/health-checker test
pnpm run health:check -- --product EPP --target <target-url>
```

**Codex 검토 포인트**

- read-only 동작만 포함됐는지
- 실패 시 원인과 partial 여부가 명확한지
- 설정 변경 API가 섞이지 않았는지

---

### PR-22: Manual Playbook Schema / Registry

**목표**: 매뉴얼 지식을 실행 가능한 playbook으로 정규화한다.

**변경 파일**

- `packages/workflow-engine/src/playbook-schema.ts`
- `packages/workflow-engine/src/playbook-registry.ts`
- `packages/workflow-engine/src/manual-scenario-extractor.ts`
- `packages/workflow-engine/src/rag-indexer.ts`
- `docs/playbooks/`

**구현 내용**

- playbook schema 정의
- precheck, step, postcheck, rollback, approval 필드 강제
- 기존 manual scenario를 playbook 후보로 변환
- 최소 1개 Sangfor 기능 playbook 작성

**검증 방법**

```bash
pnpm --filter @sangfor/workflow-engine test
pnpm run build
```

**Codex 검토 포인트**

- 매뉴얼 근거와 실행 step이 분리됐는지
- postcheck 없는 playbook을 reject하는지
- rollback 또는 수동 복구 안내가 포함됐는지

---

### PR-23: Operation Planner

**목표**: 사용자 요청, snapshot, playbook을 OperationPlan으로 변환한다.

**변경 파일**

- `packages/workflow-engine/src/operation-planner.ts`
- `packages/workflow-engine/src/llm-client.ts`
- `packages/workflow-engine/src/sangfor-intelligence.ts`
- `packages/workflow-engine/src/index.ts`

**구현 내용**

- intent parsing
- capability matching
- required input validation
- precheck/step/postcheck 조립
- risk 및 approval requirement 생성
- dry-run plan 출력

**검증 방법**

```bash
pnpm --filter @sangfor/workflow-engine test
pnpm run build
```

**Codex 검토 포인트**

- snapshot 없이 plan 실행 단계로 넘어가지 않는지
- AI 응답을 그대로 실행하지 않고 schema validation을 거치는지
- 누락 입력이 명확히 반환되는지

---

### PR-24: Approval Gate Integration

**목표**: Level 2에서 승인된 작업만 실행되도록 강제한다.

**변경 파일**

- `packages/workflow-engine/src/approval-manager.ts`
- `packages/workflow-engine/src/workflow-executor.ts`
- `packages/workflow-engine/src/execution-logger.ts`
- `apps/operator-console/src/server.ts`

**구현 내용**

- risk 기반 approval queue
- 승인/반려 상태 관리
- 승인 전 execution block
- 승인 이력 evidence 기록

**검증 방법**

```bash
pnpm test
pnpm run lint
```

**Codex 검토 포인트**

- `config_change`, `service_impact`가 승인 없이 실행되지 않는지
- 승인 상태가 로그/evidence에 남는지
- 반려된 plan이 실행 큐에 남지 않는지

---

### PR-25: Deterministic Executor / Adapter Boundary

**목표**: AI plan을 검증된 adapter action으로만 실행한다.

**변경 파일**

- `packages/workflow-engine/src/sangfor-auto-config.ts`
- `packages/workflow-engine/src/device-access-manager.ts`
- `packages/workflow-engine/src/tool-registry.ts`
- `packages/workflow-engine/src/workflow-executor.ts`

**구현 내용**

- API/SSH/UI adapter boundary 정의
- Playwright UI action은 selector/capability 기반으로 제한
- dry-run 기본값 적용
- 저장 버튼은 성공한 변경이 있을 때만 수행
- CDP 연결 재사용/종료 안정화

**검증 방법**

```bash
pnpm --filter @sangfor/workflow-engine test
pnpm run build
```

**Codex 검토 포인트**

- 저수준 클릭 tool이 MCP로 직접 노출되지 않는지
- UI 자동화가 idempotency와 expectedChange를 받는지
- 실패했는데 저장하지 않는지

---

### PR-26: Post Verifier / Evidence Writer

**목표**: 실행 후 결과를 검증하고 문서화한다.

**변경 파일**

- `packages/workflow-engine/src/device-verifier.ts`
- `packages/workflow-engine/src/execution-logger.ts`
- `packages/health-checker/src/snapshot-comparator.ts`
- `packages/wiki-sync/src/auto-pipeline.ts`
- `docs/evidence/`

**구현 내용**

- before/after snapshot diff
- expectedChange 검증
- postcheck 결과 기록
- 실패 원인 분류
- evidence Markdown 생성
- wiki sync 후보 생성

**검증 방법**

```bash
pnpm test
pnpm run build
```

**Codex 검토 포인트**

- 실행 성공과 검증 성공을 구분하는지
- diff가 사람이 읽을 수 있는지
- 실패 시 후속 조치가 남는지

---

### PR-27: MCP Tool Surface / Operator Console Phase 0

**목표**: AI와 사용자가 안전한 고수준 API로 Phase 0 루프를 사용할 수 있게 한다.

**변경 파일**

- `apps/mcp-server/src/index.ts`
- `apps/operator-console/src/server.ts`
- `apps/operator-console/tests/health-api.test.ts`
- `README.md`

**구현 내용**

- `get_device_snapshot`
- `plan_configuration_change`
- `validate_operation_plan`
- `request_operation_approval`
- `apply_approved_operation`
- `verify_configuration`
- `generate_evidence_report`
- operator-console API 추가

**검증 방법**

```bash
pnpm run dev:mcp
pnpm run dev:web
pnpm test
```

**Codex 검토 포인트**

- MCP tool이 위험 작업을 직접 실행하지 않는지
- 승인되지 않은 operation ID가 reject되는지
- API 응답에 evidence path가 포함되는지

---

## Phase 1 — Level 3-4

### PR-28: Autopilot Policy

**목표**: Level 3 저위험 자동 실행 정책을 구현한다.

**변경 파일**

- `packages/workflow-engine/src/autopilot-policy.ts`
- `packages/workflow-engine/src/approval-manager.ts`
- `packages/workflow-engine/src/workflow-executor.ts`
- `docs/blueprint/`

**구현 내용**

- allowlist/denylist
- risk threshold
- rollback required 조건
- product/version별 자동화 허용 조건
- high-risk 자동 실행 차단

**검증 방법**

```bash
pnpm --filter @sangfor/workflow-engine test
pnpm run build
```

**Codex 검토 포인트**

- denylist가 allowlist보다 우선인지
- 외부 접근/삭제/재시작이 자동 실행되지 않는지
- 정책 변경 이력이 남는지

---

### PR-29: Closed-loop Runner

**목표**: Level 4 실행 실패 시 재수집, 재계획, 재검증 루프를 구현한다.

**변경 파일**

- `packages/workflow-engine/src/closed-loop-runner.ts`
- `packages/workflow-engine/src/replan-strategy.ts`
- `packages/workflow-engine/src/workflow-executor.ts`
- `packages/workflow-engine/src/device-verifier.ts`

**구현 내용**

- failed postcheck 감지
- snapshot 재수집
- replan 생성
- retry limit
- 반복 실패 시 stop
- replan evidence 생성

**검증 방법**

```bash
pnpm test
pnpm run build
```

**Codex 검토 포인트**

- 무한 반복 방지가 있는지
- 재계획이 위험도를 낮추지 않는지
- 고위험 replan이 approval queue로 이동하는지

---

### PR-30: Drift Detection / Learning Feedback

**목표**: 설정 drift와 실패 사례를 playbook 개선 후보로 연결한다.

**변경 파일**

- `packages/workflow-engine/src/config-drift-detector.ts`
- `packages/workflow-engine/src/learning-scheduler.ts`
- `packages/wiki-sync/src/auto-pipeline.ts`
- `packages/wiki-sync/src/obsidian-sync.ts`

**구현 내용**

- desired vs current drift 탐지
- drift severity 분류
- 실패 원인과 playbook step 연결
- Obsidian 교훈 문서 생성
- manual/playbook 개선 후보 큐 생성

**검증 방법**

```bash
pnpm --filter @sangfor/wiki-sync test
pnpm test
```

**Codex 검토 포인트**

- 학습 후보가 자동으로 운영 정책을 바꾸지 않는지
- 사람 검토 전 playbook 원본이 수정되지 않는지
- drift와 실행 실패가 구분되는지

---

## Phase 2 — Level 5

### PR-31: Incident Detection / Remediation Planning

**목표**: health-check 결과를 incident로 승격하고 복구 계획을 생성한다.

**변경 파일**

- `packages/workflow-engine/src/incident-detector.ts`
- `packages/workflow-engine/src/remediation-planner.ts`
- `packages/health-checker/src/health-checker.ts`
- `apps/operator-console/src/server.ts`

**구현 내용**

- incident candidate 생성
- severity 분류
- root cause 후보 생성
- remediation playbook 매핑
- impact 분석
- 승인 필요 여부 생성

**검증 방법**

```bash
pnpm test
pnpm run build
```

**Codex 검토 포인트**

- 장애 탐지가 곧바로 복구 실행으로 이어지지 않는지
- impact 분석 없는 복구 plan이 reject되는지
- 사람이 이해 가능한 복구 사유가 있는지

---

### PR-32: Rollback / Self-healing Execution

**목표**: 승인된 복구 작업을 실행하고 실패 시 rollback 또는 수동 조치로 전환한다.

**변경 파일**

- `packages/workflow-engine/src/rollback-manager.ts`
- `packages/workflow-engine/src/breakglass-policy.ts`
- `packages/workflow-engine/src/closed-loop-runner.ts`
- `packages/workflow-engine/src/execution-logger.ts`
- `docs/reports/`

**구현 내용**

- rollback plan 검증
- break-glass policy
- approved remediation 실행
- 복구 후 서비스 정상성 검증
- 실패 시 rollback 또는 manual action required
- incident timeline evidence 생성

**검증 방법**

```bash
pnpm test
pnpm run lint
pnpm run build
```

**Codex 검토 포인트**

- 승인 없는 self-healing 변경이 없는지
- rollback이 불가능한 작업은 명확히 표시되는지
- 운영 영향 작업이 break-glass 정책을 거치는지

---

## 최종 통합 검증

Phase별 완료 후 다음 검증을 수행한다.

```bash
pnpm install
pnpm test
pnpm run lint
pnpm run build
pnpm run dev:mcp
pnpm run dev:web
```

실장비 변경 검증은 별도 승인 후 수행한다.

```bash
pnpm run health:check -- --product EPP --target <target-url>
```

---

## PR 체크리스트

각 PR은 다음 체크리스트를 채운다.

```text
- [ ] 변경 범위가 PR 목표와 일치한다.
- [ ] 장비 변경 작업은 snapshot 없이 실행되지 않는다.
- [ ] 승인 필요 작업은 approval gate를 통과한다.
- [ ] dry-run 경로가 있다.
- [ ] postcheck가 있다.
- [ ] evidence가 생성된다.
- [ ] 테스트를 추가/수정했다.
- [ ] pnpm test 통과
- [ ] pnpm run lint 통과
- [ ] pnpm run build 통과
```

