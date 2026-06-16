# 1차 고도화 개발계획서: Compliance 추이 관리 시스템

**작성일**: 2026-06-10  
**버전**: v1.0  
**총 기간**: 13주 (2026-06-10 ~ 2026-09-08)

---

## 1. 개발 개요

### 프로젝트명
Sangfor MCP Workflow — Compliance 추이 관리 시스템

### 개발 기간
**총 13주** (Phase 1-6)

### 개발 인력
| 역할 | 인원 | 비고 |
|------|------|------|
| **아키텍트** | 1 | 전체 설계 |
| **백엔드** | 2 | 핵심 로직 |
| **프론트엔드** | 1 | 대시보드 |

---

## 2. Phase별 개발 계획

### Phase 1: Compliance 추이 관리 (2주)
**기간**: 2026-06-10 ~ 2026-06-23

| 주차 | 작업 | PR | 산출물 |
|------|------|-----|--------|
| 1주차 | ComplianceTracker 인터페이스 설계 | PR-01 | `compliance-tracker.ts` |
| 1주차 | Compliance 이력 저장/조회 | PR-02 | `compliance-db.ts` |
| 2주차 | Compliance 변화 감지 | PR-03 | `compliance-change-detector.ts` |
| 2주차 | Compliance 추이 분석 | PR-04 | `compliance-trend-analyzer.ts` |
| 2주차 | MCP tools 추가 | PR-05 | `mcp-server/index.ts` |

**검증 포인트**
- [ ] Compliance 이력 저장 동작 확인
- [ ] 변화 감지 정확도 확인
- [ ] 추이 분석 결과 확인
- [ ] MCP tools 동작 확인

---

### Phase 2: 개선 로드맵 자동 생성 (2주)
**기간**: 2026-06-24 ~ 2026-07-07

| 주차 | 작업 | PR | 산출물 |
|------|------|-----|--------|
| 1주차 | ImprovementRoadmap 인터페이스 설계 | PR-06 | `improvement-roadmap.ts` |
| 1주차 | Phase별 개선 계획 생성 | PR-07 | `roadmap-generator.ts` |
| 2주차 | Compliance 예측 알고리즘 | PR-08 | `compliance-predictor.ts` |
| 2주차 | MCP tools 추가 | PR-09 | `mcp-server/index.ts` |

**검증 포인트**
- [ ] 로드맵 생성 정확도 확인
- [ ] Compliance 예측 정확도 확인
- [ ] MCP tools 동작 확인

---

### Phase 3: 고객 제안서 자동 생성 (2주)
**기간**: 2026-07-08 ~ 2026-07-21

| 주차 | 작업 | PR | 산출물 |
|------|------|-----|--------|
| 1주차 | CustomerProposal 인터페이스 설계 | PR-10 | `customer-proposal.ts` |
| 1주차 | 제안서 템플릿 생성 | PR-11 | `proposal-template.ts` |
| 2주차 | 제안서 자동 생성 로직 | PR-12 | `proposal-generator.ts` |
| 2주차 | MCP tools 추가 | PR-13 | `mcp-server/index.ts` |

**검증 포인트**
- [ ] 제안서 생성 품질 확인
- [ ] 템플릿 커스터마이징 확인
- [ ] MCP tools 동작 확인

---

### Phase 4: Sangfor 설정 자동화 (3주)
**기간**: 2026-07-22 ~ 2026-08-11

| 주차 | 작업 | PR | 산출물 |
|------|------|-----|--------|
| 1주차 | SangforAutoConfig 인터페이스 설계 | PR-14 | `sangfor-auto-config.ts` |
| 1주차 | 감사항목 → Sangfor 설정 매핑 | PR-15 | `audit-to-config-mapper.ts` |
| 2주차 | 설정 자동 적용 로직 | PR-16 | `config-applier.ts` |
| 3주차 | 설정 검증 로직 | PR-17 | `config-verifier.ts` |
| 3주차 | MCP tools 추가 | PR-18 | `mcp-server/index.ts` |

**검증 포인트**
- [ ] 설정 매핑 정확도 확인
- [ ] 자동 적용 동작 확인
- [ ] 설정 검증 정확도 확인
- [ ] MCP tools 동작 확인

