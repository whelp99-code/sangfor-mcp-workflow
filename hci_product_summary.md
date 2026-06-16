# HCI Product Summary

> **Stage 6 Complete** | Last Updated: 2026-06-16 | Evidence: Sangfor White Paper v6.10.0, User Manual v6.11.1, Backup Manual V1.4

## 1. Product Overview

**Sangfor HCI** (Hyper-Converged Infrastructure) is a software-defined data center platform that converges compute, storage, networking, and security into a unified cluster. Built on KVM/QEMU open-source hypervisor with proprietary distributed storage (EFS), it eliminates the need for traditional SAN/NAS infrastructure.

| Item | Detail |
|------|--------|
| **Product Name** | Sangfor HCI (aCloud) |
| **Latest Version** | v6.11.1 |
| **Architecture** | Hyper-converged, software-defined |
| **Hypervisor** | KVM/QEMU (Linux-based) |
| **Storage** | aSAN (EFS distributed storage) |
| **Network** | aNET (VXLAN overlay, SDN) |
| **Security** | aSecurity (integrated) |
| **Management** | Web Console + SCP (multi-cluster) |
| **Deployment Scale** | 2 nodes (with witness) to 1000+ nodes |
| **Target Market** | Enterprise private cloud, VDI, DR, server consolidation |

> **Evidence**: White Paper v6.10.0 Ch1-3 (sangfor_official, high confidence)

## 2. Major Components

### 2.1 Compute — aSV (Sangfor Server Virtualization)

| Feature | Detail |
|---------|--------|
| Hypervisor | KVM/QEMU |
| Disk Format | QCOW2 |
| Drivers | VirtIO (paravirtualized) |
| Load Balancing | DRS (Distributed Resource Scheduler) |
| Dynamic Scaling | DRX (Dynamic Resource Extension) |
| Memory Optimization | Ballooning, KSM (Kernel Same-page Merging) |
| Migration | Live Migration (shared storage or copy) |
| GPU | GPU passthrough, vGPU support |
| NUMA | NUMA-aware scheduling |

> **Evidence**: White Paper v6.10.0 Ch5.1, aSV White Paper (sangfor_official, high confidence)

### 2.2 Storage — aSAN (Distributed Storage)

| Feature | Detail |
|---------|--------|
| File System | EFS (Easy File System) |
| Sharding | 4GB fixed-size shards |
| Striping | Adaptive striping (default 6-way, max 12 disks, 128KB stripe) |
| Caching | Tier system: SSD read/write cache (hybrid LRU+LFU) |
| Protocol | iSCSI, NFS |
| RDMA | Supported (reduces latency) |
| SPDK Turbo | User-space I/O path (bypasses kernel) |
| Zero-Copy | Direct memory transfer |
| Stretched Cluster | 2-site or 3-site with witness |
| Replication | 2-replica or 3-replica |

> **Evidence**: White Paper v6.10.0 Ch5.2 (sangfor_official, high confidence)

### 2.3 Network — aNET (Network Virtualization)

| Feature | Detail |
|---------|--------|
| Architecture | SDN (CMP/CCP/LCP/MB) |
| Overlay | VXLAN |
| Data Plane | DPDK-accelerated |
| Virtual Switch | Distributed Virtual Switch |
| Edge Router | Built-in edge gateway |
| Firewall | FWaaS (Cloud Firewall), DFW (Distributed Firewall) |
| IPv6 | Supported |

> **Evidence**: White Paper v6.10.0 Ch5.3 (sangfor_official, high confidence)

### 2.4 Security — aSecurity

| Feature | Detail |
|---------|--------|
| VM Security | BSI (Built-in Security Intelligence) |
| Cloud Firewall | FWaaS (stateful/next-gen) |
| IPS/WAF | vNGAF |
| Zero Trust | aTrust integration |
| Threat Detection | Cyber Command (NDR) integration |
| Ransomware | Recovery capability |

> **Evidence**: White Paper v6.10.0 Ch5.4 (sangfor_official, high confidence)

### 2.5 Management

| Feature | Detail |
|---------|--------|
| Console | Web-based (ExtJS SPA) |
| Multi-cluster | SCP (Sangfor Cloud Platform) |
| Monitoring | Real-time metrics, dashboards |
| Alerting | Email, SMS, Syslog, SNMP |
| RBAC | Role-based access control |
| Audit | Full audit logging |
| Upgrade | Rolling upgrade support |
| Automation | REST API, SCC |

