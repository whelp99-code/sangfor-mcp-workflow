# 1차 고도화 블루프린트: Compliance 추이 관리 시스템

**작성일**: 2026-06-10  
**버전**: v1.0  
**목적**: Sangfor 제품 위주 Compliance 추이 관리 및 개선 로드맵 자동 생성

---

## 1. 프로젝트 비전

### 현재 위치
```
감사항목 → Excel 파싱 → Result 필터링 → Compliance 계산 (26%)
```

### 목표 위치
```
감사항목 → Excel 파싱 → Result 필터링 → Compliance 계산
    ↓
Compliance 추이 관리 → 개선 로드맵 자동 생성 → 고객 제안서 자동 생성
    ↓
Sangfor 설정 자동화 → 실장비 검증 → Compliance 업데이트
    ↓
지속적 모니터링 → Compliance 변화 감지 → 알림
```

### 핵심 가치
| 구분 | 현재 | 목표 |
|------|------|------|
| **Compliance 의미** | 현재 통과율 | 개선 가능성을 포함한 종합 점수 |
| **고객 제안** | "Sangfor 제품 추천" | "Compliance 26% → 87% 개선" |
| **프로젝트 범위** | 제품 납품 | 제품 + 개선 + 모니터링 |
| **수익 모델** | 일회성 판매 | 지속적 서비스 |

---

## 2. 아키텍처

### 전체 구조
```
┌─────────────────────────────────────────────────────────────┐
│                Compliance 추이 관리 시스템                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Excel Parser  │  │ Compliance   │  │ Trend        │      │
│  │ (Result 필터) │  │ Calculator   │  │ Tracker      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                ↓                ↓                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Compliance Database                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │ History │ │ Changes │ │ Roadmap │ │ Reports │   │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Roadmap      │  │ Proposal     │  │ Monitor      │      │
│  │ Generator    │  │ Generator    │  │ System       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름
```
1. 입력: ITAC Excel 체크리스트
   ↓
2. 파싱: Result 있는 항목만 추출 (31개)
   ↓
3. 분석: Compliance 계산 (26%)
   ↓
4. 추적: Compliance 이력 저장
   ↓
5. 로드맵: 개선 로드맵 자동 생성
   ↓
6. 제안서: 고객 제안서 자동 생성
   ↓
7. 설정: Sangfor 설정 자동화
   ↓
8. 검증: 실장비 검증
   ↓
9. 업데이트: Compliance 업데이트
   ↓
10. 모니터링: 지속적 모니터링
```

---

## 3. 개발 단계

### Phase 1: Compliance 추이 관리 (2주)
| 작업 | 내용 | 산출물 |
|------|------|--------|
| PR-01 | ComplianceTracker 인터페이스 설계 | `compliance-tracker.ts` |
| PR-02 | Compliance 이력 저장/조회 | `compliance-db.ts` |
| PR-03 | Compliance 변화 감지 | `compliance-change-detector.ts` |
| PR-04 | Compliance 추이 분석 | `compliance-trend-analyzer.ts` |
| PR-05 | MCP tools 추가 | `mcp-server/index.ts` |

### Phase 2: 개선 로드맵 자동 생성 (2주)
| 작업 | 내용 | 산출물 |
|------|------|--------|
| PR-06 | ImprovementRoadmap 인터페이스 설계 | `improvement-roadmap.ts` |
| PR-07 | Phase별 개선 계획 생성 | `roadmap-generator.ts` |
| PR-08 | Compliance 예측 알고리즘 | `compliance-predictor.ts` |
| PR-09 | MCP tools 추가 | `mcp-server/index.ts` |

### Phase 3: 고객 제안서 자동 생성 (2주)
| 작업 | 내용 | 산출물 |
|------|------|--------|
| PR-10 | CustomerProposal 인터페이스 설계 | `customer-proposal.ts` |
| PR-11 | 제안서 템플릿 생성 | `proposal-template.ts` |
| PR-12 | 제안서 자동 생성 로직 | `proposal-generator.ts` |
| PR-13 | MCP tools 추가 | `mcp-server/index.ts` |

### Phase 4: Sangfor 설정 자동화 (3주)
| 작업 | 내용 | 산출물 |
|------|------|--------|
| PR-14 | SangforAutoConfig 인터페이스 설계 | `sangfor-auto-config.ts` |
| PR-15 | 감사항목 → Sangfor 설정 매핑 | `audit-to-config-mapper.ts` |
| PR-16 | 설정 자동 적용 로직 | `config-applier.ts` |
| PR-17 | 설정 검증 로직 | `config-verifier.ts` |
| PR-18 | MCP tools 추가 | `mcp-server/index.ts` |

### Phase 5: 실장비 검증 자동화 (2주)
| 작업 | 내용 | 산출물 |
|------|------|--------|
| PR-19 | AutoVerification 인터페이스 설계 | `auto-verification.ts` |
| PR-20 | 설정 적용 후 자동 검증 | `verification-runner.ts` |
| PR-21 | Compliance 자동 업데이트 | `compliance-updater.ts` |
| PR-22 | 검증 보고서 생성 | `verification-report.ts` |
| PR-23 | MCP tools 추가 | `mcp-server/index.ts` |

### Phase 6: 지속적 모니터링 (2주)
| 작업 | 내용 | 산출물 |
|------|------|--------|
| PR-24 | ComplianceMonitor 인터페이스 설계 | `compliance-monitor.ts` |
| PR-25 | 정기 점검 스케줄러 | `scheduled-checker.ts` |
| PR-26 | 변화 감지 알림 | `alert-system.ts` |
| PR-27 | 모니터링 대시보드 | `monitoring-dashboard.ts` |
| PR-28 | MCP tools 추가 | `mcp-server/index.ts` |

---

## 4. 성공 지표

| 지표 | 현재 | 목표 |
|------|------|------|
| **Compliance 추적** | 없음 | 100% 항목 추적 |
| **개선 로드맵 자동 생성** | 수동 | 자동 생성 |
| **고객 제안서 생성 시간** | 2-3시간 | 5분 |
| **설정 자동화율** | 0% | 80% |
| **검증 자동화율** | 0% | 90% |
| **모니터링覆盖率** | 0% | 100% |

---

## 5. 리스크 및 대응

| 리스크 | 설명 | 대응 |
|--------|------|------|
| **실장비 접근 제한** | CAPTCHA, 네트워크 | 자동 로그인 + 재시도 |
| **설정 복잡도** | Sangfor 제품별 설정 차이 | 제품별 매핑 데이터 |
| **Compliance 계산 기준** | Result 해석 차이 | 고객별 커스터마이징 |
| **데이터 일관성** | Excel 형식 변화 | 파싱 로직 유연성 |

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
