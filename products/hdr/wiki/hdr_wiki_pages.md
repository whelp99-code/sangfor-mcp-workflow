# hDR LLM Wiki Pages

> **Product**: Sangfor hDR v2.0
> **Evidence**: hDR User Manual V2.0
> **Last Updated**: 2026-06-16

---

## Page 1: hDR Overview
```yaml
title: hDR Overview
product_name: hDR
summary: 이기종 재해 복구 솔루션. VMware/물리 서버 → HCI 실시간 동기화, CDP, HA 지원.
key_concepts: [이기종 DR, Agent/Agentless, P2P/PCP 모드, CDP, HA Active-Standby, 원격 DR]
related_components: [HCI, VMware VADP, Bare Metal Recovery Boot Media, vmTools]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1, confidence: high}]
linked_pages: ["[[hDR Architecture]]", "[[hDR Components]]", "[[hDR Feature Map]]"]
unresolved_questions: [최신 버전 정보, RPO/RTO 측정치]
```

## Page 2: hDR Architecture
```yaml
title: hDR Architecture
product_name: hDR
summary: hDR Platform + Source Agent + Destination Bare Metal Recovery Boot Media 3-part 구성.
key_concepts: [hDR Platform (중앙 관리), DR Agent (소스 데이터 수집), Bare Metal Recovery Boot Media (대상 VM 부팅)]
architecture: >
  Source Server → Agent/VADP → hDR Platform → HCI API → Destination VM (Bare Metal Recovery Boot Media)
  Mode 1 (P2P): Source → Destination 직접 동기화 (hDR Platform 스토리지 미사용)
  Mode 2 (PCP): Source → hDR Platform 백업 → Destination 복구 (hDR Platform 스토리지 사용)
related_components: [HCI API, VMware VADP, 스토리지 유닛]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1.3, confidence: high}]
linked_pages: ["[[hDR Overview]]", "[[hDR Components]]", "[[hDR Data Flow]]", "[[hDR Deployment Process]]"]
unresolved_questions: [대규모 환경 성능, 클라우드 DR 지원]
```

## Page 3: hDR Components
```yaml
title: hDR Components
product_name: hDR
summary: hDR Platform, DR Agent (Active/Passive), Bare Metal Recovery Boot Media, 스토리지 유닛.
key_concepts:
  - hDR Platform: 연결 관리, HCI API 호출, VM 자동 생성, 백업 저장
  - DR Agent: 소스 서버 설치, Active(소스→Platform 연결)/Passive(Platform→소스 연결)
  - Bare Metal Recovery Boot Media: 대상 VM 첫 부팅, 데이터 수신, 호환성 처리
  - 스토리지 유닛: 데이터스토어, 스토리지 쿼터 관리
related_components: [Windows Agent, Linux Agent, VMware Agentless]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1.3, Ch5, confidence: high}]
linked_pages: ["[[hDR Architecture]]", "[[hDR Feature Map]]", "[[hDR Failure Handling]]"]
unresolved_questions: [Agent 버전별 호환성 상세]
```

## Page 4: hDR Feature Map
```yaml
title: hDR Feature Map
product_name: hDR
summary: hDR 전체 기능 분류. DR 모드별, 백업/복구별, 관리 기능별.
feature_map:
  dr_modes: [VM 동기화 DR (Agent P2P/PCP), VM 동기화 DR (Agentless), 핫스탠바이 CDP, 백업 복구 DR, HA Active-Standby, 원격 DR]
  backup_restore: [전체 머신 복구, 파일 복구, 볼륨 복구, Agentless 복구, Oracle RAC 클러스터 복구, 파일 검증]
  management: [사용자 관리, 스토리지 관리, 스토리지 쿼터, 네트워크 설정, 알림 설정, 라이선스 관리]
  agent: [Windows Agent (Active/Passive), Linux Agent (Active/Passive), Agentless VMware]
  monitoring: [시스템 상태, 작업 상태, 보안 상태, 스토리지 사용량, 이력 장비 상태]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch6, confidence: high}]
linked_pages: ["[[hDR Components]]", "[[hDR Data Flow]]", "[[hDR Operations Process]]"]
unresolved_questions: [GPU DR 지원, 컨테이너 DR 지원]
```

