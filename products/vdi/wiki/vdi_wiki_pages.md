# VDI LLM Wiki Pages
> **Product**: Sangfor VDI (aDesk) v5.9.1 | **Evidence**: VDI VDC User Manual (30,371 lines)

## Page 1: VDI Overview
```yaml
title: VDI Overview
product_name: VDI
summary: 가상 데스크톱 인프라. 가상/물리/세션 데스크톱 + 원격 앱 통합 관리. VDC/VDS/IOM/aDesk Agent 구성.
key_concepts: [가상 데스크톱, 물리 데스크톱, 세션 데스크톱, Remote App, HDP 프로토콜]
related_components: [VDC (컨트롤러), VDS (서버), IOM (운영관리), aDesk Agent, App Container, File Database]
evidence_sources: [{source: VDI VDC User Manual v5.9.1, section: Ch1-2, confidence: high}]
linked_pages: ["[[VDI Architecture]]", "[[VDI Components]]", "[[VDI Feature Map]]"]
unresolved_questions: [최신 버전, 클라우드 VDI, Linux 데스크톱]
```

## Page 2: VDI Architecture
```yaml
title: VDI Architecture
product_name: VDI
summary: aDesk Agent → VDC (인증/정책) → VDS (데스크톱 호스팅) → HDP (화면 전송).
architecture: "사용자 → aDesk Agent → VDC (인증/정책/할당) → VDS (VM/세션) → HDP 프로토콜 → 화면"
key_concepts: [VDC (Virtual Desktop Controller), VDS (Virtual Desktop Server), IOM, aDesk Agent, HDP]
evidence_sources: [{source: VDI VDC User Manual v5.9.1, section: Ch2-3, confidence: high}]
linked_pages: ["[[VDI Overview]]", "[[VDI Components]]", "[[VDI Data Flow]]"]
```

## Page 3: VDI Components
```yaml
title: VDI Components
product_name: VDI
summary: VDC, VDS, IOM, aDesk Agent, Desktop Pool, App Container, File Database.
key_concepts: [VDC (관리 콘솔), VDS (데스크톱 호스팅), IOM (운영 관리), aDesk Agent (클라이언트), Desktop Pool, App Container (소프트웨어 배포), File Database (파일 관리)]
evidence_sources: [{source: VDI VDC User Manual v5.9.1, confidence: high}]
linked_pages: ["[[VDI Architecture]]", "[[VDI Feature Map]]"]
```

## Page 4: VDI Feature Map
```yaml
title: VDI Feature Map
product_name: VDI
summary: VDI 전체 기능 분류.
feature_map:
  resource_types: [Virtual Desktop, Physical Desktop, Session Desktop, Remote App, Remote Desktop]
  authentication: [Password, LDAP, RADIUS, Certificate, USB Key, SMS, Dynamic Token, TOTP]
  user_management: [사용자/그룹/역할 관리, Policy Set, Account Options]
  desktop_policy: [USB 접근, 프린터, 콘텐츠 감사, 디스플레이, 프로파일 리다이렉션(FSLogix), 소프트웨어 제한]
  software_distribution: [App Container (생성/연결/업데이트/편집/복제/버전 관리)]
  file_management: [File Database Server, 파일 그룹, 파일 관리]
  monitoring: [IOM, 리소스 모니터링, 용량 계획]
  logging: [Service Logs, Operation Logs, Network Security Logs, System Logs]
evidence_sources: [{source: VDI VDC User Manual v5.9.1, confidence: high}]
linked_pages: ["[[VDI Components]]", "[[VDI Data Flow]]"]
```

## Page 5-10: Data Flow, Deployment, Operations, Monitoring, API, Backup
> 상세는 [[vdi_data_flow_process.md]] 참조.

## Page 11: VDI Failure Handling
```yaml
title: VDI Failure Handling
key_concepts: [연결 실패 재연결, 데스크톱 크래시 자동 재시작, VDC HA (확인 필요), VDS 마이그레이션 (확인 필요)]
unresolved_questions: [VDC/VDS HA 상세, 데스크톱 마이그레이션]
```

## Page 12-15: Licensing (확인 필요), Competitive (vs Citrix/Horizon), Customer ([[vdi_customer_explanation.md]]), Open Issues
```yaml
title: VDI Open Issues
open_issues:
  - {category: 확인필요, items: [VDC/VDS HA, API 문서, DR 전략, HDP 스펙, 최신 버전, 클라우드 VDI, Linux 데스크톱]}
```
