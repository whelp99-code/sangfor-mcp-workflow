# Sangfor Intelligence System — 아키텍처 문서

## 개요

Sangfor Engineer MCP의 지능화 레이어.
Integuru 패턴(HAR API 역공학) + Phase2(매뉴얼 학습) + 실장비 검증을 통합.

## 핵심 모듈

```
packages/workflow-engine/src/
├── sangfor-api-discovery.ts    ← HAR 캡처 + LLM API 분석 (Integuru 패턴)
├── manual-scenario-extractor.ts ← KB/매뉴얼 → 시나리오 자동 추출
├── scenario-db.ts              ← 시나리오 DB (YAML 파일 기반)
├── device-verifier.ts          ← 실장비 접속 → 시나리오 검증 + 개선
└── sangfor-intelligence.ts     ← 통합 파이프라인 오케스트레이터
```

## 데이터 흐름

```
[Stage 1: 수집]
  KB 문서 ──┐
            ├──→ ManualScenarioExtractor → 시나리오 후보
  매뉴얼 ──┘
  
[Stage 2: API 발견]  (Integuru 패턴)
  HAR 캡처 → LLM 분석 → API 엔드포인트 → 시나리오에 API 정보 추가
  
[Stage 3: 실장비 검증]
  시나리오 → Playwright 실행 → 성공/실패 → 시나리오 개선
  
[Stage 4: 문서화]
  검증된 시나리오 → setting-guide-generator → 가이드 문서
  검증된 시나리오 → RAG 인덱스 → 지식 베이스
```

## 시나리오 DB 구조

```
data/scenarios/
├── _index.json                  ← 전체 인덱스
├── epp/
│   ├── device_control.yaml      ← 수동 작성 + 학습 자동 생성
│   ├── malware_protection.yaml
│   └── ...
├── iag/
│   ├── url_filtering.yaml
│   └── ...
└── cc/
    ├── log_management.yaml
    └── ...
```

## 시나리오 YAML 형식

```yaml
id: epp_device_control
product: EPP
feature: Device Control
description: "USB, CD/DVD 등 저장 장치 접근 제어"

# 출처
source:
  type: knowledge_base | manual_extract | device_discovery | integuru_har
  url: ""
  confidence: 0.9

# UI 자동화 (fallback)
menuPath: [Policies, Behavior Control]
hashRoute: "#/policy/deviceControl"

# API 직접 호출 (Integuru가 발견)
apiEndpoint:
  method: POST
  url: "/api/v1/policies/device-control"
  payload: { usb_blocked: true }
  authType: bearer

# 설정 액션
settings:
  - type: checkbox
    label: "USB 저장 장치 차단"
    value: true
    auditItems: [Device Control, USB Device Control]

# 검증
validation:
  method: webui | api
  criteria: ["USB 차단"]
```

## 실행 우선순위

```
1. API 엔드포인트가 있으면 → API 직접 호출 (빠름, 안정적)
2. 없으면 → Playwright UI 자동화 (느림, UI 변경에 취약)
3. 둘 다 실패 → 수동 개입 요청
```