## Page 5: hDR Data Flow
```yaml
title: hDR Data Flow
product_name: hDR
summary: DR 모드별 데이터 흐름. 상세는 [[hdr_data_flow_process.md]] 참조.
key_concepts: [전체 동기화 → 증분 동기화, CDP 연속 보호, 페일오버/페일백, HCI API VM 생성]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1.3, Ch6.1, confidence: high}]
linked_pages: ["[[hdr_data_flow_process.md]]", "[[hDR Architecture]]", "[[hDR Failure Handling]]"]
unresolved_questions: [동기화 성능 메트릭]
```

## Page 6: hDR Deployment Process
```yaml
title: hDR Deployment Process
product_name: hDR
summary: VM 템플릿 배포 → 네트워크 설정 → 라이선스 → DR 소스 준비 → Agent 설치.
key_concepts:
  - VM 템플릿 배포: hDR Platform VM 생성
  - 네트워크 설정: IP, 라우트, 포트 연결 확인
  - 라이선스: Trial/Official, VM 동기화/CDP/백업별
  - 소스 준비: VMware(VADP 설정), Windows/Linux(Agent 설치)
  - 대상 준비: HCI 연결, 데이터스토어 설정
evidence_sources: [{source: hDR User Manual V2.0, section: Ch3, Ch5, confidence: high}]
linked_pages: ["[[hDR Architecture]]", "[[hDR Components]]", "[[hDR Licensing]]"]
unresolved_questions: [배포 소요 시간]
```

## Page 7: hDR Operations Process
```yaml
title: hDR Operations Process
product_name: hDR
summary: 일상 운영. 동기화 상태 확인, 스토리지 관리, 라이선스 관리, 시스템 업데이트.
key_concepts: [동기화 모니터링, 스토리지 쿼터, 사용자 관리, 시스템 업데이트, 로그 검토]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch7, confidence: high}]
linked_pages: ["[[hDR Monitoring and Log Flow]]", "[[hDR Feature Map]]"]
unresolved_questions: [자동화 API 지원 여부]
```

## Page 8: hDR Monitoring and Log Flow
```yaml
title: hDR Monitoring and Log Flow
product_name: hDR
summary: 시스템 상태, 작업 상태, 보안 상태, 스토리지 사용량 모니터링. 이메일 알림.
key_concepts: [하드웨어 상태, 작업 진행률, 보안 상태(System Admin), 스토리지 사용량, 이메일 알림, 기계 로그, 운영 로그]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch7.1-7.8, confidence: high}]
linked_pages: ["[[hDR Operations Process]]", "[[hDR Failure Handling]]"]
unresolved_questions: [외부 모니터링 연동]
```

## Page 9: hDR API and Automation Flow
```yaml
title: hDR API and Automation Flow
product_name: hDR
summary: HCI API를 통한 VM 자동 생성. VMware VADP API를 통한 Agentless 데이터 획득.
key_concepts: [HCI API (VM 생성), VMware VADP API (데이터 획득)]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1.3, confidence: high}]
linked_pages: ["[[hDR Architecture]]", "[[hDR Data Flow]]"]
unresolved_questions: [REST API 엔드포인트, CLI 도구, 외부 시스템 연동]
```

## Page 10: hDR Backup and DR Flow
```yaml
title: hDR Backup and DR Flow
product_name: hDR
summary: 핵심 DR 흐름. 동기화/CDP/백업/HA/원격 DR 모드별 상세.
key_concepts:
  - VM 동기화 DR: 전체→증분, P2P(직접)/PCP(Platform 경유)
  - CDP: 연속 데이터 보호, RPO≈0
  - 백업 복구: 스케줄 백업→복구
  - HA: Active-Standby 실시간 동기화, 자동 페일오버
  - 원격 DR: 로컬→원격 hDR 동기화
  - 페일오버: 대상 VM 시작→호환성 처리→IP 변경→서비스 인수
  - 페일백: 원본 복구→역방향 동기화→서비스 복귀
  - DR 테스트: 서비스 영향 없는 테스트 페일오버
evidence_sources: [{source: hDR User Manual V2.0, section: Ch6.1-6.4, confidence: high}]
linked_pages: ["[[hDR Data Flow]]", "[[hDR Architecture]]", "[[hDR Failure Handling]]"]
unresolved_questions: [RPO/RTO 측정치, 대역폭 요구사항]
```

