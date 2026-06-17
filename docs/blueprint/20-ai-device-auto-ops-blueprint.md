# AI Device Auto Ops — 블루프린트

**작성일**: 2026-06-17  
**버전**: v1.0  
**목적**: AI가 Sangfor 장비별 설정을 직접 수행하되, 상태 인식, 승인, 검증, 증거 기록을 강제하는 자동화 운영 구조 정의

---

## 1. 목표

### 현재 문제

현재 자동화는 시나리오 기반 실행에 가깝다.

```text
사용자 명령
  ↓
정해진 메뉴/입력/저장 절차 실행
  ↓
일부 결과 확인
```

이 방식은 다음 문제가 있다.

| 문제 | 영향 |
|------|------|
| 장비 현재 설정을 충분히 읽지 않음 | 기존 정책, 객체, 라이선스, 인증 상태를 놓침 |
| 선행 조건 확인이 약함 | 필요한 사용자/그룹/정책/라이선스 누락 |
| 후속 검증이 약함 | 설정은 저장됐지만 실제 동작하지 않을 수 있음 |
| 매뉴얼 지식이 실행 규칙으로 고정되지 않음 | AI가 제품 설정 순서를 안정적으로 재현하지 못함 |
| 저수준 UI 조작 중심 | 메뉴 변경, 언어, SPA 렌더링, 팝업에 취약 |

### 목표 상태

```text
User Intent
  ↓
Intent Analyzer
  ↓
Current State Snapshot
  ↓
Manual/Playbook Grounding
  ↓
Desired State Plan
  ↓
Risk Gate / Approval
  ↓
Deterministic Executor
  ↓
Post Verifier
  ↓
Evidence / Wiki Learning
```

AI는 직접 클릭을 남발하지 않고, 제품별 capability와 검증된 adapter를 선택한다. 변경 전후 상태 차이와 증거 문서를 반드시 남긴다.

---

## 2. 자동화 레벨 정의

| Level | 이름 | 자동화 범위 | 승인 정책 | 목표 |
|-------|------|-------------|-----------|------|
| Level 0 | Read-only Discovery | 장비 접속, 버전/라이선스/정책/객체/로그 조회 | 승인 불필요 | 장비 상태를 정확히 안다 |
| Level 1 | Plan Only | 사용자 요청을 목표 상태와 실행 계획으로 변환 | 승인 불필요 | 실행 전 누락 조건을 찾는다 |
| Level 2 | Approved Execution | 승인된 변경만 실행하고 검증 | 변경 전 승인 필요 | 안전한 반자동 설정 |
| Level 3 | Low-risk Autopilot | 저위험 변경 자동 실행 | 정책 기반 사전 승인 | 반복 작업 자동화 |
| Level 4 | Closed-loop Autopilot | 실행 실패 시 재계획, 재검증 | 고위험 단계 승인 필요 | 목표 상태 달성까지 폐쇄 루프 |
| Level 5 | Self-healing Ops | 장애 감지 후 자동 복구/롤백 | 운영 정책별 승인 | 운영 복원 자동화 |

### Phase 매핑

| Phase | 포함 레벨 | 개발 목표 |
|-------|-----------|-----------|
| Phase 0 | Level 0-2 | 상태 수집, 계획, 승인 후 실행, 검증 기반 확립 |
| Phase 1 | Level 3-4 | 저위험 자동 실행과 폐쇄 루프 자동화 |
| Phase 2 | Level 5 | 장애 감지, 자동 복구, 롤백 운영 |

---

## 3. 핵심 설계 원칙

### 3.1 AI는 Planner, Tool은 Executor

AI가 DOM 클릭 순서를 직접 만들지 않는다. AI는 목표 상태와 실행 계획을 생성하고, 실제 실행은 검증된 adapter 함수가 담당한다.

```text
나쁜 MCP surface:
- click_menu
- type_text
- click_save

좋은 MCP surface:
- get_device_snapshot
- plan_configuration_change
- validate_operation_plan
- apply_configuration_step
- verify_configuration_state
- generate_evidence_report
```

### 3.2 API/CLI 우선, UI 자동화는 마지막 수단

| 우선순위 | 방식 | 기준 |
|----------|------|------|
| 1 | 공식 API | 가장 안정적, 우선 사용 |
| 2 | CLI/SSH | 장비가 지원하고 audit log가 남는 경우 |
| 3 | 설정 export/import | 대량 설정, diff 검증이 가능한 경우 |
| 4 | Playwright UI | API가 없거나 기능이 UI에만 있는 경우 |

### 3.3 모든 변경은 Current State 기반

설정 전에는 반드시 snapshot을 수집한다.

```text
Current State
  + Manual/Playbook Rules
  + User Intent
  = Operation Plan
```

snapshot 없이 변경 작업을 실행하지 않는다.

### 3.4 매뉴얼은 RAG 문서가 아니라 Playbook으로 승격

매뉴얼 원문 검색만으로는 부족하다. 매뉴얼을 실행 가능한 playbook으로 정규화한다.

```yaml
id: ngaf_ssl_vpn_enable
product: sangfor_ngaf
capability: ssl_vpn
riskLevel: config_change
prechecks:
  - check_license_vpn
  - check_auth_source
  - check_existing_portal
  - check_policy_conflict
steps:
  - ensure_user_group
  - configure_portal
  - bind_user_group
  - create_access_policy
postchecks:
  - verify_portal_reachable
  - verify_test_login
  - verify_policy_hit_count
rollback:
  - disable_created_policy
  - remove_created_portal
approval:
  required: true
  reason: 외부 접속 경로와 접근 정책 변경
```

