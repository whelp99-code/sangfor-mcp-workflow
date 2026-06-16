# SKE LLM Wiki Pages

> **Product**: Sangfor SKE (Sangfor Kubernetes Engine) v1.0.0
> **Evidence**: SKE Technical White Paper v1.0
> **Last Updated**: 2026-06-16

---

## Page 1: SKE Overview

```yaml
title: SKE Overview
product_name: SKE
summary: >
  Sangfor SKE는 HCI 기반 Kubernetes 엔진으로, 컨테이너 클러스터의 전체 생명주기를 관리한다.
  CRD 기반 아키텍처와 BFF 패턴을 사용하며, SCP와 통합되어 IaaS+PaaS를 하나의 콘솔에서 관리한다.
key_concepts:
  - HCI 기반 쿠버네티스 엔진
  - CRD (CustomResourceDefinition) 기반 확장
  - BFF (Backend for Frontend) 패턴
  - Cloudladder 보안 터널
  - SCP 통합 관리
related_components:
  - HCI (가상화 플랫폼)
  - SCP (클라우드 관리 콘솔)
  - aSAN (분산 스토리지)
  - Endpoint Secure (컨테이너 보안)
  - aNI (네트워크 인사이트)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch1 Product Overview
    confidence: high
linked_pages:
  - "[[SKE Architecture]]"
  - "[[SKE Components]]"
  - "[[SKE Feature Map]]"
unresolved_questions:
  - SKE 최신 버전 (v2.x 이상) 여부
  - Public Cloud 배포 지원 계획
  - GPU 스케줄링 지원 계획
```

---

## Page 2: SKE Architecture

```yaml
title: SKE Architecture
product_name: SKE
summary: >
  SKE는 Golang으로 개발되었으며, etcd/MongoDB/Redis 미들웨어를 사용한다.
  SCP를 기반으로 한 관리 플레인과 Cloudladder 터널로 연결된 User Cluster로 구성된다.
  최소 4 vCPU, 8GB RAM으로 동작한다.
key_concepts:
  - 관리 플레인 (SKE Management Plane): BFF, upgrade-manager, image management
  - User Cluster: kube-apiserver, etcd, kubelet, Cilium CNI, CSI Driver
  - Cloudladder 터널: 단방향 연결, 양방향 통신
  - kube-vip: Control Plane VIP, leader election
  - Mutual Exclusion Scheduling: Control Plane 노드 물리 호스트 분산
related_components:
  - SCP (하위 가상화 플랫폼 관리)
  - HCI (IaaS 인프라)
  - PlatOS (기반 OS, Linux-4.18.0 커널)
architecture: >
  SCP → SKE Management Plane (BFF + etcd/MongoDB/Redis) → Cloudladder Tunnel →
  User Cluster (3 Control Plane + N Worker Nodes) → HCI (aSAN/aNET)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch4 Product Architecture
    confidence: high
linked_pages:
  - "[[SKE Overview]]"
  - "[[SKE Components]]"
  - "[[SKE Data Flow]]"
  - "[[SKE Deployment Process]]"
unresolved_questions:
  - PlatOS 외 OS 지원 여부
  - x86 외 아키텍처 지원 계획
```

---

## Page 3: SKE Components