---

### Phase 5: 실장비 검증 자동화 (2주)
**기간**: 2026-08-12 ~ 2026-08-25

| 주차 | 작업 | PR | 산출물 |
|------|------|-----|--------|
| 1주차 | AutoVerification 인터페이스 설계 | PR-19 | `auto-verification.ts` |
| 1주차 | 설정 적용 후 자동 검증 | PR-20 | `verification-runner.ts` |
| 2주차 | Compliance 자동 업데이트 | PR-21 | `compliance-updater.ts` |
| 2주차 | 검증 보고서 생성 | PR-22 | `verification-report.ts` |
| 2주차 | MCP tools 추가 | PR-23 | `mcp-server/index.ts` |

**검증 포인트**
- [ ] 자동 검증 동작 확인
- [ ] Compliance 업데이트 정확도 확인
- [ ] 검증 보고서 품질 확인
- [ ] MCP tools 동작 확인

---

### Phase 6: 지속적 모니터링 (2주)
**기간**: 2026-08-26 ~ 2026-09-08

| 주차 | 작업 | PR | 산출물 |
|------|------|-----|--------|
| 1주차 | ComplianceMonitor 인터페이스 설계 | PR-24 | `compliance-monitor.ts` |
| 1주차 | 정기 점검 스케줄러 | PR-25 | `scheduled-checker.ts` |
| 2주차 | 변화 감지 알림 | PR-26 | `alert-system.ts` |
| 2주차 | 모니터링 대시보드 | PR-27 | `monitoring-dashboard.ts` |
| 2주차 | MCP tools 추가 | PR-28 | `mcp-server/index.ts` |

**검증 포인트**
- [ ] 정기 점검 동작 확인
- [ ] 변화 감지 정확도 확인
- [ ] 알림 전송 확인
- [ ] 대시보드 동작 확인
- [ ] MCP tools 동작 확인

---

## 3. 기술 스택

### 핵심 기술
| 영역 | 기술 | 버전 |
|------|------|------|
| **언어** | TypeScript | 5.9+ |
| **런타임** | Node.js | 22+ |
| **패키지** | pnpm | 10+ |
| **테스트** | Vitest | 3+ |
| **웹 프레임워크** | Express | 5+ |

### 데이터 저장
| 데이터 | 저장소 | 형식 |
|--------|--------|------|
| **Compliance 이력** | JSON 파일 | `data/compliance/` |
| **개선 로드맵** | JSON 파일 | `data/roadmaps/` |
| **고객 제안서** | Markdown/DOCX | `outputs/proposals/` |
| **설정 매핑** | JSON 파일 | `data/configs/` |

---

## 4. 리스크 관리

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| **실장비 접근 제한** | 중 | 높음 | 자동 로그인 + 재시도 |
| **설정 복잡도** | 중 | 중 | 제품별 매핑 데이터 |
| **Compliance 계산 기준** | 중 | 중 | 고객별 커스터마이징 |
| **데이터 일관성** | 저 | 중 | 파싱 로직 유연성 |

---

## 5. 성공 기준

| 기준 | 목표 | 측정 방법 |
|------|------|----------|
| **Compliance 추적률** | 100% | 전체 항목 추적 확인 |
| **개선 로드맵 정확도** | 90% 이상 | 고객 피드백 |
| **제안서 생성 시간** | 5분 이내 | 시간 측정 |
| **설정 자동화율** | 80% 이상 | 자동 적용 확인 |
| **검증 자동화율** | 90% 이상 | 자동 검증 확인 |
| **모니터링覆盖率** | 100% | 전체 항목 모니터링 확인 |

---

## 6. 향후 로드맵

### 2026 Q3
- Phase 1-3 완료 (추이 관리 + 로드맵 + 제안서)
- 첫 고객 프로젝트 성공

### 2026 Q4
- Phase 4-6 완료 (설정 자동화 + 검증 + 모니터링)
- Sangfor 제품 전체 자동화

### 2027 Q1
- 멀티 벤더 확장
- 타 벤더 설정 자동화
