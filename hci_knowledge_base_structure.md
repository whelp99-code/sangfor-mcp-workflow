# HCI Knowledge Base Structure

> **Stage 3 Complete** | Last Updated: 2026-06-16 | Source: `sangfor-mcp-workflow` project analysis

## 1. Existing DB/RAG/Knowledge Store Analysis

### 1.1 Found Structures in sangfor-mcp-workflow

| Component | File | Type | Status | Storage |
|-----------|------|------|--------|---------|
| **RAG Indexer** | `rag-indexer.ts` | JSON-based RAG index | ✅ Implemented | `data/rag/index.json` |
| **Scenario DB** | `scenario-db.ts` | YAML-based scenario store | ✅ Implemented | `data/scenarios/{product}/` |
| **Vendor DB** | `vendor-database.json` | JSON vendor data | ✅ Implemented | `data/vendors/` |
| **Workflow Templates** | `workflow-templates.ts` | TypeScript templates | ✅ Implemented | In-memory |
| **LLM Client** | `llm-client.ts` | LLM integration | ✅ Implemented | API calls |

### 1.2 Gap Analysis

| Required Capability | Existing | Gap |
|--------------------|----------|-----|
| Document storage | RAG Indexer (chunk-based) | No structured document metadata store |
| Wiki page storage | None | **Need to create** |
| Bidirectional links | None | **Need to create** |
| Product component map | Vendor DB (basic) | Need HCI-specific component map |
| Data flow definitions | None | **Need to create** |
| Evidence source tracking | RAG Indexer (source field) | Need confidence/evidence_type fields |
| Conflict tracking | None | **Need to create** |

### 1.3 Decision: Extend Existing + Create Minimum New Structure

- **Reuse**: `rag-indexer.ts` for document chunk indexing
- **Extend**: `scenario-db.ts` pattern for Wiki pages (YAML-based)
- **Create New**: Wiki page store, link store, evidence tracker

## 2. Minimum Knowledge Base Structure

### 2.1 Storage Units (Wiki Knowledge Units)

```yaml
# Primary storage unit: Wiki Page
wiki_pages/
  hci-overview.yaml
  hci-architecture.yaml
  hci-management-plane.yaml
  hci-compute-flow.yaml
  hci-storage-flow.yaml
  hci-network-flow.yaml
  hci-vm-lifecycle.yaml
  hci-snapshot-flow.yaml
  hci-backup-flow.yaml
  hci-dr-flow.yaml
  hci-ha-failure-flow.yaml
  hci-monitoring-log-flow.yaml
  hci-api-automation-flow.yaml
  hci-licensing.yaml
  hci-deployment-process.yaml
  hci-operations-process.yaml
  hci-competitive-comparison.yaml

# Supporting stores
wiki_links/
  links.yaml              # Bidirectional link index

product_components/
  components.yaml         # HCI component hierarchy

data_flows/
  flows.yaml              # Data flow definitions

evidence_sources/
  sources.yaml            # Source document index with confidence

open_issues/
  issues.yaml             # Conflicts, gaps, unresolved items
```

### 2.2 Wiki Page Schema

```yaml
# wiki_pages/{page-id}.yaml
id: "hci-storage-flow"
title: "HCI Storage Data Flow"
summary: "Sangfor HCI aSAN distributed storage architecture..."
key_concepts:
  - name: "aSAN"
    description: "Distributed storage system based on EFS file system"
  - name: "4GB Sharding"
    description: "Data split into 4GB shards for distribution"
  - name: "Adaptive Striping"
    description: "Default 6-way striping across disks"
related_components:
  - "aSAN"
  - "EFS"
  - "SSD Tier"
  - "RDMA"
data_flow:
  - step: 1
    component: "VM Disk I/O"
    action: "Guest OS issues block I/O request"
  - step: 2
    component: "Hypervisor Storage Layer"
    action: "VirtIO driver intercepts I/O"
  - step: 3
    component: "aSAN"
    action: "EFS processes I/O through cache → shard → stripe → replica"
  - step: 4
    component: "Physical Disk"
    action: "Data written to SSD/HDD"
operational_flow:
  - "Create storage pool"
  - "Add disk to pool"
  - "Configure tier (SSD cache)"
  - "Monitor I/O performance"
failure_flow:
  - trigger: "Disk failure"
    action: "Automatic rebuild from replica"
  - trigger: "Node failure"
    action: "Storage resync across remaining nodes"
evidence_sources:
  - source_file: "HCI_SANGFOR_HCI_V6.10.0_Technical White Paper.pdf"
    section: "Ch5.2 aSAN"
    page_range: "p.45-67"
    confidence: "high"
    evidence_type: "sangfor_official"
  - source_file: "HCI_SANGFOR_HCI_V6.10.0_Technical White Paper - aSV.pdf"
    section: "Storage Integration"
    confidence: "high"
    evidence_type: "sangfor_official"
linked_pages:
  - "hci-architecture"
  - "hci-vm-lifecycle"
  - "hci-snapshot-flow"
  - "hci-backup-flow"
  - "hci-ha-failure-flow"
unresolved_questions:
  - "SPDK Turbo mode performance benchmarks not in documents"
  - "Erasure coding ratio details not specified"
conflicts: []
last_updated: "2026-06-16"
confidence: "high"
```

