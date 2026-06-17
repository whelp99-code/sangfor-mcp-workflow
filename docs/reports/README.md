# Reports

Sangfor MCP Workflow Engine 보고서 및 분석 결과 저장소.

## PR-31: Incident Detection & Remediation Planning

### IncidentDetector (`incident-detector.ts`)
- **목적**: HealthCheck 결과에서 incident 탐지
- **핵심 메서드**:
  - `detectIncidents(healthCheckResult)` → `Incident[]`
  - `classifySeverity(alerts)` → `IncidentSeverity`
  - `generateRootCauseCandidates(incident)` → `RootCauseCandidate[]`
- **심각도 분류**:
  - `critical` alerts → critical incident
  - 3+ warning alerts → medium incident
  - 1-2 warning alerts → low incident
  - error status items → high incident

### RemediationPlanner (`remediation-planner.ts`)
- **목적**: Incident 기반 복구 계획 자동 생성
- **핵심 메서드**:
  - `planRemediation(incident, playbooks)` → `RemediationPlan`
  - `analyzeImpact(plan)` → `ImpactAnalysis`
- **복구 계획 구성**:
  - Playbook 매칭 (product, capability 기반)
  - Precheck → Main Steps → Postcheck 순서
  - Rollback plan 자동 생성
  - 영향도 분석 (blast radius, downtime 추정)

## PR-32: Rollback Management & Break-Glass Policy

### RollbackManager (`rollback-manager.ts`)
- **목적**: 복구 계획 검증 및 롤백 실행
- **핵심 메서드**:
  - `validateRollbackPlan(plan)` → `RollbackValidationResult`
  - `executeRollback(plan, snapshot)` → `RollbackResult`
  - `getRollbackHistory()` → `RollbackResult[]`
- **검증 항목**:
  - Rollback steps 존재 여부
  - 필수 필드 (id, title, action) 확인
  - Step order 연속성
  - Step ID 중복 검사
- **증거 수집**:
  - Snapshot before/after
  - Step별 실행 로그
  - 복구 상태 기록

### BreakGlassPolicy (`breakglass-policy.ts`)
- **목적**: 비상 접근 승인 관리
- **핵심 메서드**:
  - `requestBreakGlass(reason, requestedBy)` → `BreakGlassRequest`
  - `approveBreakGlass(requestId, approvedBy)` → `BreakGlassRequest`
  - `isBreakGlassActive()` → `boolean`
  - `revokeBreakGlass(requestId, revokedBy, reason)` → `BreakGlassRequest`
- **보안 기능**:
  - 만료 시간 자동 관리 (기본 60분, 최대 8시간)
  - 감사 로그 자동 기록
  - 승인 필요/불필요 설정 가능
  - 자동 만료 체크 (1분 간격)
  - 강제 해지 지원

## 데이터 흐름

```
HealthCheckResult
    │
    ▼
IncidentDetector.detectIncidents()
    │
    ▼
Incident[]
    │
    ▼
RemediationPlanner.planRemediation(incident, playbooks)
    │
    ▼
RemediationPlan (steps + rollback + impact)
    │
    ├──▶ BreakGlassPolicy (비상 접근 필요 시)
    │
    ▼
RollbackManager.validateRollbackPlan(plan)
    │
    ▼
RollbackManager.executeRollback(plan, snapshot)
    │
    ▼
RollbackResult (success, evidence)
```