```yaml
title: SKE Components
product_name: SKE
summary: >
  SKE는 관리 플레인 컴포넌트와 User Cluster 컴포넌트로 구성된다.
  관리 플레인은 BFF, upgrade-manager, image management, admission control을 포함하고,
  User Cluster는 kubelet, Cilium CNI, CSI Driver, SKE Agent, Cloudladder, octopus를 포함한다.
key_concepts:
  - BFF Layer: list/watch 요청 최적화
  - cluster-api-provider-hci: SCP SDK 호출로 VM 관리
  - SKE Agent: User Cluster 내 명령 실행
  - Cloudladder: 보안 터널, 커스텀 협상 알고리즘
  - Cilium: eBPF 기반 CNI
  - aSAN CSI / EDS NAS CSI: 스토리지 드라이버
  - octopus: 메트릭 수집 에이전트
  - Loggie: 로그 수집 컴포넌트
  - MetalLB: LoadBalancer Service 지원
  - kube-vip: Control Plane HA (VIP + leader election)
  - Harbor: 이미지 레지스트리
related_components:
  - etcd (클러스터 상태 DB)
  - MongoDB (관리 데이터)
  - Redis (캐싱)
  - opensearch (로그 저장)
  - dragonfly (P2P 패키지 배포)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch5 SKE Capabilities, Ch6 User Cluster
    confidence: high
linked_pages:
  - "[[SKE Architecture]]"
  - "[[SKE Feature Map]]"
  - "[[SKE Monitoring and Log Flow]]"
  - "[[SKE Failure Handling]]"
unresolved_questions:
  - 서비스 이미지 레지스트리 가용성 (v1.0.0에서 미사용)
  - 이미지 관리 기능 가용성 (현재 미사용)
```

---

## Page 4: SKE Feature Map

```yaml
title: SKE Feature Map
product_name: SKE
summary: SKE의 전체 기능 목록과 카테고리별 분류
key_concepts:
  - 클러스터 관리: 생성/삭제, 노드 추가/제거, Mutual Exclusion Policy
  - 컨테이너 관리: Deployment, StatefulSet, DaemonSet, Job, CronJob, ConfigMap, Secret
  - 서비스 접속: NodePort, LoadBalancer(MetalLB), Ingress Gateway
  - 스토리지: aSAN CSI(iSCSI), EDS NAS CSI(NFS)
  - 이미지 관리: 시스템/서비스/서드파티 레지스트리 (Harbor)
  - 네트워크: Cilium(eBPF), DNS(CoreDNS), Service Discovery
  - 모니터링: CPU/메모리/디스크/네트워크 메트릭, 알림 정책
  - 로그: Pod 로그, 이벤트 로그, 감사 로그
  - 보안: Admission Control, 분산 방화벽, Cloudladder 터널
  - 권한: Feature Permission, Resource Permission (Manage/Develop/Read-Only)
  - 플러그인: Chart 패키지 기반 배포
  - 업그레이드: P2P 기반 패키지 분배
  - 관측성: aNI (네트워크 인사이트, Cilium 기반)
feature_map:
  cluster_management:
    - 클러스터 생성/삭제
    - 노드 추가/제거
    - Mutual Exclusion Scheduling
    - VIP 기반 Control Plane HA
  container_management:
    - 워크로드 관리 (Deployment, StatefulSet, DaemonSet)
    - Job/CronJob 스케줄링
    - ConfigMap/Secret 관리
    - Namespace 관리
  networking:
    - Cilium eBPF CNI
    - CoreDNS 서비스 디스커버리
    - MetalLB LoadBalancer
    - Ingress Gateway
    - 분산 방화벽 정책
  storage:
    - aSAN CSI (iSCSI 블록 스토리지)
    - EDS NAS CSI (NFS 파일 스토리지)
    - PV/PVC 자동 프로비저닝
  security:
    - Admission Control (Block/Allow+Audit)
    - 분산 방화벽 (Pod 격리)
    - Cloudladder 보안 터널
    - Endpoint Secure 연동
    - Tetragon (런타임 보안)
  observability:
    - 메트릭 수집 (octopus)
    - 알림 정책 (SCP 연동)
    - 로그 센터 (Loggie + opensearch)
    - 감사 로그 (kube-apiserver webhook)
    - aNI 네트워크 인사이트
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch5, Ch6
    confidence: high
linked_pages:
  - "[[SKE Components]]"
  - "[[SKE Data Flow]]"
  - "[[SKE Operations Process]]"
  - "[[SKE Security]]"
unresolved_questions:
  - GPU 스케줄링 미지원 (Ch8 명시)
  - HPA/VPA 지원 여부 미명시
```

---

## Page 5: SKE Data Flow