### 2.3 Bidirectional Link Schema

```yaml
# wiki_links/links.yaml
links:
  - source: "hci-storage-flow"
    target: "hci-vm-lifecycle"
    relationship: "provides_storage_for"
    bidirectional: true
  - source: "hci-storage-flow"
    target: "hci-snapshot-flow"
    relationship: "enables_snapshot_via"
    bidirectional: true
  - source: "hci-network-flow"
    target: "hci-vm-lifecycle"
    relationship: "provides_network_for"
    bidirectional: true
  # ... more links
```

### 2.4 Evidence Source Schema

```yaml
# evidence_sources/sources.yaml
sources:
  - id: "wp-v610"
    file: "HCI_SANGFOR_HCI_V6.10.0_Technical White Paper.pdf"
    type: "technical_white_paper"
    version: "6.10.0"
    language: "EN"
    extraction_status: "completed"
    confidence: "high"
    pages_used: "Ch4-6"
  - id: "um-v611"
    file: "SANGFOR_HCI_V6.11.1_User Manual_EN - V4.pdf"
    type: "user_manual"
    version: "6.11.1"
    language: "EN"
    extraction_status: "partial"
    confidence: "high"
    pages_used: "TOC + Ch1-11"
  - id: "backup-v14"
    file: "Sangfor Backup User Manual V1.4_EN_Sangfor_Google Translation.docx"
    type: "backup_manual"
    version: "1.4"
    language: "EN"
    extraction_status: "completed"
    confidence: "medium"
    notes: "Google Translation quality"
```

### 2.5 Product Component Schema

```yaml
# product_components/components.yaml
product: "Sangfor HCI"
version: "6.10.0 - 6.11.1"
components:
  - name: "aSV"
    full_name: "Sangfor Server Virtualization"
    layer: "Virtualization"
    type: "compute"
    description: "KVM/QEMU-based hypervisor"
    sub_components:
      - "Hypervisor (KVM/QEMU)"
      - "VirtIO Drivers"
      - "QCOW2 Image Format"
      - "DRS (Distributed Resource Scheduler)"
      - "DRX (Dynamic Resource Extension)"
      - "Memory Ballooning"
      - "KSM (Kernel Same-page Merging)"
    evidence_source: "wp-v610:Ch5.1"
  - name: "aSAN"
    full_name: "Sangfor Storage Area Network"
    layer: "Virtualization"
    type: "storage"
    description: "Distributed storage system based on EFS"
    sub_components:
      - "EFS (Easy File System)"
      - "4GB Sharding"
      - "Adaptive Striping (default 6-way)"
      - "Tier (SSD Cache)"
      - "RDMA Support"
      - "SPDK Turbo"
      - "Zero-Copy"
    evidence_source: "wp-v610:Ch5.2"
  - name: "aNET"
    full_name: "Sangfor Network Virtualization"
    layer: "Virtualization"
    type: "network"
    description: "VXLAN-based overlay network with SDN"
    sub_components:
      - "VXLAN Overlay"
      - "DPDK Data Plane"
      - "Distributed Virtual Switch"
      - "Edge Router"
      - "FWaaS (Cloud Firewall)"
      - "DFW (Distributed Firewall)"
    evidence_source: "wp-v610:Ch5.3"
  - name: "aSecurity"
    full_name: "Sangfor Security"
    layer: "Security"
    type: "security"
    description: "Integrated security components"
    sub_components:
      - "VM BSI (Built-in Security Intelligence)"
      - "Cloud Firewall (FWaaS)"
      - "vNGAF (IPS/WAF)"
      - "aTrust (Zero Trust)"
      - "Cyber Command Integration"
    evidence_source: "wp-v610:Ch5.4"
  - name: "Management Console"
    full_name: "Sangfor HCI Management Console"
    layer: "Management"
    type: "management"
    description: "Web-based management UI"
    evidence_source: "um-v611"
  - name: "SCP"
    full_name: "Sangfor Cloud Platform"
    layer: "Management"
    type: "management"
    description: "Multi-cluster management platform"
    evidence_source: "wp-v610:Ch5.5"
```