## Page 11: hDR Failure Handling
```yaml
title: hDR Failure Handling
product_name: hDR
summary: 장애 유형별 복구 흐름.
key_concepts:
  - 소스 서버 장애: 페일오버 → 대상 VM 서비스 인수
  - 네트워크 장애: 재연결 시 동기화 자동 재개
  - Agent 장애: 에이전트 재설치/재연결
  - 스토리지 장애: 데이터스토어 연결 확인
  - 페일백: 원본 복구 후 역방향 동기화
evidence_sources: [{source: hDR User Manual V2.0, section: Ch6.1.6, Ch8, confidence: high}]
linked_pages: ["[[hDR Backup and DR Flow]]", "[[hDR Monitoring and Log Flow]]"]
unresolved_questions: [장애 복구 시간 측정치]
```

## Page 12: hDR Licensing
```yaml
title: hDR Licensing
product_name: hDR
summary: 라이선스 유형별 관리. Trial/Official, 소스 머신 그룹 기준.
key_concepts:
  - 라이선스 항목: VM 동기화 DR, CDP HA DR, 빠른 복구 DR, 백업 DR, Oracle RAC 백업
  - 소스 머신 그룹: 동일 소스 머신 그룹 기준 라이선스 계산
  - Trial 라이선스: 60일 체험
  - Official 라이선스: License Key File 방식
  - 라이선스 비정상: 만료/한도 초과 시 동기화 중단
evidence_sources: [{source: hDR User Manual V2.0, section: Ch3.4, confidence: high}]
linked_pages: ["[[hDR Deployment Process]]", "[[hDR Overview]]"]
unresolved_questions: [가격 정책, 라이선스 갱신 절차]
```

## Page 13: hDR Competitive Comparison
```yaml
title: hDR Competitive Comparison
product_name: hDR
summary: hDR vs Veeam/Zerto/Commvault 비교. HCI 통합이 핵심 차별점.
competitive_comparison:
  - {product: Veeam, strengths: "멀티 클라우드, 광범위 에이전트", weaknesses: "별도 인프라 필요, 높은 비용"}
  - {product: Zerto, strengths: "CDP 특화, 낮은 RPO", weaknesses: "높은 비용, VMware 중심"}
  - {product: Commvault, strengths: "엔터프라이즈급, 광범위 지원", weaknesses: "복잡한 운영, 높은 비용"}
hdr_differentiators: [HCI 완전 통합, 이기종 복구, Agent/Agentless 모두 지원, DR 테스트, 원격 DR]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1, confidence: medium}]
linked_pages: ["[[hDR Overview]]", "[[hDR Feature Map]]", "[[hDR Customer Explanation]]"]
unresolved_questions: [벤치마크 성능 비교]
```

## Page 14: hDR Customer Explanation
```yaml
title: hDR Customer Explanation
product_name: hDR
summary: 영업/프리세일즈용. 상세는 [[hdr_customer_explanation.md]] 참조.
key_concepts: [이기종 DR, CDP, 빠른 전환, DR 테스트, HCI 통합]
evidence_sources: [{source: hDR User Manual V2.0, section: Ch1, confidence: high}]
linked_pages: ["[[hdr_customer_explanation.md]]", "[[hDR Overview]]"]
unresolved_questions: [고객 레퍼런스]
```

## Page 15: hDR Open Issues
```yaml
title: hDR Open Issues
product_name: hDR
summary: hDR 미해결 항목.
open_issues:
  - {category: 문서 부족, items: [RPO/RTO 측정치 미명시, 대역폭 요구사항 미명시, REST API 엔드포인트 미명시]}
  - {category: 기능 제한, items: [클라우드 DR 미명시, Oracle RAC 외 DB DR 미명시]}
  - {category: 확인 필요, items: [최신 버전 정보, 대규모 환경 성능, 외부 모니터링 연동]}
evidence_sources: [{source: hDR User Manual V2.0, section: Various, confidence: high}]
linked_pages: ["[[hDR Feature Map]]", "[[hDR Backup and DR Flow]]"]
```
