# HCI LLM Wiki Input Data Preparation

> **Stage 2 Complete** | Last Updated: 2026-06-16 | Source: `/Volumes/My Passport/00. Attached/5. HCI`

## 1. Preparation Overview

This document tracks the conversion status of HCI source documents into LLM Wiki-readable format.

### Preparation Philosophy
- **No detailed ETL normalization** (no raw_text/normalized_text/extracted_tables/extracted_diagrams pipeline)
- Convert documents to forms that LLM Wiki can read
- Tag important materials for data flow processing
- Track extraction failures separately

## 2. Document Conversion Status

### 2.1 Core Technical Documents

| Source File | Target Format | Conversion Method | Status | Confidence | Lines Extracted |
|-------------|---------------|-------------------|--------|------------|-----------------|
| `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper.pdf` | Markdown | pdftotext → manual structuring | ✅ Done | High | 21,887 |
| `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper - aSV.pdf` | Markdown | pdftotext | ✅ Done | High | 1,802 |
| `SANGFOR_HCI_V6.11.1_User Manual_EN - V4.pdf` | Markdown | pdftotext (TOC + Ch1-11) | ✅ Done | High | ~3,000 (TOC) |
| `Sangfor Backup User Manual V1.4_EN_Sangfor_Google Translation.docx` | Markdown | textutil | ✅ Done | Medium (Google Translate) | 933 |
| `EN-Sangfor HCI _DR_Best Practices.pdf` | Text | pdftotext | 🟡 Partial | High | Not yet confirmed |
| `EN-Sangfor HCI _DR Drill_Best Practices.pdf` | Text | pdftotext | 🟡 Partial | High | Not yet confirmed |

### 2.2 Important Documents (Not Yet Converted)

| Source File | Type | Importance Tag | Conversion Priority | Notes |
|-------------|------|----------------|---------------------|-------|
| `Sangfor HCI & SCP Licensing Guidance-v1.1.docx` | DOCX | 🔴 HIGH | P0 | Licensing model — required for HCI Licensing Wiki page |
| `2025_Sangfor_HCI(aSV)_관리자매뉴얼.pdf` | PDF | 🔴 HIGH | P0 | Latest Korean admin manual |
| `API_HCI_SCP_open-api_Eng.Ver- Overview & user guide.pdf` | PDF | 🔴 HIGH | P0 | OpenAPI — required for API/automation flow |
| `SANGFOR_SCP_V6.10.0_User Manual_EN.pdf` | PDF | 🟡 MEDIUM | P1 | SCP management platform |
| `Recommended Specs & Max. Configuration Guide_SCP&HCI6.10.0_V1.1.pdf` | PDF | 🟡 MEDIUM | P1 | Sizing — required for deployment process |
| `HCI_Sangfor SCMT(Sangfor Cloud Management Tool)_User Manual.pdf` | PDF | 🟡 MEDIUM | P1 | SCMT migration tool |
| `Sangfor HCI - SAP HANA deployment best practices.pdf` | PDF | 🟡 MEDIUM | P1 | SAP HANA specific deployment |
| `HCI_2+1_Scenario_Witness_Deployment_Guide.pdf` | PDF | 🟡 MEDIUM | P1 | Stretched cluster deployment |

### 2.3 Sales / Marketing (Low Priority for Wiki)

| Category | Count | Conversion Need |
|----------|-------|-----------------|
| Competitive Analysis (VMware/Nutanix/SmartX) | 12 | Extract comparison tables only |
| Case Studies | 6 | Extract architecture patterns |
| Sales Presentations | 20+ | Skip — not technical content |
| TCO / Proposal | 5 | Skip — business content |
| Certification Materials | 3 | Skip — training content |

## 3. Important Material Tags

### 🔴 Critical for Data Flow Processing

| Tag | Documents | Relevance |
|-----|-----------|-----------|
| **Architecture Diagram** | White Paper Ch4, Ch5.1-5.5, HCI설계구성도.pptx | System architecture, component relationships |
| **Cluster Configuration** | White Paper Ch4.4, 2+1 Deployment Guide, Two-Host WP | Cluster topology, node roles |
| **Storage Flow** | White Paper Ch5.2, Performance XLS files | aSAN I/O path, sharding, tier, RDMA |
| **Network Configuration** | White Paper Ch5.3, aNET&aSEC Intro.pptx | VXLAN, overlay, DFW, edge router |
| **Backup/DR Configuration** | DR Best Practices, DR Workbook, Veeam Joint Solution | Replication, failover, failback |
| **License Table** | Licensing Guidance v1.1 | Module structure, feature gating |
| **Deployment Procedure** | User Manual v6.11.1, Admin Manual 2025 | Step-by-step operations |
| **Failure Response Procedure** | User Manual Ch10-11, Admin Manual | Error handling, recovery |