## 3. Integration with Existing System

### 3.1 Reuse Pattern: RAG Indexer

```typescript
// Existing rag-indexer.ts can index Wiki page content for search
import { RAGIndexer } from '@sangfor/workflow-engine';

const indexer = new RAGIndexer('data/rag/hci-index.json');

// Index each Wiki page as a searchable document
for (const page of wikiPages) {
  await indexer.indexDocument({
    title: page.title,
    content: pageToMarkdown(page),
    source: page.evidence_sources[0].source_file,
    type: 'wiki_page',
    metadata: { pageId: page.id, confidence: page.confidence }
  });
}
```

### 3.2 Reuse Pattern: Scenario DB

```typescript
// scenario-db.ts pattern can store HCI-specific scenarios
import { ScenarioDB } from '@sangfor/workflow-engine';

const db = new ScenarioDB('data/scenarios/HCI/');

// Store deployment scenarios, configuration scenarios
await db.save({
  id: 'hci-deploy-stretched-cluster',
  product: 'HCI',
  feature: 'Stretched Cluster',
  settings: [...],
  source: { type: 'documentation', reference: '2+1 Deployment Guide' }
});
```

### 3.3 New: Wiki Page Store

```typescript
// Proposed: WikiPageStore (YAML-based, like ScenarioDB)
interface WikiPage {
  id: string;
  title: string;
  summary: string;
  key_concepts: Concept[];
  related_components: string[];
  data_flow: FlowStep[];
  operational_flow: string[];
  failure_flow: FailureStep[];
  evidence_sources: EvidenceSource[];
  linked_pages: string[];
  unresolved_questions: string[];
  conflicts: Conflict[];
  confidence: 'high' | 'medium' | 'low';
  last_updated: string;
}
```

## 4. Data Flow Summary

```
Source Documents (PDF/DOCX/PPTX/XLSX)
    │
    ▼
Extraction (pdftotext / textutil / python-pptx)
    │
    ▼
Normalization (minimum metadata only)
    │
    ├──▶ RAG Indexer (chunk-based search index)
    │
    ├──▶ Wiki Page Store (structured knowledge units)
    │       ├── YAML files per page
    │       ├── Bidirectional links
    │       └── Evidence source tracking
    │
    ├──▶ Scenario DB (deployment/config scenarios)
    │
    └──▶ Markdown Deliverables (final output)
            ├── hci_document_inventory.md
            ├── hci_source_preparation.md
            ├── hci_knowledge_base_structure.md
            ├── hci_llm_wiki_index.md
            ├── hci_product_summary.md
            ├── hci_data_flow_process.md
            ├── hci_open_source_research.md
            └── hci_open_issues.md
```

## 5. Source Attribution Rules

| Rule | Implementation |
|------|---------------|
| Every claim must have source | `evidence_sources` array in Wiki page |
| Sangfor docs vs general knowledge | `evidence_type` field: `sangfor_official` / `general_hci` / `inferred` |
| Confidence levels | `high` (direct quote/figure) / `medium` (paraphrased) / `low` (inferred) |
| Conflicts | `conflicts` array in Wiki page with both sources cited |
| No source = not confirmed | Marked as `unresolved_questions` |

> **Note**: This structure is designed to be minimal yet extensible. No heavy RAG pipeline or vector DB is required — YAML files + JSON index provide sufficient structure for LLM Wiki consumption.
