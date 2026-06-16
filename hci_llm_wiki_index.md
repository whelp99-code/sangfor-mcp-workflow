# HCI LLM Wiki Index

> **Stage 4 Complete** | Last Updated: 2026-06-16 | Method: LLM Wiki / OKF Style

## 1. Wiki Page Structure Standard

Each Wiki page follows the OKF-inspired structure:

```yaml
title: string          # Page title
summary: string        # 2-3 sentence overview
key_concepts: []       # Core concepts with descriptions
related_components: [] # HCI components referenced
data_flow: []          # Step-by-step data flow
operational_flow: []   # Operations procedures
failure_flow: []       # Failure scenarios and responses
evidence_sources: []   # Document references with confidence
linked_pages: []       # Bidirectional links to other Wiki pages
unresolved_questions: [] # Gaps requiring further investigation
conflicts: []          # Contradictions between sources
```

## 2. Complete Wiki Page Index (17 Pages)

### Page 1: HCI Overview

| Field | Content |
|-------|---------|
| **ID** | `hci-overview` |
| **Title** | Sangfor HCI Product Overview |
| **Summary** | Sangfor HCI (Hyper-Converged Infrastructure) is a software-defined data center platform that converges compute (aSV), storage (aSAN), network (aNET), and security (aSecurity) into a single cluster. Built on KVM/QEMU hypervisor with distributed EFS storage, it delivers enterprise-grade virtualization with simplified management. |
| **Key Concepts** | aSV (Server Virtualization), aSAN (Distributed Storage), aNET (Network Virtualization), aSecurity (Integrated Security), SCP (Cloud Platform Management) |
| **Components** | aSV, aSAN, aNET, aSecurity, Management Console, SCP |
| **Version Range** | v6.9.0 → v6.10.0 → v6.11.1 |
| **Evidence** | White Paper v6.10.0 Ch1-3 (high confidence) |
| **Linked Pages** | → `hci-architecture`, `hci-management-plane`, `hci-licensing`, `hci-deployment-process` |

---

### Page 2: HCI Architecture

| Field | Content |
|-------|---------|
| **ID** | `hci-architecture` |
| **Title** | HCI System Architecture |
| **Summary** | 3-layer architecture: Physical Infrastructure → Virtualization Layer (aSV/aSAN/aNET/aSecurity) → Management & Control Plane. Each node runs identical software stack; cluster coordination via consensus protocol. |
| **Key Concepts** | 3-Layer Architecture, Node Roles (Master/Slave/Witness), Cluster Consensus, Software-Defined Everything |
| **Components** | All HCI components |
| **Data Flow** | Physical Hardware → Hypervisor (aSV) → Virtual Resources → Management Console |
| **Evidence** | White Paper v6.10.0 Ch4 (high confidence) |
| **Linked Pages** | ← `hci-overview`, → `hci-compute-flow`, → `hci-storage-flow`, → `hci-network-flow`, → `hci-management-plane` |

---

### Page 3: HCI Management Plane

| Field | Content |
|-------|---------|
| **ID** | `hci-management-plane` |
| **Title** | Management Console & Control Plane |
| **Summary** | Web-based management console (ExtJS SPA with hash routing) provides unified management for all HCI components. SCP extends management to multi-cluster environments. Supports RBAC, audit logging, alerting (email/SMS/Syslog/SNMP). |
| **Key Concepts** | Management Console (Web UI), SCP (Multi-cluster), RBAC, Audit Log, Alert System, Health Check, SkyOPS |
| **Components** | Management Console, SCP, Control Plane |
| **Operational Flow** | Login → Authentication → Dashboard → Resource Management → Monitoring → Alerts |
| **Evidence** | White Paper v6.10.0 Ch5.5, User Manual v6.11.1 (high confidence) |
| **Linked Pages** | ← `hci-architecture`, → `hci-monitoring-log-flow`, → `hci-api-automation-flow`, → `hci-licensing` |

---

### Page 4: HCI Compute Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-compute-flow` |
| **Title** | Compute Virtualization (aSV) |
| **Summary** | aSV provides KVM/QEMU-based server virtualization with VirtIO drivers, PCIe bus virtualization, QCOW2 disk images. Supports DRS (automatic load balancing), DRX (dynamic resource extension), memory ballooning, KSM (memory dedup), and live migration. |
| **Key Concepts** | KVM/QEMU, VirtIO, QCOW2, DRS, DRX, Memory Ballooning, KSM, Live Migration, CPU Pinning, NUMA Scheduling |
| **Components** | aSV |
| **Data Flow** | Admin Request → Resource Scheduler → NUMA-aware Placement → VM Creation → Monitoring Registration |
| **Failure Flow** | Node Failure → HA Trigger → Resource Recalculation → VM Restart on Another Node |
| **Evidence** | White Paper v6.10.0 Ch5.1, aSV White Paper (high confidence) |
| **Linked Pages** | ← `hci-architecture`, → `hci-vm-lifecycle`, → `hci-ha-failure-flow`, → `hci-storage-flow` |

