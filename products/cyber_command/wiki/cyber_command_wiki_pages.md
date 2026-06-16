# Cyber Command LLM Wiki Pages
> **Product**: Sangfor Cyber Command (NDR) | **Evidence**: Datasheet, Battle Card, MDR Guide

## Page 1: Cyber Command Overview
```yaml
title: Cyber Command Overview
product_name: Cyber Command
summary: AI/ML 기반 NDR 플랫폼. 네트워크 트래픽 분석으로 고급 위협 탐지/대응. Cyber Guardian MDR 연동.
key_concepts: [NDR, AI/ML 위협 탐지, STA 센서, SOAR 자동 대응, Cyber Guardian MDR]
related_components: [STA (Stealth Threat Analysis), EPP, NGAF, IAG, Cyber Guardian MDR]
evidence_sources: [{source: Cyber Command Datasheet, confidence: high}]
linked_pages: ["[[Cyber Command Architecture]]", "[[Cyber Command Feature Map]]"]
unresolved_questions: [최신 버전, STA 배포 상세, API 문서]
```

## Page 2: Cyber Command Architecture
```yaml
title: Cyber Command Architecture
product_name: Cyber Command
summary: STA 센서(트래픽 메타데이터 수집) + Cyber Command(AI/ML 분석) + SOAR(자동 대응).
architecture: "네트워크 → SPAN/TAP → STA 센서 → 메타데이터 추출 → Cyber Command → AI/ML 분석 → 위협 탐지 → SOAR 대응"
key_concepts: [STA 센서 (하드웨어), SPAN/TAP 미러링, 메타데이터 추출, 기준선 비교, 이상 탐지]
hardware:
  - {model: CC-1000a, sta: "5STA-100", throughput: "5Gbps", daily_log: "200M/day"}
  - {model: CC-2000a, sta: "8STA-100", throughput: "8Gbps", daily_log: "250M/day"}
  - {model: CC-3000a, sta: "12STA-100", throughput: "12Gbps", daily_log: "350M/day"}
evidence_sources: [{source: Cyber Command Datasheet, confidence: high}]
linked_pages: ["[[Cyber Command Overview]]", "[[Cyber Command Components]]", "[[Cyber Command Data Flow]]"]
```

## Page 3: Cyber Command Components
```yaml
title: Cyber Command Components
product_name: Cyber Command
summary: STA 센서, Cyber Command appliance, SOAR 모듈, 대시보드, Cyber Guardian MDR.
key_concepts: [STA 센서 (네트워크 메타데이터 수집), Cyber Command (AI/ML 분석), SOAR (자동 대응), Dashboard, Cyber Guardian MDR]
evidence_sources: [{source: Cyber Command Datasheet, confidence: high}]
linked_pages: ["[[Cyber Command Architecture]]", "[[Cyber Command Feature Map]]"]
```

## Page 4: Cyber Command Feature Map
```yaml
title: Cyber Command Feature Map
product_name: Cyber Command
summary: NDR 전체 기능 분류.
feature_map:
  detection: [AI/ML 이상 탐지, C2 통신 탐지, Lateral Movement 탐지, Insider Threat 탐지, 위협 인텔리전스]
  response: [SOAR 자동 대응, EPP 연동 격리, NGAF 연동 차단, 수동 조사]
  visibility: [실시간 대시보드, 네트워크 트래픽 분석, 위협 현황 시각화]
  integration: [EPP 연동, NGAF 연동, IAG 연동, Cyber Guardian MDR]
  reporting: [보안 리포트, 감사 로그, 규정 준수]
evidence_sources: [{source: Cyber Command Datasheet, confidence: high}]
linked_pages: ["[[Cyber Command Components]]", "[[Cyber Command Data Flow]]"]
```

## Page 5-10: Data Flow, Deployment, Operations, Monitoring, API, Backup
> 상세는 [[cyber_command_data_flow_process.md]] 참조.

## Page 11: Cyber Command Failure Handling
```yaml
title: Cyber Command Failure Handling
product_name: Cyber Command
summary: STA 센서/Cyber Command 장애 처리. 대부분 확인 필요.
unresolved_questions: [STA 센서 이중화, appliance 백업, 로그 보존 기간]
```

## Page 12-15: Licensing (확인 필요), Competitive (vs Darktrace), Customer ([[cyber_command_customer_explanation.md]]), Open Issues
```yaml
title: Cyber Command Open Issues
open_issues:
  - {category: 문서부족, items: [관리 콘솔 상세, API 문서, 백업/DR 절차]}
  - {category: 확인필요, items: [최신 버전, STA 배포 상세, 라이선스 모델, MDR 상세]}
```