> **Evidence**: White Paper v6.10.0 Ch5.5, User Manual v6.11.1 (sangfor_official, high confidence)

## 3. Key Features Summary

| Category | Feature | Supported |
|----------|---------|-----------|
| **Compute** | Live Migration | ✅ |
| | DRS (Auto Load Balancing) | ✅ |
| | DRX (Dynamic Resource Extension) | ✅ |
| | GPU Passthrough | ✅ |
| | vGPU | ✅ |
| | Hot Add CPU/Memory | ✅ |
| **Storage** | SSD Tier Cache | ✅ |
| | RDMA | ✅ |
| | SPDK Turbo | ✅ |
| | Stretched Cluster | ✅ |
| | Snapshot (VM/Disk) | ✅ |
| | Clone | ✅ |
| **Network** | VXLAN Overlay | ✅ |
| | DFW (Distributed Firewall) | ✅ |
| | FWaaS (Cloud Firewall) | ✅ |
| | IPv6 | ✅ |
| **DR** | Synchronous Replication (RPO=0) | ✅ |
| | Asynchronous Replication | ✅ |
| | Failover/Failback | ✅ |
| **Backup** | Agentless VM Backup | ✅ |
| | CBT Incremental | ✅ |
| | GFS Retention | ✅ |
| | AES Encryption | ✅ |
| **Security** | VM BSI | ✅ |
| | vNGAF (IPS/WAF) | ✅ |
| | aTrust (Zero Trust) | ✅ |
| **Management** | Multi-cluster (SCP) | ✅ |
| | REST API | ✅ |
| | Rolling Upgrade | ✅ |

> **Evidence**: White Paper v6.10.0, Feature List v6.9.0 (sangfor_official, high confidence)

## 4. Deployment Models

### 4.1 Standard Cluster (2-1000+ nodes)

```
┌─────────────────────────────────────────┐
│           Management Console            │
├─────────┬─────────┬─────────┬──────────┤
│  Node 1 │  Node 2 │  Node 3 │  Node N  │
│ (Master)│ (Slave) │ (Slave) │ (Slave)  │
│ aSV     │ aSV     │ aSV     │ aSV      │
│ aSAN    │ aSAN    │ aSAN    │ aSAN     │
│ aNET    │ aNET    │ aNET    │ aNET     │
└─────────┴─────────┴─────────┴──────────┘
```

### 4.2 Stretched Cluster (2-site + Witness)

```
Site A                    Witness               Site B
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Node 1   │          │ Witness  │          │ Node 3   │
│ Node 2   │◄────────►│  Node    │◄────────►│ Node 4   │
│ (Active) │  Sync    │ (Arbiter)│  Sync    │ (Active) │
└──────────┘          └──────────┘          └──────────┘
```