---

### Page 5: HCI Storage Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-storage-flow` |
| **Title** | Distributed Storage (aSAN) |
| **Summary** | aSAN uses EFS (Easy File System) with 4GB sharding and adaptive striping (default 6-way, max 12 disks, 128KB stripe). Tier system provides SSD cache (hybrid LRU+LFU elimination). Supports RDMA, SPDK Turbo, Zero-Copy, and stretched cluster (2/3 replica + witness). |
| **Key Concepts** | EFS, 4GB Sharding, Adaptive Striping, Tier (SSD Cache), RDMA, SPDK Turbo, Zero-Copy, NUMA-aware I/O, Stretched Cluster |
| **Components** | aSAN, EFS |
| **Data Flow** | VM Disk I/O → VirtIO Driver → aSAN Cache (SSD) → Shard Selection → Stripe Distribution → Replica Write → Physical Disk |
| **Failure Flow** | Disk Failure → Automatic Rebuild from Replica → Resync → Alert |
| **Evidence** | White Paper v6.10.0 Ch5.2 (high confidence) |
| **Linked Pages** | ← `hci-architecture`, → `hci-vm-lifecycle`, → `hci-snapshot-flow`, → `hci-backup-flow`, → `hci-ha-failure-flow`, → `hci-dr-flow` |

---

### Page 6: HCI Network Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-network-flow` |
| **Title** | Network Virtualization (aNET) |
| **Summary** | aNET provides VXLAN-based overlay networking with DPDK-accelerated data plane. SDN architecture with CMP (Central Management Plane), CCP (Cluster Control Plane), LCP (Local Control Plane), and MB (Management Bus). Supports distributed virtual switches, edge routers, FWaaS cloud firewall, and DFW distributed firewall. |
| **Key Concepts** | VXLAN Overlay, DPDK, SDN (CMP/CCP/LCP/MB), Distributed Virtual Switch, Edge Router, FWaaS, DFW, IPv6 |
| **Components** | aNET |
| **Data Flow** | VM vNIC → Distributed Virtual Switch → VXLAN Encapsulation → Physical NIC → ToR Switch → External Network |
| **Failure Flow** | NIC Failure → Bond Failover → Traffic Reroute → Alert |
| **Evidence** | White Paper v6.10.0 Ch5.3 (high confidence) |
| **Linked Pages** | ← `hci-architecture`, → `hci-vm-lifecycle`, → `hci-ha-failure-flow`, → `hci-monitoring-log-flow` |

---

### Page 7: HCI VM Lifecycle

| Field | Content |
|-------|---------|
| **ID** | `hci-vm-lifecycle` |
| **Title** | VM Lifecycle Management |
| **Summary** | Full VM lifecycle: Create → Configure → Run → Migrate → Snapshot → Clone → Resize → Stop → Delete. VM creation involves template selection, compute allocation, storage volume creation, network attachment, and monitoring registration. |
| **Key Concepts** | VM Template, QCOW2 Image, Resource Allocation, Live Migration, Hot Resize, Clone, Convert |
| **Components** | aSV, aSAN, aNET |
| **Data Flow** | Create: Template → Compute → Storage → Network → Boot → Monitor |
| **Operational Flow** | Power On/Off, Migrate, Resize CPU/Memory, Add/Remove Disk, Add/Remove NIC, Take Snapshot |
| **Evidence** | White Paper v6.10.0 Ch5.1, User Manual v6.11.1 (high confidence) |
| **Linked Pages** | ← `hci-compute-flow`, ← `hci-storage-flow`, ← `hci-network-flow`, → `hci-snapshot-flow`, → `hci-backup-flow` |

---

### Page 8: HCI Snapshot Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-snapshot-flow` |
| **Title** | Snapshot Management |
| **Summary** | aSAN supports VM-level and disk-level snapshots using redirect-on-write (ROW) mechanism. Snapshots create delta files in the snapshot chain; original data becomes read-only. Supports memory snapshot (VM state capture) and scheduled snapshots. |
| **Key Concepts** | ROW (Redirect-on-Write), Snapshot Chain, Delta File, Memory Snapshot, Scheduled Snapshot, Rollback |
| **Components** | aSAN, aSV |
| **Data Flow** | Snapshot Request → Metadata Freeze → Delta File Creation → Snapshot Chain Update → Confirmation |
| **Failure Flow** | Snapshot Failure → Rollback to Previous Point → Alert |
| **Evidence** | White Paper v6.10.0 Ch5.2 (high confidence) |
| **Linked Pages** | ← `hci-storage-flow`, ← `hci-vm-lifecycle`, → `hci-backup-flow`, → `hci-dr-flow` |