```yaml
title: SKE Data Flow
product_name: SKE
summary: SKE의 주요 데이터 흐름. 상세 내용은 [[ske_data_flow_process.md]] 참조.
key_concepts:
  - 관리자 접근: SCP → SKE → Kubernetes API
  - Pod 배포: Deployment → ReplicaSet → Pod → Container
  - 스토리지 프로비저닝: PVC → CSI → aSAN/EDS NAS → PV
  - 네트워크: Cilium eBPF → Pod-to-Pod/Service 통신
  - 모니터링: octopus → Time Series DB → SCP
  - 업그레이드: upgrade-manager → P2P 배포 → task-worker 실행
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch5, Ch6, Ch7
    confidence: high
linked_pages:
  - "[[ske_data_flow_process.md]]"
  - "[[SKE Architecture]]"
  - "[[SKE Deployment Process]]"
  - "[[SKE Monitoring and Log Flow]]"
unresolved_questions:
  - etcd 백업/복구 흐름 미명시
```

---

## Page 6: SKE Deployment Process

```yaml
title: SKE Deployment Process
product_name: SKE
summary: >
  SKE는 HCI 클러스터 위에 자동 배포된다. SCP에서 활성화하여 빠르게 컨테이너를 관리할 수 있다.
  User Cluster는 SCP 또는 Tenant가 생성할 수 있다.
key_concepts:
  - SKE 활성화: SCP에서 on-demand 활성화
  - 클러스터 생성: platform admin(클래식 네트워크), tenant(클래식/VPC)
  - 노드 배포: VM 기반, cluster-api-provider-hci가 SCP SDK 호출
  - SKE Agent 배포: Cloudladder 터널로 자동 배포
  - 플러그인 배포: kube-vip, CNI, CSI 자동 설치
related_components:
  - SCP (배포 오케스트레이션)
  - HCI (VM 관리)
  - cluster-api-provider-hci (VM 생명주기)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch4, Ch5.1.4
    confidence: high
linked_pages:
  - "[[SKE Architecture]]"
  - "[[SKE Components]]"
  - "[[SKE Upgrade]]"
unresolved_questions:
  - 배포 소요 시간 미명시
  - Public Cloud 배포 방법 미명시
```

---

## Page 7: SKE Operations Process

```yaml
title: SKE Operations Process
product_name: SKE
summary: SKE의 일상 운영 절차. 모니터링, 로그 검토, 권한 관리, 업그레이드 포함.
key_concepts:
  - 일간: 클러스터 상태 확인, 알림 확인
  - 주간: 리소스 사용률 트렌드, 로그 검토
  - 월간: 업그레이드 확인, 권한 검토
  - 권한 관리: SCP 사용자 시스템 통합, Feature/Resource 권한 분리
  - 플러그인 관리: Chart 패키지 기반 배포/편집/삭제
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch5.2, Ch5.4, Ch5.5, Ch5.6
    confidence: high
linked_pages:
  - "[[SKE Monitoring and Log Flow]]"
  - "[[SKE Feature Map]]"
  - "[[SKE Upgrade]]"
unresolved_questions:
  - 자동 스케일링 (HPA/VPA) 지원 여부
```

---

## Page 8: SKE Monitoring and Log Flow

```yaml
title: SKE Monitoring and Log Flow
product_name: SKE
summary: >
  모니터링은 octopus 에이전트 기반 메트릭 수집과 SCP 알림 정책 연동으로 구성된다.
  로그는 Loggie + opensearch 기반 Pod/이벤트 로그 수집과 kube-apiserver webhook 기반 감사 로그로 구성된다.
key_concepts:
  - octopus 에이전트: 각 노드에서 메트릭 수집
  - Time Series DB: 메트릭 저장
  - ruler: 알림 정책 쿼리 → 알림 생성
  - OPS-API: SCP 알림 정책 동기화
  - Loggie: Pod 로그 수집 (file collection)
  - opensearch: 로그 저장 및 쿼리
  - ulog-agent/ulog-server: 감사 로그 수집 및 전송
  - aNI: Cilium 기반 네트워크 트래픽 시각화
related_components:
  - SCP (알림 정책, 대시보드)
  - Cilium (네트워크 관측성)
  - Tetragon (보안 관측성)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch5.5, Ch5.6, Ch5.7, Ch6.5
    confidence: high
linked_pages:
  - "[[SKE Components]]"
  - "[[SKE Data Flow]]"
  - "[[SKE Operations Process]]"
  - "[[SKE Failure Handling]]"
unresolved_questions:
  - 로그 보존 기간 설정 방법
  - 외부 모니터링 시스템 연동 (Prometheus/Grafana)
```

