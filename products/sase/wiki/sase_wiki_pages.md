# SASE LLM Wiki Pages
> **Product**: Sangfor SASE (Athena SASE / aTrust) | **Evidence**: SASE Main Slide 2026

## Page 1: SASE Overview
```yaml
title: SASE Overview
product_name: SASE
summary: 클라우드 기반 보안 접근 서비스. ZTNA+SWG+CASB 통합. VPN 대체.
key_concepts: [ZTNA, SWG, CASB, 클라우드 POP, Connector, VPN 대체, Zero Trust]
related_components: [User Client, POP, Connector, Aryaka]
evidence_sources: [{source: SASE Main Slide 2026, confidence: medium}]
linked_pages: ["[[SASE Architecture]]", "[[SASE Feature Map]]"]
unresolved_questions: [POP 위치/수, 지원 프로토콜, 라이선스 모델]
```

## Page 2: SASE Architecture
```yaml
title: SASE Architecture
product_name: SASE
summary: User Client → POP → 보안 정책 → 인터넷/온프레미스/클라우드.
architecture: "사용자 → User Client → 클라우드 POP → [SWG/CASB/ZTNA] → 대상 리소스. 온프레미스는 Connector 경유."
key_concepts: [User Client (에이전트), POP (클라우드 엣지), Connector (온프레미스 연결자), Aryaka (네트워크 최적화)]
evidence_sources: [{source: SASE Main Slide 2026, confidence: medium}]
linked_pages: ["[[SASE Overview]]", "[[SASE Components]]", "[[SASE Data Flow]]"]
```

## Page 3: SASE Components
```yaml
title: SASE Components
product_name: SASE
summary: User Client, POP, Connector, ZTNA 엔진, SWG 엔진, CASB 엔진.
key_concepts: [User Client (Windows/Mac/Mobile), POP (글로벌 분산), Connector (온프레미스 VM), ZTNA 엔진, SWG 엔진, CASB 엔진]
evidence_sources: [{source: SASE Main Slide 2026, confidence: medium}]
linked_pages: ["[[SASE Architecture]]", "[[SASE Feature Map]]"]
unresolved_questions: [POP 위치/수, Connector 배포 요구사항]
```

## Page 4: SASE Feature Map
```yaml
title: SASE Feature Map
product_name: SASE
summary: SASE 전체 기능 분류.
feature_map:
  ztna: [신원 기반 접근 제어, 디바이스 posture 확인, 컨텍스트 인식 정책, 세분화된 접근 제어]
  swg: [URL 필터링, 콘텐츠 필터링, 멀웨어 차단, 애플리케이션 제어]
  casb: [SaaS 가시성, 데이터 유출 방지, 컴플라이언스, Shadow IT 탐지]
  networking: [클라우드 POP 라우팅, 온프레미스 Connector, Aryaka 연동, SD-WAN]
  management: [클라우드 관리 콘솔, 정책 관리, 모니터링, 리포팅]
evidence_sources: [{source: SASE Main Slide 2026, confidence: medium}]
linked_pages: ["[[SASE Components]]", "[[SASE Data Flow]]"]
unresolved_questions: [오프라인 모드, 로그/SIEM 연동]
```

## Page 5-10: Data Flow, Deployment, Operations, Monitoring, API, Backup
> 상세는 [[sase_data_flow_process.md]] 참조. 대부분 확인 필요.

## Page 11: SASE Failure Handling
```yaml
title: SASE Failure Handling
product_name: SASE
summary: POP/Connector/User Client 장애 처리. 대부분 확인 필요.
key_concepts: [POP 이중화 (확인 필요), Connector 이중화 (확인 필요), Client 재연결]
unresolved_questions: [POP 장애 시 자동 전환, 오프라인 모드, DR 전략]
```

## Page 12-15: Licensing (확인 필요), Competitive (vs Zscaler/Prisma/Netskope), Customer ([[sase_customer_explanation.md]]), Open Issues
```yaml
title: SASE Open Issues
open_issues:
  - {category: 문서부족, items: [POP 위치/수, 지원 프로토콜, 관리 콘솔 상세, API 문서]}
  - {category: 확인필요, items: [라이선스 모델, Aryaka 통합 상세, 성능 벤치마크, 로그/SIEM 연동]}
```