---

### Page 9: HCI Backup Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-backup-flow` |
| **Title** | Backup Operations (SBP) |
| **Summary** | Sangfor Backup Platform (SBP) provides agentless VM backup via aSV snapshot mechanism, with CBT (Changed Block Tracking) for incremental backups. Supports full, incremental, synthetic full, and backup copy types. AES encryption at rest. GFS retention policy. Recovery includes full VM, fine-grained file, and virtual disk restore. |
| **Key Concepts** | SBP, Agentless Backup, CBT, Synthetic Full, GFS Retention, AES Encryption, Backup Copy, 3-2-1 Strategy |
| **Components** | SBP, aSV, aSAN |
| **Data Flow** | Backup Policy → VM Snapshot → CBT Analysis → Data Transfer → Repository Storage → Encryption → Retention Management |
| **Failure Flow** | Backup Failure → Auto-Retry → Alert → Manual Intervention |
| **Evidence** | Backup Manual V1.4 (high confidence, medium quality due to Google Translate) |
| **Linked Pages** | ← `hci-snapshot-flow`, ← `hci-vm-lifecycle`, → `hci-dr-flow`, → `hci-ha-failure-flow` |

---

### Page 10: HCI DR Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-dr-flow` |
| **Title** | Disaster Recovery |
| **Summary** | HCI supports stretched cluster DR (synchronous replication, RPO=0) and asynchronous DR via scheduled replication. Stretched cluster uses 2-replica or 3-replica across sites with witness node. Failover is automatic for HA; DR failover is manual with RTO in seconds. Failback restores to original site. |
| **Key Concepts** | Stretched Cluster, Synchronous Replication, RPO=0, RTO Seconds, Witness Node, Failover, Failback, Journal/CDP |
| **Components** | aSAN (stretched), aSV (HA), Management Console |
| **Data Flow** | Production VM → Replication Engine → Sync/Async Replication → DR Site Storage → DR VM Registration → Failover |
| **Failure Flow** | Site Failure → HA Detection → Automatic Failover (stretched) / Manual Failover (async) → Service Restoration → Failback |
| **Evidence** | White Paper v6.10.0 Ch5.2, DR Best Practices (high confidence) |
| **Linked Pages** | ← `hci-storage-flow`, ← `hci-snapshot-flow`, ← `hci-backup-flow`, → `hci-ha-failure-flow` |

---

### Page 11: HCI HA Failure Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-ha-failure-flow` |
| **Title** | High Availability & Failure Response |
| **Summary** | HCI provides multi-level HA: VM-level restart, node-level failover, storage-level rebuild, network-level bond failover. Detection via heartbeat mechanism. Resource reservation ensures restart capacity. DRS rebalances after recovery. |
| **Key Concepts** | HA Heartbeat, Resource Reservation, VM Restart, Storage Rebuild, Network Bond Failover, DRS Rebalance, DRX Extension |
| **Components** | aSV, aSAN, aNET |
| **Data Flow** | Failure Detection → Heartbeat Timeout → HA Trigger → Resource Recalculation → VM Restart/Migration → Storage Rebuild → Alert → DRS Rebalance |
| **Failure Flow** | Node Failure → VM Restart on Survivor; Disk Failure → Replica Rebuild; NIC Failure → Bond Failover; Network Partition → Witness Arbitration |
| **Evidence** | White Paper v6.10.0 Ch5.1, Ch5.2 (high confidence) |
| **Linked Pages** | ← `hci-compute-flow`, ← `hci-storage-flow`, ← `hci-network-flow`, ← `hci-dr-flow`, → `hci-monitoring-log-flow` |

---

### Page 12: HCI Monitoring & Log Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-monitoring-log-flow` |
| **Title** | Monitoring, Alerting & Logging |
| **Summary** | Management Console collects node/VM/storage/network metrics in real-time. Alert system supports email, SMS, Syslog, SNMP trap. Health check runs periodic diagnostics. Log collection supports centralized logging. SkyOPS provides advanced analytics. |
| **Key Concepts** | Real-time Metrics, Alert Rules, Health Check, Syslog, SNMP, SkyOPS, Performance Dashboard, Capacity Planning |
| **Components** | Management Console, SCP |
| **Data Flow** | Node/VM Metrics → Collector → Management Console → Alert Engine → Notification (Email/SMS/Syslog/SNMP) |
| **Evidence** | White Paper v6.10.0 Ch5.5 (high confidence) |
| **Linked Pages** | ← `hci-management-plane`, ← `hci-ha-failure-flow`, → `hci-api-automation-flow` |

