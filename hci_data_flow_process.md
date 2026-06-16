# HCI Data Flow Process

> **Stage 7 Complete** | Last Updated: 2026-06-16 | 12 Data Flows | Evidence: Sangfor White Paper v6.10.0, User Manual v6.11.1, Backup Manual V1.4

## Table of Contents

1. [관리자 접근 흐름 (Admin Access Flow)](#1-관리자-접근-흐름-admin-access-flow)
2. [사용자/서비스 접근 흐름 (User/Service Access Flow)](#2-사용자서비스-접근-흐름-userservice-access-flow)
3. [VM 생성 흐름 (VM Creation Flow)](#3-vm-생성-흐름-vm-creation-flow)
4. [VM 운영 흐름 (VM Operations Flow)](#4-vm-운영-흐름-vm-operations-flow)
5. [스토리지 데이터 흐름 (Storage Data Flow)](#5-스토리지-데이터-흐름-storage-data-flow)
6. [네트워크 데이터 흐름 (Network Data Flow)](#6-네트워크-데이터-흐름-network-data-flow)
7. [스냅샷 데이터 흐름 (Snapshot Data Flow)](#7-스냅샷-데이터-흐름-snapshot-data-flow)
8. [백업 데이터 흐름 (Backup Data Flow)](#8-백업-데이터-흐름-backup-data-flow)
9. [DR 데이터 흐름 (Disaster Recovery Flow)](#9-dr-데이터-흐름-disaster-recovery-flow)
10. [장애 발생 시 데이터 흐름 (Failure Response Flow)](#10-장애-발생-시-데이터-흐름-failure-response-flow)
11. [모니터링/로그 흐름 (Monitoring/Log Flow)](#11-모니터링로그-흐름-monitoringlog-flow)
12. [API/자동화 흐름 (API/Automation Flow)](#12-api자동화-흐름-apiautomation-flow)

---

## 1. 관리자 접근 흐름 (Admin Access Flow)

### 1.1 Overview

관리자가 HCI 클러스터를 관리하기 위한 전체 접근 흐름. 웹 기반 Management Console을 통해 인증, RBAC, 클러스터/노드/VM/스토리지/네트워크 제어를 수행한다.

> **Evidence**: White Paper v6.10.0 Ch5.5, User Manual v6.11.1 Ch2-3 (sangfor_official, high confidence)

### 1.2 Flow Diagram

```
┌──────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐
│  Admin   │───►│ Management       │───►│ Control      │───►│ Cluster      │
│ (Browser)│    │ Console (Web UI) │    │ Plane        │    │ Nodes        │
└──────────┘    └──────────────────┘    └──────────────┘    └──────────────┘
     │                │                        │                    │
     │  1. HTTPS      │  2. Auth               │  3. API Call       │
     │  Login         │  + RBAC Check          │  + Task Queue      │
     │                │                        │                    │
     │                │  4. Dashboard ◄────────│  5. Metrics        │
     │                │     Render             │    Collection      │
     │                │                        │                    │
     │  6. Action     │  7. Command            │  8. Execution      │
     │  Request       │  Dispatch              │  on Target Node    │
     └────────────────┘────────────────────────┘────────────────────┘
```

### 1.3 Detailed Steps

| Step | Component | Action | Detail |
|------|-----------|--------|--------|
| 1 | Admin Browser | HTTPS Login | TLS 1.2/1.3 encrypted connection to Management Console |
| 2 | Management Console | Authentication | Username/password → session token. Supports LDAP/AD integration |
| 2a | Management Console | RBAC Check | Role-based permission verification (Admin/Operator/Viewer) |
| 3 | Control Plane | API Dispatch | REST API call to target service (aSV/aSAN/aNET) |
| 3a | Control Plane | Task Queue | Async task queued for execution |
| 4 | Management Console | Dashboard Render | Real-time cluster health, resource utilization, alerts |
| 5 | All Nodes | Metrics Collection | Periodic heartbeat + metric reporting to management plane |
| 6 | Admin | Action Request | VM create/migrate, storage config, network change, etc. |
| 7 | Control Plane | Command Dispatch | Command forwarded to target node(s) |
| 8 | Target Node | Execution | Command executed on local agent (aSV/aSAN/aNET) |

### 1.4 Authentication & RBAC

| Role | Permissions |
|------|------------|
| **Super Admin** | Full access: cluster, node, VM, storage, network, security, licensing |
| **Admin** | VM management, storage, network, monitoring |
| **Operator** | VM power operations, basic monitoring |
| **Viewer** | Read-only dashboard access |

> **Evidence**: User Manual v6.11.1 Ch3 (sangfor_official, high confidence)

### 1.5 SCP Multi-Cluster Management

```
┌─────────────────────────────────────────────────┐
│                    SCP Console                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │Cluster A │  │Cluster B │  │Cluster C │      │
│  │(HCI)     │  │(HCI)     │  │(HCI)     │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  Unified view: monitoring, alerts, management   │
└─────────────────────────────────────────────────┘
```

> **Evidence**: White Paper v6.10.0 Ch5.5 (sangfor_official, high confidence)

---

## 2. 사용자/서비스 접근 흐름 (User/Service Access Flow)

### 2.1 Overview

외부 사용자 또는 애플리케이션이 HCI 위에서 실행 중인 VM/서비스에 접근하는 흐름.

> **Evidence**: White Paper v6.10.0 Ch5.3, Ch5.6 (sangfor_official, high confidence)

### 2.2 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User /  │───►│ External │───►│ Physical │───►│ ToR      │───►│ Physical │
│  App     │    │ Network  │    │ Firewall │    │ Switch   │    │ NIC      │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
                                                                      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  VM      │◄───│ vSwitch/ │◄───│ VXLAN    │◄───│ Edge     │◄───│ Bond     │
│  Service │    │ DVS      │    │ Decap    │    │ Router   │    │ (NIC)    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 2.3 Detailed Steps

| Step | Component | Action | Detail |
|------|-----------|--------|--------|
| 1 | User/App | Service Request | HTTP/HTTPS/TCP/UDP to VM service IP |
| 2 | External Network | Routing | Internet/WAN routing to datacenter |
| 3 | Physical Firewall | Security Inspection | L3/L4 filtering (external security appliance) |
| 4 | ToR Switch | L2/L3 Switching | VLAN tagging, trunk to HCI node |
| 5 | Physical NIC | Packet Reception | NIC receives frame on trunk port |
| 6 | Bond (NIC) | Bond Selection | LACP/Active-Backup bond processing |
| 7 | Edge Router | VXLAN Processing | VXLAN decapsulation, routing to tenant network |
| 8 | Distributed Virtual Switch | L2 Switching | MAC-based forwarding to target VM vNIC |
| 9 | VM vNIC | Packet Delivery | VirtIO NIC receives packet |
| 10 | VM Service | Application Response | Service processes request and responds |

### 2.4 Internal VM-to-VM Traffic

```
VM-A (Node 1) → DVS → VXLAN Encap → Physical NIC → ToR → Physical NIC → VXLAN Decap → DVS → VM-B (Node 2)
VM-A (Node 1) → DVS → Local Switch → VM-B (Node 1)  [Same-node: no physical network]
```

> **Evidence**: White Paper v6.10.0 Ch5.3, Ch5.6 (sangfor_official, high confidence)

---

## 3. VM 생성 흐름 (VM Creation Flow)

### 3.1 Overview

관리자가 새 VM을 생성하는 전체 흐름. 템플릿 선택 → 자원 할당 → 스토리지 볼륨 생성 → 네트워크 연결 → VM 부트 → 모니터링 등록.

> **Evidence**: White Paper v6.10.0 Ch5.1, User Manual v6.11.1 Ch4 (sangfor_official, high confidence)

### 3.2 Flow Diagram

```
Admin Request
    │
    ▼
┌──────────────────┐
│ 1. Template /    │    Select OS template or ISO
│    Image Select  │    (QCOW2 base image)
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 2. Resource      │    CPU cores, memory, NUMA policy
│    Allocation    │    DRS placement decision
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 3. Storage       │    Create QCOW2 disk on aSAN
│    Volume Create │    Shard allocation + replica placement
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 4. Network       │    Attach vNIC to DVS/VLAN/VXLAN
│    Attachment     │    Configure IP (static/DHCP)
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 5. VM Boot       │    KVM/QEMU process start
│                  │    VirtIO driver initialization
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ 6. Monitoring    │    Register in metrics collector
│    Registration  │    Enable heartbeat monitoring
└──────────────────┘
```

### 3.3 Detailed Steps

| Step | Component | Action | Detail |
|------|-----------|--------|--------|
| 1 | Management Console | Template Selection | OS template (Windows/Linux) or ISO mount. Base image = QCOW2 format |
| 2 | aSV (DRS) | Placement Decision | NUMA-aware scheduling: selects node with sufficient CPU/memory, balanced load |
| 2a | aSV | Resource Reservation | Reserve CPU/memory for HA guarantee |
| 3 | aSAN | Volume Creation | Create QCOW2 file → allocate 4GB shards → place replicas on different nodes → stripe across disks |
| 3a | aSAN | Tier Assignment | Hot data path assigned to SSD cache tier |
| 4 | aNET | vNIC Attachment | Create VirtIO NIC → attach to distributed virtual switch → assign VLAN/VXLAN segment |
| 5 | aSV (KVM/QEMU) | VM Boot | Fork KVM process → load QCOW2 → initialize VirtIO buses → boot OS |
| 5a | aSV | BIOS/UEFI | Configure boot order, firmware settings |
| 6 | Management Console | Monitor Registration | Add VM to metrics collection, set alert thresholds |

### 3.4 Resource Allocation Decision Tree

```
VM Create Request
    │
    ├── CPU Required?
    │   ├── Check NUMA topology
    │   ├── Select optimal NUMA node
    │   └── Pin vCPU to physical core (optional)
    │
    ├── Memory Required?
    │   ├── Check available memory
    │   ├── Reserve for HA (if configured)
    │   └── Enable ballooning/KSM (if configured)
    │
    ├── Storage Required?
    │   ├── Check pool capacity
    │   ├── Allocate shards (4GB each)
    │   ├── Place replicas (2 or 3)
    │   └── Assign to tier (SSD cache)
    │
    └── Network Required?
        ├── Select DVS
        ├── Assign VLAN/VXLAN
        └── Configure bandwidth/QoS
```

> **Evidence**: White Paper v6.10.0 Ch5.1 (sangfor_official, high confidence)

---

## 4. VM 운영 흐름 (VM Operations Flow)

### 4.1 Overview

VM 런타임 중 지속적으로 발생하는 데이터 흐름: CPU/메모리 스케줄링, 가상 스위치, 분산 스토리지 I/O, 모니터링, 로그 수집.

> **Evidence**: White Paper v6.10.0 Ch5.1, Ch5.2, Ch5.6 (sangfor_official, high confidence)

### 4.2 Runtime Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      VM Runtime                          │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ vCPU     │    │ vMemory  │    │ vDisk    │          │
│  │ Threads  │    │ Pages    │    │ I/O      │          │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘          │
│       │               │               │                 │
│       ▼               ▼               ▼                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ KVM/QEMU │    │ Memory   │    │ VirtIO   │          │
│  │ Scheduler│    │ Manager  │    │ Block    │          │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘          │
└───────┼───────────────┼───────────────┼─────────────────┘
        │               │               │
        ▼               ▼               ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Physical │    │ NUMA     │    │ aSAN     │
  │ CPU Cores│    │ Memory   │    │ Storage  │
  └──────────┘    └──────────┘    └──────────┘
```

### 4.3 CPU/Memory Scheduling

| Process | Mechanism | Detail |
|---------|-----------|--------|
| CPU Scheduling | KVM vCPU → pCPU | vCPU threads scheduled on physical cores by Linux CFS |
| NUMA Scheduling | NUMA-aware placement | Memory allocated from local NUMA node for minimal latency |
| CPU Pinning | Optional vCPU→pCPU bind | For latency-sensitive workloads |
| Memory Ballooning | virtio-balloon driver | Reclaim unused VM memory for overcommit |
| KSM | Kernel Same-page Merging | Deduplicate identical memory pages across VMs |
| DRX | Dynamic Resource Extension | Auto-scale CPU/memory when VM hits threshold |

> **Evidence**: White Paper v6.10.0 Ch5.1, aSV White Paper (sangfor_official, high confidence)

### 4.4 Virtual Switch Traffic

```
VM-A vNIC → VirtIO Driver → DVS (MAC Table Lookup) → Local Port or Uplink
    │
    ├── Same Node: Direct DVS switching (no physical network)
    │
    └── Cross Node: DVS → VXLAN Encap → Physical NIC → Network → Remote NIC → VXLAN Decap → DVS → VM-B
```

### 4.5 Distributed Storage I/O (Runtime)

```
VM Application Write → Guest Filesystem → VirtIO Block → aSAN
    │
    ├── Check: Is data in SSD Cache? → Yes → Write to Cache → Async flush to HDD
    │                                 → No  → Write through
    │
    ├── Shard Selection: Hash(LBA) → Shard ID → Stripe Distribution
    │
    ├── Replica Write: Write to primary + replica(s) simultaneously
    │
    └── Ack: After all replicas confirmed → Return to VM
```

### 4.6 Monitoring & Log Collection (Runtime)

```
VM Metrics (CPU%, MEM%, IOPS, BW) → aSV Agent → Management Console → Dashboard
                                                                    → Alert Engine
                                                                    → Log Storage
```

> **Evidence**: White Paper v6.10.0 Ch5.1, Ch5.2, Ch5.5, Ch5.6 (sangfor_official, high confidence)

---

## 5. 스토리지 데이터 흐름 (Storage Data Flow)

### 5.1 Overview

aSAN 분산 스토리지의 전체 I/O 경로: VM Disk I/O → Hypervisor Storage Layer → Cache → Shard → Stripe → Replica → Physical Disk → Rebuild/Resync.

> **Evidence**: White Paper v6.10.0 Ch5.2 (sangfor_official, high confidence)

### 5.2 Complete I/O Path

```
┌──────────┐
│ VM Disk  │    Application Write Request
│ I/O      │
└────┬─────┘
     │
     ▼
┌──────────────────┐
│ VirtIO Block     │    Paravirtualized I/O driver
│ Driver           │    Zero-copy guest-to-hypervisor
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ aSAN Client      │    I/O routing to aSAN service
│ (Hypervisor)     │
└────┬─────────────┘
     │
     ▼
┌──────────────────────────────────────────────────┐
│ aSAN Storage Service                             │
│                                                  │
│  ┌──────────────┐                                │
│  │ 1. Cache     │    SSD Read/Write Cache        │
│  │    Lookup    │    Hybrid LRU + LFU eviction   │
│  └──────┬───────┘                                │
│         │ Cache Hit → Return immediately         │
│         │ Cache Miss ↓                           │
│  ┌──────┴───────┐                                │
│  │ 2. Shard     │    Hash(LBA) → Shard ID        │
│  │    Selection │    4GB fixed-size shards        │
│  └──────┬───────┘                                │
│         │                                        │
│  ┌──────┴───────┐                                │
│  │ 3. Stripe    │    Adaptive striping            │
│  │    Distribute│    Default 6-way, 128KB stripe  │
│  └──────┬───────┘                                │
│         │                                        │
│  ┌──────┴───────┐                                │
│  │ 4. Replica   │    Write to 2 or 3 replicas    │
│  │    Write     │    on different nodes           │
│  └──────┬───────┘                                │
│         │                                        │
│  ┌──────┴───────┐                                │
│  │ 5. Physical  │    SSD or HDD                  │
│  │    Disk Write│    Local disk on each node      │
│  └──────────────┘                                │
└──────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────┐
│ Ack to VM        │    After all replicas confirmed
└──────────────────┘
```

### 5.3 Read Path Optimization

```
VM Read Request → aSAN Client
    │
    ├── Tier 1: SSD Read Cache → Hit? → Return (fastest)
    │
    ├── Tier 2: Local Replica → Data on same node? → Return (local)
    │
    └── Tier 3: Remote Replica → Data on other node → RDMA/network fetch → Return
```

### 5.4 NUMA-Aware I/O Optimization

```
VM on NUMA Node 0 → aSAN I/O thread pinned to NUMA Node 0
    │
    ├── Memory allocation from NUMA Node 0 local memory
    ├── SSD on NUMA Node 0 preferred for cache
    └── Minimize cross-NUMA memory access
```

### 5.5 Sharding & Striping Detail

| Parameter | Value | Note |
|-----------|-------|------|
| Shard Size | 4GB | Fixed, uniform distribution |
| Stripe Width | Default 6, Max 12 | Adaptive based on disk count |
| Stripe Size | 128KB | Per-disk stripe unit |
| Replica Count | 2 or 3 | Configurable per storage pool |
| Distribution | Balanced | Equal data across all nodes/disks |

### 5.6 Cache Tier System

| Tier | Media | Role | Eviction |
|------|-------|------|----------|
| Write Cache | SSD (NVMe/SAS) | Buffer writes, async flush to HDD | Hybrid LRU+LFU |
| Read Cache | SSD (NVMe/SAS) | Cache hot read data | Heat map based |
| Capacity | HDD (SATA/SAS) | Long-term data storage | N/A |

### 5.7 Rebuild/Resync Flow

```
Disk/Node Failure Detected
    │
    ▼
aSAN detects missing replica
    │
    ▼
Identify affected shards
    │
    ▼
Read from surviving replicas
    │
    ▼
Rebuild to replacement disk/new node
    │
    ├── Parallel rebuild (multiple shards simultaneously)
    ├── Throttled I/O (minimize production impact)
    └── Progress tracking + alerting
    │
    ▼
Resync complete → Cluster healthy
```

### 5.8 RDMA / SPDK / Zero-Copy Paths

| Technology | Path | Benefit |
|-----------|------|---------|
| **Standard** | VM → VirtIO → Kernel aSAN → TCP → Remote Kernel → Disk | Baseline |
| **RDMA** | VM → VirtIO → Kernel aSAN → RDMA → Remote Memory → Disk | Lower latency, CPU offload |
| **SPDK Turbo** | VM → VirtIO → SPDK (user-space) → NVMe → Disk | Bypass kernel, highest IOPS |
| **Zero-Copy** | VM memory → Direct DMA to NIC → Network | Eliminate memory copy |

> **Evidence**: White Paper v6.10.0 Ch5.2 (sangfor_official, high confidence)

---

## 6. 네트워크 데이터 흐름 (Network Data Flow)

### 6.1 Overview

aNET의 VXLAN 기반 오버레이 네트워크 데이터 흐름. SDN 아키텍처(CMP/CCP/LCP/MB), 분산 가상 스위치, 엣지 라우터, 방화벽(FWaaS/DFW)을 포함.

> **Evidence**: White Paper v6.10.0 Ch5.3 (sangfor_official, high confidence)

### 6.2 SDN Architecture

```
┌─────────────────────────────────────────────────┐
│ CMP (Central Management Plane)                  │
│ - Global network policy                         │
│ - Topology management                           │
│ - Template management                           │
├─────────────────────────────────────────────────┤
│ CCP (Cluster Control Plane)                     │
│ - Per-cluster network orchestration             │
│ - DFW policy distribution                       │
│ - VXLAN tunnel management                       │
├─────────────────────────────────────────────────┤
│ LCP (Local Control Plane)                       │
│ - Per-node network agent                        │
│ - vSwitch management                            │
│ - Local policy enforcement                      │
├─────────────────────────────────────────────────┤
│ MB (Management Bus)                             │
│ - Control channel between CMP/CCP/LCP           │
│ - Policy synchronization                        │
└─────────────────────────────────────────────────┘
```

### 6.3 VM Network Traffic Flow

```
VM Application → Guest TCP/IP Stack → VirtIO NIC Driver
    │
    ▼
┌──────────────────┐
│ Distributed      │    OVS-based virtual switch
│ Virtual Switch   │    MAC learning, VLAN tagging
│ (DVS)            │    OpenFlow rules
└────┬─────────────┘
     │
     ├── DFW (Distributed Firewall) ──► Policy check (L3/L4/L7)
     │
     ▼
┌──────────────────┐
│ VXLAN            │    Encapsulate: Inner Ethernet + VXLAN header + Outer IP/UDP
│ Encapsulation    │    VNI (VXLAN Network Identifier) for tenant isolation
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Bond / NIC       │    LACP or Active-Backup
│ Team             │    Hash-based flow distribution
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Physical NIC     │    Wire-speed transmission
│ (10/25/100GbE)   │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ ToR Switch       │    Physical network infrastructure
└────┬─────────────┘
     │
     ├── Internal Traffic → Remote ToR → Remote NIC → VXLAN Decap → DVS → Remote VM
     │
     └── External Traffic → Edge Router → FWaaS → External Network
```

### 6.4 Edge Router Flow

```
Internal VXLAN Traffic → Edge Router
    │
    ├── NAT (SNAT/DNAT)
    ├── Routing (Static/OSPF/BGP)
    ├── FWaaS (Stateful Firewall, IPS)
    ├── Load Balancing
    └── QoS
    │
    ▼
External Physical Network
```

### 6.5 FWaaS (Cloud Firewall) Flow

```
Packet → Edge Router → FWaaS Engine
    │
    ├── L3/L4 Stateful Inspection
    ├── L7 Application Awareness
    ├── IPS (Intrusion Prevention)
    ├── URL Filtering
    ├── Anti-Virus
    └── Geo-IP Blocking
    │
    ├── Allow → Forward to destination
    └── Block → Drop + Log + Alert
```

### 6.6 DFW (Distributed Firewall) Flow

```
VM Traffic → DVS → DFW Policy Engine (on each node)
    │
    ├── Micro-segmentation: Per-VM security rules
    ├── Policy: Source VM → Dest VM → Protocol → Port → Action
    ├── Enforcement: Distributed (no central bottleneck)
    └── Logging: Per-flow audit log
```

> **Evidence**: White Paper v6.10.0 Ch5.3 (sangfor_official, high confidence)

---

## 7. 스냅샷 데이터 흐름 (Snapshot Data Flow)

### 7.1 Overview

aSAN의 VM/디스크 스냅샷 메커니즘. ROW(Redirect-on-Write) 방식으로 메타데이터 프리즈 → 델타 생성 → 스냅샷 체인 → 복원 포인트 → 롤백.

> **Evidence**: White Paper v6.10.0 Ch5.2 (sangfor_official, high confidence)

### 7.2 Snapshot Creation Flow

```
┌──────────────────┐
│ 1. Snapshot      │    Admin or scheduled trigger
│    Request       │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 2. Quiesce       │    Flush VM filesystem cache
│    (Optional)    │    Application-consistent snapshot
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 3. Metadata      │    Freeze current block map
│    Freeze        │    Mark all current blocks as read-only
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 4. Delta File    │    Create new delta QCOW2
│    Creation      │    All new writes go to delta (ROW)
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 5. Snapshot      │    Link: Base → Snap1 → Snap2 → ... → Active
│    Chain Update  │    Each snapshot = pointer to frozen state
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 6. Confirmation  │    Snapshot ID + timestamp recorded
│                  │    Memory snapshot optional (VM state)
└──────────────────┘
```

### 7.3 Snapshot Read Path

```
Read Request for Block X
    │
    ├── Check Active Delta → Found? → Return
    │
    ├── Check Latest Snapshot Delta → Found? → Return
    │
    ├── Walk snapshot chain backwards → Found? → Return
    │
    └── Read from Base Image → Return
```

### 7.4 Snapshot Rollback Flow

```
Rollback to Snapshot N
    │
    ▼
Identify Snapshot N in chain
    │
    ▼
Discard all deltas after Snapshot N
    │
    ▼
Reset active pointer to Snapshot N
    │
    ▼
VM resumes from Snapshot N state
    │
    ├── If memory snapshot: Restore VM memory state (instant resume)
    └── If disk-only: VM reboot from disk state
```

> **Evidence**: White Paper v6.10.0 Ch5.2 (sangfor_official, high confidence)

---

## 8. 백업 데이터 흐름 (Backup Data Flow)

### 8.1 Overview

Sangfor Backup Platform (SBP)의 에이전트리스 VM 백업 흐름. 스냅샷 기반 + CBT 증분 백업, AES 암호화, GFS 보존 정책, 복원 절차.

> **Evidence**: Backup Manual V1.4 (sangfor_official, high confidence — Google Translate quality)

### 8.2 Backup Flow

```
┌──────────────────┐
│ 1. Backup        │    Manual or scheduled trigger
│    Policy Check  │    Verify backup window
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 2. VM Snapshot   │    aSV API: Create VM snapshot
│    (Agentless)   │    Application-consistent (quiesce)
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 3. CBT Analysis  │    Changed Block Tracking
│    (Incremental) │    Identify changed blocks since last backup
│                  │    First backup = Full (all blocks)
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 4. Data Transfer │    Transfer changed blocks only
│                  │    Transport: Direct SAN / Hot-Add / Auto
└────┬─────────────┘
     │
     ├── Transport Mode: Direct SAN Access (preferred)
    │    └── Backup proxy reads directly from aSAN storage
    │
    ├── Transport Mode: Virtual Appliance (Hot-Add)
    │    └── Snapshot mounted to proxy VM, read via virtual disk
    │
    └── Transport Mode: Automatic
         └── System selects best available mode
     │
     ▼
┌──────────────────┐
│ 5. Processing    │
│    ├── Dedup     │    Inline deduplication (optional per repo)
│    ├── Compress  │    4 levels: None / Low / Medium / High
│    └── Encrypt   │    AES encryption via DEK
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 6. Repository    │    Write to backup repository
│    Storage       │    Full + Incremental chain
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 7. Retention     │    Apply GFS policy
│    Management    │    Weekly/Monthly/Yearly tags
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 8. Cleanup       │    Remove expired restore points
│                  │    Merge old increments into synthetic full
└──────────────────┘
```

### 8.3 Backup Types

| Type | Description | Data Transferred | Production Impact |
|------|-------------|-----------------|-------------------|
| **Full** | Complete VM copy | All blocks | High (first backup) |
| **Incremental** | Changed blocks only | CBT-identified blocks | Low |
| **Synthetic Full** | Constructed from increments | No production read | None |
| **Backup Copy** | Re-copy to different repo | Existing backup data | None |

### 8.4 Restore Flow

```
┌──────────────────┐
│ 1. Select        │    Choose restore point (full/incremental)
│    Restore Point │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ 2. Choose        │    Original host / Different host
│    Destination   │    Original storage / Different storage
└────┬─────────────┘
     │
     ├── Full VM Restore
    │    └── Extract VM image → Register on target host → Power on
    │
    ├── Fine-Grained File Restore (Agentless)
    │    └── Mount backup → Browse files via web UI → Download selected
    │
    ├── Fine-Grained File Restore (Agent)
    │    └── Mount on proxy → Browse files → Restore to location
    │
    └── Virtual Disk Restore
         └── Restore individual disk → Attach to target VM
     │
     ▼
┌──────────────────┐
│ 3. Verify        │    Check integrity, boot test
└──────────────────┘
```

### 8.5 3-2-1 Strategy

```
Production VM → Backup Repository (Primary) → Backup Copy → Secondary Repository
    │               │                                │
    │          3 copies                          Different location
    │          2 media types
    │          1 offsite
```

> **Evidence**: Backup Manual V1.4 (sangfor_official, high confidence)

---

## 9. DR 데이터 흐름 (Disaster Recovery Flow)

### 9.1 Overview

HCI의 재해 복구 흐름. 스트레치 클러스터(동기 복제, RPO=0)와 비동기 DR(예약 동기화) 두 가지 모드를 지원. DR Best Practices 문서에 따르면, 비동기 DR은 스케줄 백업 + CDP(Continuous Data Protection) 두 가지 동기화 방식을 지원하며, RPO 전략은 **1초~1주** 범위에서 설정 가능하다.

> **Evidence**: White Paper v6.10.0 Ch5.2, DR Best Practices v01 (2023-05-03) (sangfor_official, high confidence)

### 9.1a DR 아키텍처 (DR Best Practices 기반)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Primary Site (A)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Business │  │ Business │  │ Business │  │ Business │       │
│  │ VM (Mail)│  │VM(Order) │  │VM (ERP1) │  │VM (ERP2) │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │              │
│       ▼              ▼              ▼              ▼              │
│  ┌──────────────────────────────────────────────────┐           │
│  │              aSAN Storage (ASAN)                  │           │
│  └──────────────────────────────────────────────────┘           │
│  ┌──────────────────────────────────────────────────┐           │
│  │         Local Backup (EDS Storage)                │           │
│  └──────────────────────────────────────────────────┘           │
│  ┌──────────────────────────────────────────────────┐           │
│  │         IO-log Storage (iSCSI)                    │           │
│  └──────────────────────────────────────────────────┘           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    DR Link (VPN / L2 / L3)
                    Bandwidth ≥ 10 Mbps recommended
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                       Secondary Site (B)                         │
│  ┌──────────────────────────────────────────────────┐           │
│  │              aSAN Storage (ASAN)                  │           │
│  └──────────────────────────────────────────────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ DR VM    │  │ DR VM    │  │ DR VM    │  │ DR VM    │       │
│  │ (Mail)   │  │ (Order)  │  │ (ERP1)   │  │ (ERP2)   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 9.1b RPO/RTO 요구사항 예시 (DR Best Practices 기반)

| 비즈니스 시스템 | RPO | RTO | 보존 기간 | 동기화 방식 | 비고 |
|----------------|-----|-----|----------|------------|------|
| 메일 시스템 | 1시간 이내 | 1시간 이내 | 1개월 | 스케줄 백업 (4시간 간격) | 내부 커뮤니케이션 |
| 주문 시스템 | **1초** | 15분 이내 | 1개월 | CDP (연속 복제) | 24/7 전국 운영, 핵심业务 |
| ERP 시스템 1 | 8시간 | 1시간 이내 | 1개월 | 스케줄 백업 (8시간 간격) | 일반业务 |
| ERP 시스템 2 | 1초 | 15분 이내 | 1개월 | CDP (연속 복제) | 중요业务 |

### 9.1c DR 네트워크 요구사항

| 항목 | 요구사항 |
|------|---------|
| **링크 유형** | L2 (동일 서브넷) 또는 L3 (NAT 프록시) |
| **권장 대역폭** | ≥ 10 Mbps (다수 CDP 시스템 시) |
| **권장 VPN** | Sangfor VPN 또는 통신사 VPN 전용선 |
| **네트워크 손실률** | 70~80% 기준으로 대역폭 계산 |
| **L2 연결** | DR 포트 IP가 동일 서브넷, ping 가능 |
| **L3 연결** | 서로 다른 서브넷, NAT 프록시 + 다음 홉 라우트 필요 |

### 9.1d 대역폭 계산 공식 (DR Best Practices 기반)

```
스케줄 백업 (메일 시스템, 24시간 RPO):
  대역폭 = 데이터 증가량 × 1024 × 8 / 동기화 윈도우 / 손실률
         = 20G × 1024 × 8 / (10 × 3600) / 0.7
         = 6.5 Mbps

CDP (주문 시스템, 1초 RPO):
  평균 IO 속도 = 5GB × 1024 × 1024 × 8 / (7 × 3600) = 160 Kbps
  피크 IO = 160 × 5 = 800 Kbps
  필요 대역폭 = 800 / 0.7 = 1,143 Kbps ≈ 1.2 Mbps
```

### 9.2 Stretched Cluster DR (Synchronous)

```
Site A (Primary)                    Site B (Secondary)
┌──────────────────┐              ┌──────────────────┐
│ VM Running       │              │ VM Standby       │
│ (Active)         │              │ (Active/Standby) │
└────┬─────────────┘              └────┬─────────────┘
     │                                 │
     ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│ aSAN Storage     │◄── Sync ────►│ aSAN Storage     │
│ (Replica 1)      │  Replication │ (Replica 2)      │
└────┬─────────────┘              └────┬─────────────┘
     │                                 │
     └──────────┬──────────────────────┘
                │
                ▼
         ┌──────────────┐
         │ Witness Node  │    Arbitration for split-brain
         │ (3rd site or  │    Quorum-based decision
         │  cloud)       │
         └──────────────┘
```

| Parameter | Value |
|-----------|-------|
| RPO | 0 (synchronous) |
| RTO | Seconds (automatic failover) |
| Replication | Synchronous (write confirmed on both sites) |
| Split-brain | Witness node arbitration |
| Failover | Automatic (HA-triggered) |
| Failback | Manual or automatic |

### 9.3 Asynchronous DR Flow

```
Production Site                    DR Site
┌──────────────────┐              ┌──────────────────┐
│ VM Running       │              │ DR VM            │
│ (Active)         │              │ (Powered Off)    │
└────┬─────────────┘              └────┬─────────────┘
     │                                 │
     ▼                                 ▼
┌──────────────────┐   Scheduled   ┌──────────────────┐
│ aSAN Storage     │── Replication ►│ aSAN Storage     │
│ (Primary)        │   (Interval)  │ (DR Copy)        │
└──────────────────┘              └──────────────────┘
     │                                 │
     │  Journal / CDP                   │
     │  (Continuous Data Protection)    │
     │  Point-in-time recovery          │
```

| Parameter | Value |
|-----------|-------|
| RPO | Minutes (configurable interval) |
| RTO | Minutes (manual failover) |
| Replication | Asynchronous (periodic sync) |
| Journal | CDP for point-in-time recovery |
| Failover | Manual trigger |
| Failback | Manual (resync + switchback) |

### 9.4 Failover Flow

```
Disaster Event (Site A down)
    │
    ├── Stretched Cluster: Automatic
    │   ├── Witness detects Site A failure
    │   ├── HA triggers VM restart on Site B
    │   ├── Site B storage becomes primary
    │   └── Service restored in seconds
    │
    └── Async DR: Manual
        ├── Admin detects failure
        ├── Admin initiates failover on DR site
        ├── DR VM registered and powered on
        ├── DR storage promoted to primary
        └── Service restored in minutes
```

### 9.5 Failback Flow

```
Production Site Recovered
    │
    ▼
Resync: DR Site → Production Site (reverse replication)
    │
    ▼
Verify: Data consistency check
    │
    ▼
Switchback: Migrate services back to production
    │
    ├── Planned (scheduled maintenance window)
    └── Unplanned (emergency)
    │
    ▼
DR Site returns to standby/replication mode
```

> **Evidence**: White Paper v6.10.0 Ch5.2, DR Best Practices (sangfor_official, high confidence)

---

## 10. 장애 발생 시 데이터 흐름 (Failure Response Flow)

### 10.1 Overview

다양한 장애 유형(노드, 디스크, 네트워크, VM)에 대한 자동 감지 → HA 트리거 → 자원 재계산 → VM 재시작/마이그레이션 → 스토리지 리빌드 → 알림.

> **Evidence**: White Paper v6.10.0 Ch5.1, Ch5.2 (sangfor_official, high confidence)

### 10.2 Failure Detection & Response Matrix

| Failure | Detection | Response | Recovery Time |
|---------|-----------|----------|---------------|
| **VM Crash** | Guest agent heartbeat / QEMU watchdog | Auto restart (same node) | Seconds |
| **Node Failure** | Cluster heartbeat (3 consecutive misses) | HA: VM restart on survivors | 30-120 seconds |
| **Disk Failure** | SMART / aSAN health check | Rebuild from replica | Hours (background) |
| **NIC Failure** | Bond monitoring (link state) | Bond failover (active-backup) | Milliseconds |
| **Network Partition** | Witness arbitration | Quorum decision (majority wins) | Seconds |
| **Storage Pool Full** | Capacity threshold alert | Alert + auto-throttle | N/A (manual) |
| **Site Failure** | Stretched cluster heartbeat | Automatic failover (if stretched) | Seconds-Minutes |

### 10.3 Node Failure Flow (Detailed)

```
Node Failure Detected
    │
    ├── Detection: Cluster heartbeat timeout (configurable, default ~10s)
    │
    ▼
HA Triggered
    │
    ├── 1. Identify affected VMs on failed node
    │
    ├── 2. Resource Recalculation
    │   ├── Check available CPU/memory on surviving nodes
    │   ├── Verify HA resource reservation
    │   └── Select target nodes (DRS placement)
    │
    ├── 3. VM Restart
    │   ├── Priority-based restart (configurable order)
    │   ├── Register VM on target node
    │   ├── Mount QCOW2 disks (aSAN provides storage)
    │   ├── Attach vNICs (aNET provides network)
    │   └── Boot VM (cold restart — not live migration)
    │
    ├── 4. Storage Rebuild/Resync
    │   ├── Detect missing replicas on failed node
    │   ├── Start background rebuild to other nodes
    │   ├── Throttled I/O to minimize impact
    │   └── Progress: Alert when complete
    │
    ├── 5. Network Update
    │   ├── Update DVS MAC tables
    │   ├── Update VXLAN tunnel endpoints
    │   └── Update DFW rules for moved VMs
    │
    └── 6. Alert & Logging
        ├── Email/SMS/Syslog/SNMP notification
        ├── Audit log entry
        └── Dashboard status update
```

### 10.4 Disk Failure Flow

```
Disk Failure Detected (SMART / aSAN health)
    │
    ▼
Mark disk as failed → Remove from active pool
    │
    ▼
Identify affected shards on failed disk
    │
    ▼
For each affected shard:
    ├── Read data from replica(s) on other disks/nodes
    ├── Write replica to spare disk or redistribute
    └── Verify data integrity (checksum)
    │
    ▼
Rebuild complete → Pool healthy
    │
    └── Alert: "Disk X failed, rebuild complete"
```

### 10.5 Network Failure Flow

```
NIC Link Down Detected
    │
    ▼
Bond Failover (Active-Backup)
    ├── Switch traffic to standby NIC
    ├── Update bond state
    └── Traffic resumes (milliseconds)
    │
    ▼
If both NICs down:
    ├── VM network isolated
    ├── HA may trigger (if configured)
    └── Alert: "Network failure on Node X"
```

> **Evidence**: White Paper v6.10.0 Ch5.1, Ch5.2, Ch5.3 (sangfor_official, high confidence)

---

## 11. 모니터링/로그 흐름 (Monitoring/Log Flow)

### 11.1 Overview

실시간 메트릭 수집, 알림 엔진, 로그 중앙화, 성능 대시보드, 용량 계획.

> **Evidence**: White Paper v6.10.0 Ch5.5 (sangfor_official, high confidence)

### 11.2 Monitoring Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Management Console                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │Dashboard │  │ Alert    │  │ Report   │  │ API    │ │
│  │& Charts  │  │ Engine   │  │ Engine   │  │ Export │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬───┘ │
│       │              │              │              │     │
│       └──────────────┴──────────────┴──────────────┘     │
│                          │                               │
│                   ┌──────┴──────┐                        │
│                   │ Time-Series │                        │
│                   │ Database    │                        │
│                   └──────┬──────┘                        │
└──────────────────────────┼───────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
    │ Node    │      │ Node    │      │ Node    │
    │ Metrics │      │ Metrics │      │ Metrics │
    │ Agent   │      │ Agent   │      │ Agent   │
    └─────────┘      └─────────┘      └─────────┘
```

### 11.3 Metrics Collected

| Category | Metrics | Collection Interval |
|----------|---------|---------------------|
| **Node** | CPU%, Memory%, Disk I/O, Network BW, Temperature | 5-30 seconds |
| **VM** | CPU%, Memory%, Disk I/O, Network BW, Process count | 5-30 seconds |
| **Storage** | IOPS, Latency, Throughput, Capacity, Health | 5-30 seconds |
| **Network** | Bandwidth, Packet loss, Latency, Flow count | 5-30 seconds |
| **Cluster** | Health score, Resource utilization, Alert count | 30-60 seconds |

### 11.4 Alert Flow

```
Metric Threshold Exceeded
    │
    ▼
Alert Engine Evaluation
    │
    ├── Check: Severity (Critical/Warning/Info)
    ├── Check: Suppression rules
    ├── Check: Escalation policy
    │
    ▼
Alert Dispatched
    │
    ├── Email → Admin mailbox
    ├── SMS → Admin mobile
    ├── Syslog → SIEM / Log server
    ├── SNMP Trap → NMS (Nagios, Zabbix, etc.)
    └── Dashboard → Real-time alert panel
    │
    ▼
Alert Lifecycle
    │
    ├── Active → Acknowledged → Resolved
    ├── Auto-resolve if metric returns to normal
    └── Escalate if unresolved for N minutes
```

### 11.5 Log Flow

```
Component Logs (aSV, aSAN, aNET, aSecurity)
    │
    ▼
Local Log Buffer (per node)
    │
    ▼
Log Forwarding
    │
    ├── Management Console → Internal log storage
    ├── Syslog → External syslog server (UDP/TCP/TLS)
    └── SNMP → NMS trap receiver
    │
    ▼
Log Analysis
    │
    ├── Dashboard: Real-time log viewer
    ├── Search: Full-text log search
    ├── Export: CSV/API log export
    └── SkyOPS: Advanced analytics (if licensed)
```

> **Evidence**: White Paper v6.10.0 Ch5.5 (sangfor_official, high confidence)

---

## 12. API/자동화 흐름 (API/Automation Flow)

### 12.1 Overview

RESTful OpenAPI를 통한 프로그래밍 방식 관리. 인증 → RBAC → Control Plane → Task Queue → 실행 → 감사 로그.

> **Evidence**: White Paper v6.10.0 Ch5.5, OpenAPI Guide (sangfor_official, high confidence for architecture, medium for API details)

### 12.1a OpenAPI 아키텍처 (OpenAPI Guide 기반)

HCI의 OpenAPI는 **OpenStack 기반**으로 구현되어 있다. 6개 모듈, 64개 외부 인터페이스를 제공한다.

| 모듈 | 인터페이스 수 | 역할 |
|------|-------------|------|
| **Keystone** (v2.0) | 4 | 인증 관리 — 토큰 발급, 테넌트 인증 |
| **Nova** (v2) | 22 | VM 생명주기 관리 — 생성/삭제/전원/콘솔/볼륨 마운트 |
| **Cinder** (v2) | 10 | 볼륨 관리 — 생성/삭제/확장/쿼리 |
| **Neutron** (v2.0) | 19 | 네트워크 리소스 관리 |
| **Gnocchi** (v1) | 3 | 모니터링 지표 데이터 |
| **Glance** (v2) | 4 | 이미지 서비스 — 이미지 목록/상세 조회 |
| **Extensions** | 2 | Sangfor 확장 인터페이스 (OpenStack 비표준) |

**엔드포인트 구성**: `https://{acmp_ip}/openstack/{module}/{version}/{resource-path}`

**인증 흐름**:
```
1. POST /openstack/identity/v2.0/tokens (username + password + tenant)
2. Keystone 응답에서 token.id 획득
3. 이후 모든 요청에 X-Auth-Token 헤더에 token.id 포함
```

**멱등성 보장**: `X-Client-Token` 헤더로 중복 요청 방지 (5분 유효). VM 생성, 볼륨 생성, EIP 생성, Flavor 생성, NIC 마운트, EIP 업데이트에 적용.

> **Evidence**: API_HCI_SCP_open-api_Eng.Ver- Overview & user guide.pdf (sangfor_official, high confidence)

### 12.2 API Architecture

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│ Client   │───►│ API Gateway  │───►│ Auth & RBAC  │───►│ Control  │
│ (App/    │    │ (HTTPS)      │    │              │    │ Plane    │
│  Script) │    │              │    │ Token Verify │    │          │
└──────────┘    └──────────────┘    │ Permission   │    └────┬─────┘
                                    └──────────────┘         │
                                                             ▼
                                                      ┌──────────────┐
                                                      │ Task Queue   │
                                                      │ (Async)      │
                                                      └────┬─────────┘
                                                           │
                                                           ▼
                                                      ┌──────────────┐
                                                      │ Execution    │
                                                      │ Engine       │
                                                      └────┬─────────┘
                                                           │
                                                           ▼
                                                      ┌──────────────┐
                                                      │ Audit Log    │
                                                      │ + Response   │
                                                      └──────────────┘
```

### 12.3 API Request Flow

| Step | Component | Action | Detail |
|------|-----------|--------|--------|
| 1 | Client | API Request | HTTPS REST call with token |
| 2 | API Gateway | TLS Termination | Decrypt, validate request format |
| 3 | Auth Module | Token Validation | Verify JWT/session token |
| 4 | RBAC Module | Permission Check | Check user role vs required permission |
| 5 | Control Plane | Request Routing | Route to appropriate service (aSV/aSAN/aNET) |
| 6 | Task Queue | Task Creation | Async task queued (for long operations) |
| 7 | Execution | Command Execution | Execute on target node(s) |
| 8 | Audit Log | Log Entry | Record: who, what, when, result |
| 9 | Response | Return Result | HTTP 200 + JSON response (or task ID for async) |

### 12.4 API Categories

| Category | Operations | Sync/Async |
|----------|-----------|------------|
| **VM Management** | Create, Delete, Start, Stop, Migrate, Resize, Snapshot | Mixed |
| **Storage Management** | Pool create, Disk add, Tier config, Snapshot management | Mostly Async |
| **Network Management** | VLAN/VXLAN config, DFW rules, Edge router config | Mixed |
| **Monitoring** | Get metrics, Get alerts, Get health status | Sync |
| **Cluster Management** | Node add/remove, Upgrade, License management | Async |
| **User Management** | Create user, Assign role, LDAP config | Sync |

### 12.5 SCC (Sangfor Cloud Center) Automation

```
SCC Automation Engine
    │
    ├── Playbook / Workflow Definition
    │   ├── Step 1: Check prerequisites
    │   ├── Step 2: Execute API calls
    │   ├── Step 3: Verify results
    │   └── Step 4: Report
    │
    ├── Scheduled Execution
    │   ├── Cron-based scheduling
    │   └── Event-based triggers
    │
    └── Integration
        ├── Ansible modules (if available)
        ├── Terraform provider (if available)
        └── Custom scripts via OpenAPI
```

> **Evidence**: White Paper v6.10.0 Ch5.5, OpenAPI Guide (sangfor_official, medium confidence — API details partially documented)

---

## Appendix: Evidence Source Summary

| # | Source Document | Type | Version | Confidence | Flows Referenced |
|---|----------------|------|---------|------------|-----------------|
| 1 | White Paper v6.10.0 | Technical White Paper | 6.10.0 | High | All 12 flows |
| 2 | White Paper - aSV | Technical White Paper | 6.10.0 | High | Flow 3, 4, 10 |
| 3 | User Manual v6.11.1 | User Manual | 6.11.1 | High | Flow 1, 3, 4, 15 |
| 4 | Backup Manual V1.4 | Backup Manual | 1.4 | Medium | Flow 8 |
| 5 | DR Best Practices | Best Practice Guide | - | High | Flow 9, 10 |
| 6 | OpenAPI Guide | API Documentation | 2024-05 | Medium | Flow 12 |

### Evidence Classification Legend

| Tag | Meaning |
|-----|---------|
| `sangfor_official` | From official Sangfor documentation |
| `general_hci` | General HCI architecture knowledge (industry standard) |
| `inferred` | Inferred from partial documentation |
| `문서 근거 없음` | No document evidence — requires verification |

> **⚠️ Note**: All 12 data flows are based on Sangfor official documentation (White Paper v6.10.0, User Manual v6.11.1, Backup Manual V1.4). Specific implementation details may vary by version and configuration. Items marked "일반 HCI 아키텍처 기준" use industry-standard HCI patterns where Sangfor-specific documentation was not available.
