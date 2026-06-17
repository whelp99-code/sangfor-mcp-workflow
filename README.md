# sangfor-mcp-workflow

Sangfor Engineer MCP Workflow Automation — 3대 핵심 워크플로우 자동화

## 개요

이 프로젝트는 [sangfor-engineer-mcp](https://github.com/whelp99-code/sangfor-engineer-mcp)의 워크플로우 자동화 레이어입니다.

### 3대 핵심 워크플로우

| 워크플로우 | 목적 | 상태 |
|-----------|------|------|
| ① 프로젝트 올인원 | Excel → 가이드 → 검증 → 보고서 자동화 | 🔴 개발 예정 |
| ② 실장비 일상 점검 | 정기 정책 상태 확인 + 이상 감지 | 🔴 개발 예정 |
| ③ Obsidian 연동 | 피드백 → 교훈 → 위키 자동 반영 | 🔴 개발 예정 |

## 설치

```bash
corepack enable
pnpm install
```

## 실행

```bash
# MCP 서버 실행
pnpm run dev:mcp

# 웹 UI 실행
pnpm run dev:web

# 프로젝트 파이프라인 실행
pnpm run pipeline:run -- --excel ./path/to/checklist.xlsx --customer "고객사명"

# 실장비 점검 실행
pnpm run health:check -- --product EPP --target https://10.80.1.106

# Obsidian 동기화 실행
pnpm run wiki:sync -- --vault ~/Documents/Obsidian\ Vault/
```

## 구조

```
sangfor-mcp-workflow/
├── apps/
│   ├── mcp-server/          # MCP stdio JSON-RPC 서버
│   └── operator-console/    # 웹 UI + REST API
├── packages/
│   ├── workflow-core/       # 워크플로우 엔진 (파이프라인, 스케줄러)
│   ├── workflow-engine/     # AI 기반 동적 워크플로우 엔진
│   ├── health-checker/      # 실장비 점검 모듈
│   ├── wiki-sync/           # Obsidian/GitHub Wiki 동기화
│   └── shared/              # 공통 타입 및 유틸리티
├── tests/                   # Vitest 테스트
├── scripts/                 # 실행 스크립트
└── docs/                    # 문서
```

## Phase 0: MCP Tools & Operator Console (PR-27)

### MCP Tools

Phase 0에서 추가된 MCP tools는 장비 상태 조회 → 계획 수립 → 승인 → 실행 → 검증의 4단계 파이프라인을 구현합니다.

**모든 위험 작업은 직접 실행하지 않고 plan → approval → execution 흐름을 따릅니다.**

| Tool | 유형 | 설명 |
|------|------|------|
| `get_device_snapshot` | Read-Only | 장비의 현재 상태를 스냅샷으로 수집 (변경 없음) |
| `plan_configuration_change` | Plan | intent + snapshot → OperationPlan 생성 (실행 안 함) |
| `validate_operation_plan` | Validate | plan 검증 (입력 누락, 위험도 분석) |
| `request_operation_approval` | Approval | 승인 요청 생성 |
| `apply_approved_operation` | Execute | **승인된** plan만 실행 (미승인 거부) |
| `verify_configuration` | Verify | Post-check: 변경이 올바르게 적용되었는지 확인 |
| `generate_evidence_report` | Report | 실행 결과 evidence Markdown 보고서 생성 |

### Workflow

```
get_device_snapshot → plan_configuration_change → validate_operation_plan
    → request_operation_approval → [운영자 승인] → apply_approved_operation
    → verify_configuration → generate_evidence_report
```

### REST API (Operator Console)

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/snapshots/:product` | GET | 장비 스냅샷 조회 |
| `/api/plan` | POST | Operation Plan 생성 |
| `/api/approvals` | GET | 승인 대기 목록 조회 |
| `/api/approvals/:id/approve` | POST | 승인 처리 |
| `/api/approvals/:id/reject` | POST | 거절 처리 |
| `/api/execute/:planId` | POST | 승인된 plan 실행 |
| `/api/evidence/:executionId` | GET | Evidence 보고서 조회 |

## 기술 슃�

| 영역 | 기술 |
|------|------|
| 언어/런타임 | TypeScript, Node.js 22 |
| 모노레포 | pnpm workspace |
| 테스트 | Vitest |
| MCP 서버 | stdio JSON-RPC |
| 웹 프레임워크 | Express (선택) |
| 실장비 제어 | Playwright CDP |
| 지식 관리 | Obsidian, GitHub Wiki |

## 개발 가이드

### 새 워크플로우 추가

1. `packages/` 아래에 새 패키지 생성
2. `packages/workflow-core/src/`에 워크플로우 정의
3. `apps/mcp-server/src/index.ts`에 MCP tool 등록
4. `tests/`에 테스트 코드 작성
5. `scripts/`에 실행 스크립트 추가

### 테스트

```bash
# 전체 테스트
pnpm test

# 특정 패키지 테스트
pnpm test --filter @sangfor/workflow-core

# 워치 모드
pnpm test:watch
```

## 라이선스

MIT