---

### Page 13: HCI API & Automation Flow

| Field | Content |
|-------|---------|
| **ID** | `hci-api-automation-flow` |
| **Title** | API & Automation |
| **Summary** | HCI exposes RESTful OpenAPI for programmatic management. Supports VM lifecycle, storage, network, and monitoring operations. Authentication via token-based auth with RBAC. SCC (Sangfor Cloud Center) provides infrastructure automation. |
| **Key Concepts** | OpenAPI, REST API, Token Auth, RBAC, SCC, Task Queue, Audit Log, Ansible Integration |
| **Components** | Management Console API, SCP API, SCC |
| **Data Flow** | API Request → Authentication → RBAC Check → Control Plane → Task Queue → Execution → Audit Log → Response |
| **Evidence** | OpenAPI Guide (partial), White Paper Ch5.5 (high confidence for architecture, medium for API details) |
| **Linked Pages** | ← `hci-management-plane`, ← `hci-monitoring-log-flow`, → `hci-deployment-process` |

---

### Page 14: HCI Licensing

| Field | Content |
|-------|---------|
| **ID** | `hci-licensing` |
| **Title** | Licensing & Module Structure |
| **Summary** | Sangfor HCI uses per-node licensing with modular add-ons. Base license includes aSV + aSAN + basic management. aNET, aSecurity, advanced features (DR, backup) are separate modules. Trial licenses available for PoC. |
| **Key Concepts** | Per-Node License, Module-Based, Trial License, Feature Gating |
| **Components** | All (license-gated) |
| **Evidence** | Licensing Guidance v1.1 (not yet extracted — 🔴 document gap) |
| **Unresolved Questions** | Exact license SKU codes, module pricing, feature matrix details |
| **Linked Pages** | ← `hci-overview`, ← `hci-management-plane`, → `hci-deployment-process` |

---

### Page 15: HCI Deployment Process

| Field | Content |
|-------|---------|
| **ID** | `hci-deployment-process` |
| **Title** | Deployment & Installation |
| **Summary** | HCI deployment follows: Hardware Preparation → Network Planning → ISO Boot → Node Discovery → Cluster Formation → Storage Pool Configuration → Network Configuration → License Activation → Management Console Setup. Supports 2-node (with witness) to 1000+ node clusters. |
| **Key Concepts** | aDeploy, ISO Installation, Cluster Formation, Storage Pool, Network Planning, License Activation, Witness Node |
| **Components** | aDeploy, Management Console |
| **Operational Flow** | Hardware Check → ISO Boot → Node Discovery → Cluster Join → Storage Config → Network Config → License → Verify |
| **Evidence** | User Manual v6.11.1, 2+1 Deployment Guide, Admin Manual (high confidence) |
| **Linked Pages** | ← `hci-architecture`, ← `hci-licensing`, → `hci-operations-process` |

---

### Page 16: HCI Operations Process

| Field | Content |
|-------|---------|
| **ID** | `hci-operations-process` |
| **Title** | Day-to-Day Operations |
| **Summary** | Operations include: VM management (create/migrate/resize/delete), storage management (pool/disk/tier), network management (VLAN/VXLAN/DFW), monitoring (metrics/alerts/reports), maintenance (upgrade/patch/expand), and backup/DR management. |
| **Key Concepts** | VM Operations, Storage Management, Network Management, Cluster Upgrade, Node Expansion, Maintenance Mode |
| **Components** | All |
| **Operational Flow** | Daily: Check Dashboard → Review Alerts → Verify Backups; Weekly: Capacity Review → Performance Analysis; Monthly: Patch/Upgrade Planning |
| **Evidence** | User Manual v6.11.1, Admin Manual (high confidence) |
| **Linked Pages** | ← `hci-deployment-process`, → `hci-monitoring-log-flow`, → `hci-backup-flow` |

---

### Page 17: HCI Competitive Comparison

