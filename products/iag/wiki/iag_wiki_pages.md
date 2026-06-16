# IAG LLM Wiki Pages
> **Product**: Sangfor IAG v13.0.80 | **Evidence**: IAG User Manual (22,971 lines)

## Page 1: IAG Overview
```yaml
title: IAG Overview
product_name: IAG
summary: 인터넷 접근 게이트웨이. 인증/접근제어/대역폭관리/감사 통합.
key_concepts: [인터넷 접근 제어, 사용자 인증, Application Control, Bandwidth Management, Activity Audit, Engine Zero]
related_components: [BIS (Business Intelligence System), Engine Zero (AI 엔진), LDAP/RADIUS 인증 서버]
evidence_sources: [{source: IAG User Manual v13.0.80, confidence: high}]
linked_pages: ["[[IAG Architecture]]", "[[IAG Components]]", "[[IAG Feature Map]]"]
unresolved_questions: [최신 버전, API 문서, 클라우드 배포]
```

## Page 2: IAG Architecture
```yaml
title: IAG Architecture
product_name: IAG
summary: 프록시/투명 모드 배포. 인증→접근제어→대역폭→감사 체인.
architecture: "사용자 → IAG (프록시/투명) → 인증 → 접근 제어 (App/URL/Content) → 대역폭 관리 → 인터넷"
key_concepts: [프록시 모드, 투명 모드, Standalone, Redundant (HA)]
evidence_sources: [{source: IAG User Manual v13.0.80, section: Ch1, confidence: high}]
linked_pages: ["[[IAG Overview]]", "[[IAG Components]]", "[[IAG Data Flow]]"]
```

## Page 3: IAG Components
```yaml
title: IAG Components
product_name: IAG
summary: IAG 엔진, BIS, Engine Zero, 인증 모듈, 접근 제어 모듈, 대역폭 관리 모듈.
key_concepts: [BIS (Business Intelligence System: 인터접접근/대역폭/전력낭비 분석), Engine Zero (AI 멀웨어 탐지), Application Control, URL Filter, Content Filter]
evidence_sources: [{source: IAG User Manual v13.0.80, confidence: high}]
linked_pages: ["[[IAG Architecture]]", "[[IAG Feature Map]]"]
```

## Page 4: IAG Feature Map
```yaml
title: IAG Feature Map
product_name: IAG
summary: IAG 전체 기능 분류.
feature_map:
  authentication: [LDAP, RADIUS, Certificate, USB Key, SMS, TOTP, Dynamic Token]
  access_control: [Application Control, URL Filtering (80+ 카테고리), Content Filtering, Endpoint NAC]
  bandwidth: [Line 선택, Guaranteed, Limited, Quota, 앱/사용자/IP별 관리]
  security: [Anti-DoS, ARP 보호, 악성 URL 차단, Engine Zero AI]
  audit: [Internet Access, Ingress, Storage, Printer 감사]
  monitoring: [BIS (인터넷 접근/대역폭/전력 낭비 분석)]
  management: [WebUI, Link Load Balancing, DNS Proxy, 가상 회선]
evidence_sources: [{source: IAG User Manual v13.0.80, confidence: high}]
linked_pages: ["[[IAG Components]]", "[[IAG Data Flow]]"]
```

## Page 5-10: Data Flow, Deployment, Operations, Monitoring, API, Backup
> 상세는 [[iag_data_flow_process.md]] 참조.

## Page 11: IAG Failure Handling
```yaml
title: IAG Failure Handling
key_concepts: [HA Active-Standby, 링크 장애 자동 전환, 인증 실패 잠금, 설정 백업/복원]
unresolved_questions: [HA 상세, DR 전략]
```

## Page 12-15: Licensing (확인 필요), Competitive (vs Palo Alto/Fortinet), Customer ([[iag_customer_explanation.md]]), Open Issues
```yaml
title: IAG Open Issues
open_issues:
  - {category: 확인필요, items: [API 문서, DR 전략, 최신 버전, 클라우드 배포, Engine Zero 상세]}
```