### 4.3 Dual-Host + Witness

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  Host 1  │          │ Witness  │          │  Host 2  │
│ (Active) │◄────────►│  Node    │◄────────►│ (Active) │
└──────────┘          └──────────┘          └──────────┘
```

> **Evidence**: White Paper v6.10.0 Ch4.4, 2+1 Deployment Guide, Two-Host White Paper (sangfor_official, high confidence)

## 5. Operations Summary

| Operation | Method | Frequency |
|-----------|--------|-----------|
| Health Check | Dashboard + Auto Diagnostics | Real-time |
| Performance Monitoring | Metrics Dashboard | Real-time |
| Alert Review | Email/SMS/Syslog/SNMP | Per event |
| Backup | SBP Scheduled Tasks | Daily/Weekly |
| DR Test | DR Drill Procedures | Quarterly |
| Capacity Review | Capacity Dashboard | Weekly |
| Patch/Upgrade | Rolling Upgrade | As needed |
| Node Expansion | Add Node Wizard | As needed |

> **Evidence**: User Manual v6.11.1, Admin Manual (sangfor_official, high confidence)

## 6. Failure Response Summary

| Failure Type | Detection | Response | Recovery |
|-------------|-----------|----------|----------|
| VM Crash | Heartbeat timeout | Auto restart | Restart on same/other node |
| Node Failure | Cluster heartbeat | HA trigger | VM restart on survivor nodes |
| Disk Failure | Storage health check | Rebuild from replica | Automatic resync |
| Network Link Failure | Bond monitoring | Bond failover | Traffic reroute |
| Site Failure (stretched) | Witness arbitration | Automatic failover | Service on surviving site |
| Storage Pool Degraded | Health check | Alert + degraded mode | Manual disk replacement |

> **Evidence**: White Paper v6.10.0 Ch5.1, Ch5.2 (sangfor_official, high confidence)

## 7. Backup / Snapshot / DR Summary

| Feature | Snapshot | Backup (SBP) | DR |
|---------|----------|--------------|-----|
| Scope | VM/Disk level | VM level | Site level |
| Mechanism | ROW (Redirect-on-Write) | CBT + Agentless | Replication (Sync/Async) |
| RPO | 0 (instant) | Hours (scheduled) | 0 (sync) / Minutes (async) |
| RTO | Seconds (rollback) | Minutes (restore) | Seconds-Minutes |
| Storage | Local (same pool) | Backup Repository | Remote site |
| Retention | Unlimited (space permitting) | GFS policy | Continuous |

> **Evidence**: White Paper v6.10.0 Ch5.2, Backup Manual V1.4, DR Best Practices (sangfor_official, high confidence)

## 8. License / Module Structure

| Module | Components | Notes |
|--------|-----------|-------|
| **Base** | aSV + aSAN + Management Console | Core HCI license |
| **aNET** | Network virtualization, FWaaS, DFW | Separate module |
| **aSecurity** | BSI, vNGAF, aTrust | Separate module |
| **DR** | Stretched cluster, async replication | Separate module |
| **Backup (SBP)** | Agentless backup, CBT, GFS | Separate module |
| **SCP** | Multi-cluster management | Separate license |
| **VDI** | Virtual Desktop Infrastructure | Separate product |

> **Evidence**: Licensing Guidance v1.1 (not yet extracted — 🔴 document gap for detailed SKU codes)
> **⚠️ Document Evidence Gap**: Exact license SKU codes, pricing tiers, and feature gating matrix not available in extracted documents.

## 9. Competitive Comparison Points

| Aspect | Sangfor HCI | VMware vSAN | Nutanix AHV | SmartX |
|--------|-------------|-------------|-------------|--------|
| Hypervisor | KVM (free) | ESXi (licensed) | AHV (free) | KVM (free) |
| Storage | aSAN (EFS) | vSAN | NDFS | ZBS |
| Security | Integrated (aSecurity) | Third-party | Third-party | Third-party |
| DR | Built-in | SRM (separate) | NearSync | Built-in |
| TCO | Lower (no hypervisor license) | Higher (vSphere license) | Medium | Lower |
| VMware Migration | SCMT tool | N/A | Move | SMTX |
| Market Focus | Asia-Pacific, SMB-Enterprise | Global Enterprise | Global Enterprise | China |

> **Evidence**: Competitive Analysis PPTXs (sangfor_official, medium confidence — sales materials)

## 10. Customer-Facing Key Messages

1. **"VMware 대체 가능"** — Broadcom 인수 후 VMware 종속 탈피, KVM 기반 무상 하이퍼바이저
2. **"올인원 보안"** — HCI 내장 보안(aSecurity), 별도 보안 장비 불필요
3. **"RPO=0 DR"** — 스트레치 클러스터로 동기 복제, 무중단 재해 복구
4. **"TCO 절감"** — 하이퍼바이저 라이선스 무료 + 통합 관리 + 번들 DR/백업
5. **"간편한 확장"** — 노드 추가만으로 선형 확장, 최대 1000+ 노드
6. **"원클릭 업그레이드"** — 롤링 업그레이드로 무중단 버전 업데이트

> **Evidence**: Sales Presentations, Case Studies (sangfor_official, medium confidence — marketing materials)

## 11. Evidence Summary

| Content Category | Evidence Type | Confidence |
|-----------------|---------------|------------|
| Architecture & Components | White Paper v6.10.0 | High |
| Operations & Procedures | User Manual v6.11.1 | High |
| Backup & Recovery | Backup Manual V1.4 | Medium (Google Translate) |
| DR Details | DR Best Practices | High |
| Deployment | Admin Manual + Deployment Guides | High |
| Licensing | Licensing Guidance (not extracted) | Low (gap) |
| Competitive | Sales Materials | Medium (vendor bias) |
| Customer Messages | Sales/Marketing | Medium (marketing) |