| Field | Content |
|-------|---------|
| **ID** | `hci-competitive-comparison` |
| **Title** | Competitive Positioning |
| **Summary** | Sangfor HCI competes with VMware vSAN, Nutanix AHV, SmartX, and H3C UIS. Key differentiators: integrated security (aSecurity), lower TCO, built-in DR, KVM-based (no VMware licensing dependency). VMware migration is a primary use case post-Broadcom acquisition. |
| **Key Concepts** | VMware Replacement, Nutanix Comparison, SmartX Comparison, TCO Analysis, Feature Parity |
| **Components** | All |
| **Evidence** | Competitive Analysis PPTXs, Feature Comparison PDFs (medium confidence — sales materials) |
| **Unresolved Questions** | Performance benchmarks need independent verification |
| **Linked Pages** | ← `hci-overview`, → `hci-licensing` |

## 3. Bidirectional Link Map

```
hci-overview ←→ hci-architecture
hci-overview ←→ hci-management-plane
hci-overview ←→ hci-licensing
hci-overview ←→ hci-deployment-process

hci-architecture ←→ hci-compute-flow
hci-architecture ←→ hci-storage-flow
hci-architecture ←→ hci-network-flow
hci-architecture ←→ hci-management-plane

hci-compute-flow ←→ hci-vm-lifecycle
hci-compute-flow ←→ hci-ha-failure-flow

hci-storage-flow ←→ hci-vm-lifecycle
hci-storage-flow ←→ hci-snapshot-flow
hci-storage-flow ←→ hci-backup-flow
hci-storage-flow ←→ hci-ha-failure-flow
hci-storage-flow ←→ hci-dr-flow

hci-network-flow ←→ hci-vm-lifecycle
hci-network-flow ←→ hci-ha-failure-flow

hci-vm-lifecycle ←→ hci-snapshot-flow
hci-vm-lifecycle ←→ hci-backup-flow

hci-snapshot-flow ←→ hci-backup-flow
hci-snapshot-flow ←→ hci-dr-flow

hci-backup-flow ←→ hci-dr-flow
hci-backup-flow ←→ hci-ha-failure-flow

hci-dr-flow ←→ hci-ha-failure-flow

hci-management-plane ←→ hci-monitoring-log-flow
hci-management-plane ←→ hci-api-automation-flow
hci-management-plane ←→ hci-licensing

hci-monitoring-log-flow ←→ hci-api-automation-flow

hci-ha-failure-flow ←→ hci-monitoring-log-flow

hci-deployment-process ←→ hci-licensing
hci-deployment-process ←→ hci-operations-process

hci-operations-process ←→ hci-monitoring-log-flow
hci-operations-process ←→ hci-backup-flow

hci-overview ←→ hci-competitive-comparison
hci-competitive-comparison ←→ hci-licensing
```

**Total Links**: 30 bidirectional pairs across 17 pages

## 4. Topic Index

| Topic | Primary Pages | Secondary Pages |
|-------|---------------|-----------------|
| **Architecture** | hci-architecture | hci-overview, hci-compute-flow, hci-storage-flow, hci-network-flow |
| **Compute** | hci-compute-flow | hci-vm-lifecycle, hci-ha-failure-flow |
| **Storage** | hci-storage-flow | hci-snapshot-flow, hci-backup-flow, hci-dr-flow |
| **Network** | hci-network-flow | hci-vm-lifecycle, hci-ha-failure-flow |
| **VM Management** | hci-vm-lifecycle | hci-compute-flow, hci-storage-flow, hci-network-flow |
| **Data Protection** | hci-backup-flow, hci-dr-flow | hci-snapshot-flow, hci-ha-failure-flow |
| **Security** | hci-architecture (aSecurity) | hci-network-flow (FWaaS/DFW) |
| **Operations** | hci-operations-process | hci-management-plane, hci-monitoring-log-flow |
| **Automation** | hci-api-automation-flow | hci-management-plane, hci-deployment-process |
| **Deployment** | hci-deployment-process | hci-licensing, hci-architecture |
| **Competitive** | hci-competitive-comparison | hci-overview, hci-licensing |

## 5. Conflicts & Unresolved Items

| Item | Page | Status | Notes |
|------|------|--------|-------|
| License SKU codes | hci-licensing | 🔴 Document gap | Licensing Guidance not yet extracted |
| SPDK Turbo benchmarks | hci-storage-flow | 🟡 Partial | Mentioned but no performance numbers |
| Erasure coding details | hci-storage-flow | 🔴 Not in docs | aSAN uses replication, EC not documented |
| API endpoint list | hci-api-automation-flow | 🟡 Partial | OpenAPI Guide not fully extracted |
| vNGAF feature details | hci-architecture | 🟡 Partial | Security components not fully documented |
| Multi-cluster SCP limits | hci-management-plane | 🔴 Not in docs | Max cluster count not specified |
| Performance benchmarks | hci-competitive-comparison | 🟡 Partial | Vendor-provided data only |