---

## Page 9: SKE API and Automation Flow

```yaml
title: SKE API and Automation Flow
product_name: SKE
summary: >
  SKE는 SCP API를 통해 외부 시스템과 연동된다. BFF 패턴이 API 요청을 Kubernetes 리소스로 변환하고,
  Cloudladder 터널을 통해 User Cluster에 전달한다.
key_concepts:
  - SCP API: 외부 시스템 인터페이스
  - BFF 패턴: list/watch 요청 최적화, 리소스 소비 절감
  - Cloudladder: 보안 터널을 통한 클러스터 통신
  - SKE Agent: 클러스터 내 명령 실행
  - Kubernetes API: kube-apiserver 표준 API
technology_stack:
  language: Golang
  middleware: etcd, MongoDB, Redis
  os: PlatOS
  kernel: Linux-4.18.0
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch4, Ch5.1.4
    confidence: high
linked_pages:
  - "[[SKE Architecture]]"
  - "[[SKE Data Flow]]"
  - "[[SKE Deployment Process]]"
unresolved_questions:
  - REST API 엔드포인트 목록 미명시
  - CLI 도구 지원 여부
```

---

## Page 10: SKE Backup and DR Flow

```yaml
title: SKE Backup and DR Flow
product_name: SKE
summary: >
  SKE의 백업/DR 전략은 주로 IaaS 레이어의 HA에 의존한다.
  etcd 백업 절차는 White Paper에 명시되어 있지 않다.
key_concepts:
  - IaaS HA: VM 레벨 자동 복구
  - kube-vip: Control Plane VIP 자동 전환
  - Mutual Exclusion: Control Plane 노드 물리 호스트 분산
  - etcd 백업: ⚠️ 확인 필요
  - Velero 연동: ⚠️ 확인 필요
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch6.1.1
    confidence: high
linked_pages:
  - "[[SKE Architecture]]"
  - "[[SKE Failure Handling]]"
  - "[[SKE Deployment Process]]"
unresolved_questions:
  - etcd 백업/복구 절차
  - Velero 또는 기타 백업 도구 연동
  - 멀티 사이트 DR 전략
```

---

## Page 11: SKE Failure Handling

```yaml
title: SKE Failure Handling
product_name: SKE
summary: SKE의 장애 처리 메커니즘. 노드/Pod/스토리지/네트워크 장애별 복구 흐름.
key_concepts:
  - 노드 장애: IaaS HA → VM 재스케줄링
  - Control Plane 장애: kube-vip VIP 마이그레이션 → leader re-election
  - Pod 장애: kubelet 감지 → Controller Desired State 수렴 → 새 Pod 생성
  - 스토리지 장애: iSCSI 연결 끊김 → 노드 격리 감지 → CSI 재연결
  - 네트워크 장애: Cilium eBPF → 자동 라우팅調整
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch6.1.1, Ch6.1.2
    confidence: high
linked_pages:
  - "[[SKE Architecture]]"
  - "[[SKE Backup and DR Flow]]"
  - "[[SKE Monitoring and Log Flow]]"
unresolved_questions:
  - 장애 복구 시간 (RTO) 측정치
  - 데이터 손실 (RPO) 측정치
```

---

## Page 12: SKE Licensing