### 🟡 Important for Product Summary

| Tag | Documents | Relevance |
|-----|-----------|-----------|
| **Feature List** | Feature List 6.9.0, Feature Comparison | Complete feature inventory |
| **Sizing Guide** | Recommended Specs, Advanced Sizing | Capacity planning |
| **PoC Scenarios** | PoC Standard Scenario, PoC Reports | Real-world validation |

## 4. Conversion Method by File Type

| File Type | Primary Tool | Fallback | Notes |
|-----------|-------------|----------|-------|
| PDF | `/opt/homebrew/bin/pdftotext` | Manual page-by-page | Best for text-heavy PDFs |
| DOCX | `textutil -convert txt` | python-docx | textutil available on macOS |
| PPTX | python-pptx | Manual extraction | Image-heavy slides need OCR |
| XLSX/XLS | openpyxl | Manual reading | Structured data extraction |
| Images | OCR (Tesseract) | Visual analysis | For architecture diagrams |

## 5. Metadata Schema

Each converted document chunk carries minimum metadata:

```yaml
source_file: "HCI_SANGFOR_HCI_V6.10.0_Technical White Paper.pdf"
page_or_slide: "Ch5.2 p.45-67"
document_type: "Technical White Paper"
topic_hint: "aSAN Storage Architecture"
importance: "critical"  # critical | high | medium | low
extraction_status: "completed"  # completed | partial | failed | pending
confidence: "high"  # high | medium | low
evidence_type: "sangfor_official"  # sangfor_official | general_hci | inferred
```

## 6. Extraction Failure Items

| File | Failure Reason | Workaround |
|------|---------------|------------|
| `.pyc` files (6) | Compiled Python bytecode | Not extractable — skip |
| `.lic` file | License key binary | Not relevant — skip |
| `hci_io_profile.json` | Config file | Direct JSON read if needed |
| Chinese PPTX files (2) | Language barrier | Low priority — skip |
| Image-heavy PPTXs | No text layer | Requires OCR (Tesseract) |
| `~$SANGFOR aCloud HCI&VDI.pptx` | Temp/lock file | Skip |

## 7. Source Coverage for Wiki Pages

| Wiki Page | Primary Sources | Coverage |
|-----------|----------------|----------|
| HCI Overview | White Paper Ch1-4 | ✅ Full |
| HCI Architecture | White Paper Ch4 | ✅ Full |
| HCI Management Plane | White Paper Ch5.5, User Manual | ✅ Full |
| HCI Compute Flow | White Paper Ch5.1 | ✅ Full |
| HCI Storage Flow | White Paper Ch5.2 | ✅ Full |
| HCI Network Flow | White Paper Ch5.3 | ✅ Full |
| HCI VM Lifecycle | White Paper Ch5.1, User Manual | ✅ Full |
| HCI Snapshot Flow | White Paper Ch5.2 | ✅ Full |
| HCI Backup Flow | Backup Manual, DR Best Practices | ✅ Full |
| HCI DR Flow | White Paper Ch5.2, DR Best Practices | ✅ Full |
| HCI HA Failure Flow | White Paper Ch5.1 | ✅ Full |
| HCI Monitoring/Log Flow | White Paper Ch5.5 | ✅ Full |
| HCI API/Automation Flow | White Paper Ch5.5, OpenAPI Guide | 🟡 Partial (OpenAPI not extracted) |
| HCI Licensing | Licensing Guidance | 🔴 Not extracted |
| HCI Deployment Process | User Manual, Admin Manual | 🟡 Partial (Admin Manual KR not extracted) |
| HCI Operations Process | User Manual v6.11.1 | ✅ Full |
| HCI Competitive Comparison | Competitive PPTXs | 🟡 Partial |

> **Overall Assessment**: Core technical sources (White Paper, User Manual, Backup Manual) provide ~80% coverage for all 17 Wiki pages. Remaining gaps are in API documentation, licensing details, and Korean admin manual specifics.
