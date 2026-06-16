# Product Classification — /Volumes/My Passport/00. Attached/

> **Stage 2 Complete** | Last Updated: 2026-06-16 | HCI 폴더 제외

## 1. Classification Results

### 1순위 제품 (즉시 처리)

| Product | Files | Key Documents | Confidence |
|---------|-------|---------------|------------|
| **NGAF** | 11 | Feature List, EOL notices, SonicWall comparison | High |
| **IAG** | 7 | User Manual (42MB), Deployment Guide, Sizing Guide | High |
| **SKE** | 32 | Technical White Paper, User Manual (26MB), Feature List | High |
| **SASE/aTrust** | 8 | Main Slides, Sales/Pre-sales Training, Aryaka reference | High |
| **hDR/aDR** | 1 | hDR User Manual V2.0 (10MB) | High |
| **SCP** | 3 | Brochure, Tender Specs | Medium |

### 2순위 제품

| Product | Files | Key Documents | Confidence |
|---------|-------|---------------|------------|
| **VDI** | 46 | User Manual (47MB), IOM Manual, Feature Lists, Sizing | High |
| **EPP** | 2 | Endpoint Security article, hDR Manual | Medium |
| **Cyber Command** | 12 | Main Slides, Pitch Deck, MDR Guide, Battle Card | High |
| **aStor** | 1 | Brochure | Low |
| **SDWAN** | 1 | Brochure | Low |
| **Network Secure** | 3 | Brochure (multiple versions) | Medium |
| **SCMT** | 18 | Kernel packages (ZIP, not extractable) | Low |

### 3순위 제품

| Product | Files | Key Documents | Confidence |
|---------|-------|---------------|------------|
| **SIER** | 1 | Brochure | Low |
| **Company** | 6 | Company Profile PPTXs | High |
| **SAP Reference** | 5 | SAP HANA hosting docs | Low |
| **Multi-product** | 25 | Brochures covering multiple products | Medium |
| **Misc** | 4 | Tech Command logs | Low |

## 2. Classification Criteria

| Criterion | Weight | Examples |
|-----------|--------|----------|
| Folder name match | High | `1. NGAF` → NGAF |
| File name contains product name | High | `SANGFOR_IAG_v13.0.80_User_Manual_EN.pdf` → IAG |
| Document title/keywords | Medium | "Kubernetes Engine" → SKE |
| File location context | Medium | `Brochure/` + "NGAF" in name → NGAF |
| Content analysis (when extracted) | Low | Not yet performed |

## 3. Multi-product Documents

| File | Products | Primary |
|------|----------|---------|
| `Brochure_HCI_2024.pdf` | HCI, SCP | HCI (excluded) |
| `Sangfor HCI&VDI 2026.pdf` | HCI, VDI | VDI |
| `HCI SCP SKE_Port Open.xlsx` | HCI, SCP, SKE | SKE |
| `Brochure_Cyber command_2024.pdf` | Cyber Command | Cyber Command |
| `Brochure_Endpoint Secure_2024.pdf` | EPP | EPP |
| `Company Profile-2024.pptx` | All products | Company |

## 4. Unclassified Documents

| File | Reason | Action |
|------|--------|--------|
| `Samjin VS - 20241002.txt` | Customer-specific, no product name | tech_command |
| `iTerm2 Session*.txt` | Terminal logs | tech_command |
| `Master Controller_changed.txt` | Unknown context | tech_command |
| `대용량 첨부파일.html` | Email attachment | vdi (in VDI folder) |

## 5. Product Directory Structure

```
products/
├── ngaf/          # Next-Generation Application Firewall
├── iag/           # Internet Access Gateway
├── epp/           # Endpoint Secure (Endpoint Protection Platform)
├── cyber_command/ # Cyber Command (NDR)
├── vdi/           # Virtual Desktop Infrastructure (aDesk)
├── sase/          # Athena SASE / aTrust
├── ske/           # Sangfor Kubernetes Engine
├── hdr/           # Hybrid Disaster Recovery
├── scp/           # Sangfor Cloud Platform
├── astor/         # Sangfor Storage
├── sdwan/         # SD-WAN
├── network_secure/ # Network Secure (NSF)
├── sier/          # SIER (Security)
├── company/       # Sangfor Company Profile
├── scmt/          # SCMT (Cloud Migration Tool)
├── sap_reference/ # SAP HANA Reference
└── multi_product/ # Cross-product documents
```

## 6. Evidence-Based Classification

All classifications are based on:
- **Folder name**: Primary classification indicator
- **File name**: Product name detection
- **Document type**: White Paper, User Manual, Brochure, etc.
- **No content extraction performed yet** — classification is metadata-based only

> **Note**: Product names follow Sangfor's official product naming. Some folders use legacy names (e.g., "EPP" for Endpoint Secure, "SASE" for Athena SASE).
