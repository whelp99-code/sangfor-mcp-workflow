# Agent instructions

## Project overview

Sangfor Engineer MCP Workflow Automation — 3대 핵심 워크플로우 자동화 프로젝트

- **프로젝트 유형**: pnpm 모노레포
- **목적**: sangfor-engineer-mcp의 워크플로우 자동화 레이어
- **핵심 워크플로우**:
  1. 프로젝트 올인원 (Excel → 가이드 → 검증 → 보고서)
  2. 실장비 일상 점검 (정기 정책 상태 확인 + 이상 감지)
  3. Obsidian 연동 (피드백 → 교훈 → 위키 자동 반영)

## Setup

```bash
corepack enable
pnpm install
```

## Validation

```bash
pnpm test
pnpm run lint
pnpm run build
```

## Layout

- `apps/mcp-server` — MCP stdio JSON-RPC 서버
- `apps/operator-console` — 웹 UI + REST API (port 3500)
- `packages/workflow-core` — 워크플로우 엔진 (파이프라인, 스케줄러)
- `packages/health-checker` — 실장비 점검 모듈
- `packages/wiki-sync` — Obsidian/GitHub Wiki 동기화
- `packages/shared` — 공통 타입 및 유틸리티
- `tests/` — Vitest 테스트
- `scripts/` — 실행 스크립트

## Key Commands

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

## Dependencies

- **sangfor-engineer-mcp**: 기존 MCP 서버 및 packages (@sangfor/*)
- **Playwright**: 실장비 CDP 제어
- **Obsidian**: 지식 관리 (로컬 파일 시스템)

## Conventions

- **언어**: TypeScript (strict mode)
- **테스트**: Vitest
- **커밋 메시지**: conventional commits (feat:, fix:, docs:, etc.)
- **브랜치**: feature/, fix/, docs/, refactor/

## Related Projects

- **sangfor-engineer-mcp**: ~/Documents/Playground/whelp99-code-sangfor-engineer-mcp
- **Obsidian Vault**: ~/Documents/Obsidian Vault/