```yaml
title: SKE Licensing
product_name: SKE
summary: SKE 라이선스 정보. White Paper에 라이선스 관련 내용이 명시되어 있지 않다.
key_concepts:
  - SCP on-demand 활성화
  - 별도 라이선스 필요 여부: ⚠️ 확인 필요
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch4 (on-demand 활성화 언급)
    confidence: medium
linked_pages:
  - "[[SKE Overview]]"
  - "[[SKE Deployment Process]]"
unresolved_questions:
  - 라이선스 모델 (per-cluster, per-node, per-CPU 등)
  - Trial 라이선스 가용성
  - 가격 정책
```

---

## Page 13: SKE Competitive Comparison

```yaml
title: SKE Competitive Comparison
product_name: SKE
summary: SKE vs 경쟁 제품 비교. HCI 통합이 핵심 차별점.
competitive_comparison:
  - product: Rancher (SUSE)
    strengths: 멀티 클라우드, 무료 Community, 대규모 에코시스템
    weaknesses: 인프라 독립적, 별도 관리 필요
  - product: Red Hat OpenShift
    strengths: 엔터프라이즈급, CI/CD 통합, 서드파티 에코시스템
    weaknesses: 높은 비용, 복잡한 운영
  - product: EKS/AKS/GKE
    strengths: 퍼�블릭 클라우드 네이티브, 완전 관리형
    weaknesses: 클라우드 종속, 비용 예측 어려움
ske_differentiators:
  - HCI 완전 통합 (별도 인프라 불필요)
  - SCP 통합 관리 (IaaS+PaaS 원 콘솔)
  - aSAN CSI 내장 (스토리지 자동 프로비저닝)
  - Cilium eBPF (고성능/고보안 네트워크)
  - 자동 배포 (클릭 몇 번)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch1, Ch2, Ch4
    confidence: medium (일반 아키텍처 기준 포함)
linked_pages:
  - "[[SKE Overview]]"
  - "[[SKE Feature Map]]"
  - "[[SKE Customer Explanation]]"
unresolved_questions:
  - 벤치마크 성능 비교 데이터
```

---

## Page 14: SKE Customer Explanation

```yaml
title: SKE Customer Explanation
product_name: SKE
summary: 영업/프리세일즈용 고객 설명. 상세 내용은 [[ske_customer_explanation.md]] 참조.
key_concepts:
  - 즉시 사용 가능 (HCI 위 자동 배포)
  - 통합 관리 (IaaS+PaaS 원 콘솔)
  - 안정성 (3노드 HA, kube-vip)
  - 보안 (eBPF + Admission Control)
  - 운영 편의 (모니터링/알림 내장)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Ch2 Values for Customers
    confidence: high
linked_pages:
  - "[[ske_customer_explanation.md]]"
  - "[[SKE Overview]]"
  - "[[SKE Competitive Comparison]]"
unresolved_questions:
  - 고객 레퍼런스 사례
```

---

## Page 15: SKE Open Issues

```yaml
title: SKE Open Issues
product_name: SKE
summary: SKE 관련 미해결 항목 목록
open_issues:
  - category: 문서 부족
    items:
      - etcd 백업/복구 절차 미명시
      - Velero 연동 미명시
      - REST API 엔드포인트 목록 미명시
      - 라이선스 모델 미명시
  - category: 기능 제한
    items:
      - GPU 스케줄링 미지원 (Ch8 명시)
      - 서비스 이미지 레지스트리 v1.0.0에서 미사용
      - 이미지 관리 기능 현재 미사용
      - Public Cloud 배포 미지원 (HCI 전용)
  - category: 확인 필요
    items:
      - SKE 최신 버전 (v2.x 이상) 여부
      - HPA/VPA 지원 여부
      - 멀티 클러스터 페더레이션 지원
      - Endpoint Secure 컨테이너 보안 상세
      - 로그 보존 기간 설정 방법
      - 외부 모니터링 시스템 연동 (Prometheus/Grafana)
evidence_sources:
  - source: SKE Technical White Paper v1.0
    section: Various
    confidence: high
linked_pages:
  - "[[SKE Feature Map]]"
  - "[[SKE Backup and DR Flow]]"
  - "[[SKE Licensing]]"
```
