# NGAF LLM Wiki Pages
> **Product**: Sangfor NGAF/NSF | **Evidence**: NGAF Feature List, NSF Feature List, NGAF vs SonicWall | **⚠️ NGAF EOL → NSF 마이그레이션 필요**

## Page 1: NGAF Overview
```yaml
title: NGAF Overview
product_name: NGAF
summary: L3-L7 차세대 방화벽. IPS/AV/WAF/VPN 통합. 9,000+ 앱 시그니처. EOL→NSF 마이그레이션 필요.
key_concepts: [L3-L7 방화벽, Engine Zero AI, SOC 내장, Application Control, 9000+ 앱 시그니처]
related_components: [NSF (후속), EPP (엔드포인트 연동), Cyber Command (로그 연동), Platform-X]
evidence_sources: [{source: NGAF Feature List v8.0.47, confidence: high}]
linked_pages: ["[[NGAF Architecture]]", "[[NGAF Feature Map]]", "[[NSF Migration Guide]]"]
unresolved_questions: [NSF 마이그레이션 절차, 성능 벤치마크]
```

## Page 2: NGAF Architecture
```yaml
title: NGAF Architecture
product_name: NGAF
summary: 인라인 배포 (Route/Bridge/Virtual Wire/Bypass/Hybrid). 다중 보안 엔진 체인. HA 지원.
architecture: 트래픽 → 인터페이스 → Zone 분류 → ACL 매칭 → 다중 엔진 검사 → Allow/Deny
key_concepts: [Route Mode, Bridge Mode, Virtual Wire, Bypass Mode, Hybrid Mode, HA Active-Active/Standby]
evidence_sources: [{source: NGAF Feature List, section: Deployment Mode, confidence: high}]
linked_pages: ["[[NGAF Overview]]", "[[NGAF Components]]", "[[NGAF Data Flow]]"]
```

## Page 3: NGAF Components
```yaml
title: NGAF Components
product_name: NGAF
summary: 방화벽 엔진, IPS, AV, WAF, VPN, Application Control, URL Filter, Anti-DoS, SOC.
key_concepts: [방화벽 엔진 (Stateful/L7), IPS (11K+ 시그니처), AV (1.5M+ 시그니처, Engine Zero), WAF (5,200+), VPN (IPSec/SSL/SD-WAN), SOC (보안운영센터)]
evidence_sources: [{source: NGAF Feature List, confidence: high}]
linked_pages: ["[[NGAF Architecture]]", "[[NGAF Feature Map]]"]
```

## Page 4: NGAF Feature Map
```yaml
title: NGAF Feature Map
product_name: NGAF
summary: NGAF 전체 기능 분류 (123 features).
feature_map:
  networking: [Interface (물리/서브/VLAN/Aggregate), DNS, DHCP, 라우팅 (Static/OSPF/BGP), NAT, GRE]
  security: [방화벽, IPS, AV, WAF, Anti-DoS, URL Filter, Content Filter, GeoLocation, Ransomware Protection]
  vpn: [IPSec VPN, SSL VPN, SD-WAN, GRE]
  access_control: [Application Control (9000+), Connection Control, Policy Optimizer]
  user_auth: [Web Portal, IP/MAC 바인딩, SSO (AD/POP3/Radius)]
  monitoring: [SOC, 자산관리, 사용자보안, 트래픽통계, 보안리포트]
  management: [WebUI/SSH/CLI, 역할 기반 인증, Central Management (BBC/Platform-X), RESTful API]
  ha: [Active-Active/Standby, 설정/세션 동기화, 바이패스]
evidence_sources: [{source: NGAF Feature List v8.0.47, confidence: high}]
linked_pages: ["[[NGAF Components]]", "[[NGAF Data Flow]]", "[[NGAF Competitive Comparison]]"]
```

## Page 5-10: NGAF Data Flow, Deployment, Operations, Monitoring, API, Backup
> 상세 내용은 [[ngaf_data_flow_process.md]] 참조. 각 페이지는 해당 섹션으로 연결.

## Page 11: NGAF Failure Handling
```yaml
title: NGAF Failure Handling
product_name: NGAF
summary: HA 전환, 바이패스, 설정 롤백.
key_concepts: [HA 자동 전환, 하드웨어/소프트웨어 바이패스, 하트비트 이중화, 자동 설정 백업/롤백]
evidence_sources: [{source: NGAF Feature List, section: HA, confidence: high}]
linked_pages: ["[[NGAF Architecture]]", "[[NGAF Backup and DR Flow]]"]
```

## Page 12-14: NGAF Licensing, Competitive Comparison, Customer Explanation
> Licensing: 확인 필요. Competitive: NGAF vs SonicWall 상세 문서 참조. Customer: [[ngaf_customer_explanation.md]] 참조.

## Page 15: NGAF Open Issues
```yaml
title: NGAF Open Issues
product_name: NGAF
summary: NGAF EOL, NSF 마이그레이션 필요.
open_issues:
  - {category: EOL, items: [전 하드웨어 모델 EOL (2025-01-15), NSF 마이그레이션 절차 미명시]}
  - {category: 확인필요, items: [NSF 기능 패리티, 정책 마이그레이션 도구, 성능 벤치마크, 클라우드 배포]}
evidence_sources: [{source: EOL Notices, confidence: high}]
linked_pages: ["[[NSF Migration Guide]]", "[[NGAF Feature Map]]"]
```

## Page 16: NSF Migration Guide
```yaml
title: NSF (Network Secure) Migration Guide
product_name: NGAF/NSF
summary: NGAF→NSF 마이그레이션 가이드.
key_concepts:
  - NSF v8.0.95: 205 features (vs NGAF 123)
  - 하드웨어: NSF-1050A/1100A/3100A
  - 가상 어플라이언스: HCI/SCP/Public Cloud/VMware
  - vSys: 멀티테넌시 지원 (신규)
  - IPv6: 향상된 지원
migration_steps:
  - 1단계: 현재 NGAF 정책/설정 백업
  - 2단계: NSF 모델 선정 (스펙/성능 매칭)
  - 3단계: NSF 배포 (하드웨어 또는 가상)
  - 4단계: 정책 마이그레이션 (수동 또는 도구)
  - 5단계: 테스트 검증
  - 6단계: 서비스 전환
evidence_sources: [{source: NSF Feature List v8.0.95, confidence: high}]
linked_pages: ["[[NGAF Overview]]", "[[NGAF Feature Map]]", "[[NGAF Open Issues]]"]
unresolved_questions: [정책 마이그레이션 자동화 도구, 마이그레이션 소요 시간]
```