---

## 4. 모듈 아키텍처

### 신규/확장 패키지

| 모듈 | 위치 | 역할 |
|------|------|------|
| Device Model | `packages/workflow-engine/src/device-*` 또는 신규 `packages/device-model` | 제품, 장비, capability, desired state 타입 |
| Snapshot Collector | `packages/health-checker` 확장 | 현재 장비 상태 수집 |
| Operation Planner | `packages/workflow-engine` 확장 | intent + snapshot + playbook 기반 계획 생성 |
| Playbook Registry | `packages/workflow-engine/src/playbooks` | 매뉴얼 기반 실행 규칙 저장 |
| Device Adapter | `packages/workflow-engine/src/sangfor-auto-config.ts` 분리/확장 | API/CLI/UI 실행 adapter |
| Verifier | `packages/workflow-engine/src/device-verifier.ts` 확장 | postcheck와 상태 diff 검증 |
| Approval Gate | `packages/workflow-engine/src/approval-manager.ts` 확장 | 위험도별 승인 정책 |
| Evidence Writer | `packages/workflow-engine/src/execution-logger.ts`, `packages/wiki-sync` 확장 | 실행 증거와 교훈 저장 |
| Operator Console | `apps/operator-console` 확장 | 계획 검토, 승인, 실행 현황, evidence 확인 |
| MCP Server | `apps/mcp-server` 확장 | AI가 호출하는 안전한 고수준 tool 제공 |

### 데이터 흐름

```text
apps/mcp-server
  -> workflow-engine.intentAnalyzer
  -> health-checker.snapshotCollector
  -> workflow-engine.playbookRegistry
  -> workflow-engine.operationPlanner
  -> approval-manager
  -> device-adapter
  -> device-verifier
  -> execution-logger
  -> wiki-sync
```

---

## 5. 핵심 도메인 모델

### DeviceSnapshot

```typescript
export interface DeviceSnapshot {
  deviceId: string;
  product: SangforProduct;
  version: string;
  collectedAt: string;
  accessMethod: "api" | "ssh" | "ui" | "mixed";
  licenses: LicenseState[];
  objects: DeviceObject[];
  policies: DevicePolicy[];
  authSources: AuthSource[];
  network: NetworkState;
  alarms: DeviceAlarm[];
  rawRefs: EvidenceRef[];
}
```

### OperationPlan

```typescript
export interface OperationPlan {
  id: string;
  intent: UserIntent;
  deviceId: string;
  desiredState: DesiredState;
  prechecks: OperationCheck[];
  steps: OperationStep[];
  postchecks: OperationCheck[];
  rollback: OperationStep[];
  risk: OperationRisk;
  approval: ApprovalRequirement;
  evidencePolicy: EvidencePolicy;
}
```

### OperationStep

```typescript
export interface OperationStep {
  id: string;
  title: string;
  capability: string;
  adapter: "api" | "ssh" | "ui";
  action: string;
  input: Record<string, unknown>;
  expectedChange: ExpectedChange;
  idempotencyKey: string;
  retryPolicy: RetryPolicy;
  requiresApproval: boolean;
}
```

---

## 6. 운영 정책

### 승인 필요 작업

| 작업 | 승인 |
|------|------|
| 정책 생성/수정/삭제 | 필요 |
| 외부 접속 경로 생성 | 필요 |
| 사용자/권한 변경 | 필요 |
| 메일/보고서 외부 전송 | 필요 |
| 배포, release tag, 운영 DB 변경 | 필요 |
| 장애 복구 중 서비스 영향 가능 작업 | 필요 |

### 자동 진행 가능 작업

| 작업 | 조건 |
|------|------|
| 장비 상태 조회 | read-only |
| 설정 계획 생성 | 변경 없음 |
| 문서/evidence 생성 | 외부 공유 없음 |
| 저위험 객체 생성 | Phase 1 이후 정책 기반 허용 |
| 검증/로그 수집 | read-only |

---

## 7. 성공 기준

| 기준 | Phase 0 목표 | Phase 1 목표 | Phase 2 목표 |
|------|--------------|--------------|--------------|
| Snapshot 정확도 | 핵심 상태 80% 이상 | 핵심 상태 95% 이상 | 장애 원인 상태 포함 |
| Plan 완성도 | 선행/후속 작업 포함 | 자동 보정 포함 | 복구/롤백 포함 |
| 실행 안정성 | 승인 후 단일 작업 성공 | 저위험 다단계 성공 | 장애 복구 성공 |
| 검증 증거 | 전후 diff/evidence 생성 | 실패 재계획 로그 생성 | 복구 타임라인 생성 |
| 운영 통제 | 수동 승인 | 정책 승인 | 정책 + 긴급 차단 |

---

## 8. 작업 분담

| 역할 | 책임 |
|------|------|
| Cursor | 코드 수정, 테스트 작성, UI/API 연결 |
| opencode | 신규 모듈/타입/테스트 초안 생성 |
| Codex | 감독관 및 최종검토자. 설계 일관성, 위험도, 누락 검증, PR 리뷰 |

Codex는 직접 대량 구현보다 PR 단위로 다음 항목을 검토한다.

- DDD 계층 위반 여부
- 장비 변경 전 snapshot 강제 여부
- 승인 정책 누락 여부
- postcheck/evidence 누락 여부
- any, placeholder, TODO 남용 여부
- 실장비 위험 작업의 자동 실행 여부

