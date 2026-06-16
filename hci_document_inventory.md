# HCI Document Inventory

> **Stage 1 Complete** | Last Updated: 2026-06-16 | Source: `/Volumes/My Passport/00. Attached/5. HCI`

## 1. Overview

| Item | Value |
|------|-------|
| Total Files Scanned | 147 (including subfolder) |
| Unique Documents | ~130 (excluding temp/lock files) |
| Scan Root | `/Volumes/My Passport/00. Attached/5. HCI` |
| Subfolders | `Performance/` (2 files) |
| File Types | PDF, PPTX, DOCX, XLSX, XLS, PYC, JSON, TXT, LIC |
| Latest Version Referenced | HCI v6.11.1 |
| Primary Product Scope | Sangfor HCI (aSV / aSAN / aNET / aSecurity), SCP |

## 2. Document Classification by Type

| Document Type | Count | Extraction Method |
|---------------|-------|-------------------|
| PDF | 55 | `pdftotext` / manual read |
| PPTX | 45 | python-pptx / manual |
| DOCX | 17 | `textutil` / python-docx |
| XLSX/XLS | 11 | openpyxl / manual |
| PYC | 6 | Not extractable (compiled Python) |
| JSON | 1 | Direct read |
| TXT | 1 | Direct read |
| LIC | 1 | License key (not extractable) |
| Temp/Lock (~$) | 1 | Skip |

## 3. Priority Classification

### P0 — Core Technical References (Must Process)

| # | File | Type | Version | Lang | Key Topics | Extraction Status |
|---|------|------|---------|------|------------|-------------------|
| 1 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper.pdf` | PDF | 6.10.0 | EN | Full architecture: aSV, aSAN, aNET, aSecurity, management, DR | ✅ Extracted (21,887 lines) |
| 2 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper - aSV.pdf` | PDF | 6.10.0 | EN | aSV hypervisor, resource management, HA, DRS | ✅ Extracted (1,802 lines) |
| 3 | `SANGFOR_HCI_V6.11.1_User Manual_EN - V4.pdf` | PDF | 6.11.1 | EN | Full user manual, all operations | ✅ TOC extracted (631 pages) |
| 4 | `SANGFOR_HCI_V6.11.1_User Manual_EN - V4.docx` | DOCX | 6.11.1 | EN | Same as above (source docx) | ✅ Available |
| 5 | `Sangfor Backup User Manual V1.4_EN_Sangfor_Google Translation.docx` | DOCX | V1.4 | EN | Backup architecture, scheduling, retention, recovery | ✅ Extracted (933 lines) |
| 6 | `EN-Sangfor HCI _DR_Best Practices.pdf` | PDF | - | EN | DR best practices, failover/failback | 🟡 Partial |
| 7 | `EN-Sangfor HCI _DR Drill_Best Practices.pdf` | PDF | - | EN | DR drill procedures | 🟡 Partial |
| 8 | `Sangfor HCI & SCP Licensing Guidance-v1.1.docx` | DOCX | v1.1 | EN | Licensing model, modules | 🔴 Not extracted |

### P1 — Important Technical / Operational

| # | File | Type | Version | Lang | Key Topics | Extraction Status |
|---|------|------|---------|------|------------|-------------------|
| 9 | `HCI_SANGFOR_HCI_6.10.0_User Manual_EN.pdf` | PDF | 6.10.0 | EN | User manual (older version) | 🔴 Not extracted |
| 10 | `SANGFOR_HCI_6.9.0_User_Manual_EN.pdf` | PDF | 6.9.0 | EN | User manual (v6.9) | 🔴 Not extracted |
| 11 | `SANGFOR_SCP_V6.10.0_User Manual_EN.pdf` | PDF | 6.10.0 | EN | SCP management platform manual | 🔴 Not extracted |
| 12 | `2025_Sangfor_HCI(aSV)_관리자매뉴얼.pdf` | PDF | 2025 | KR | Korean admin manual (latest) | 🔴 Not extracted |
| 13 | `2025_Sangfor_HCI(aSV)_관리자매뉴얼.docx` | DOCX | 2025 | KR | Korean admin manual source | 🔴 Not extracted |
| 14 | `한글_Sangfor_HCI(aSV)_관리자매뉴얼.pdf` | PDF | - | KR | Korean admin manual | 🔴 Not extracted |
| 15 | `Creit_241113_Sangfor_HCI(aSV)_관리자매뉴얼.pdf` | PDF | 2024-11 | KR | Korean admin manual (Creit version) | 🔴 Not extracted |
| 16 | `Sangfor_HCI(aSV)_관리자매뉴얼.docx` | DOCX | - | KR | Admin manual source | 🔴 Not extracted |
| 17 | `EN-Sangfor HCI_SCMT_Best Practices_V1.pdf` | PDF | V1 | EN | SCMT migration best practices | 🔴 Not extracted |
| 18 | `HCI_Migraion_ALL Versions_Best Practices_SCMT (Korean).pdf` | PDF | - | KR | SCMT migration (Korean) | 🔴 Not extracted |
| 19 | `HCI_Migraion_ALL Versions_Best Practices_SCMT.pdf` | PDF | - | EN | SCMT migration (English) | 🔴 Not extracted |
| 20 | `HCI_Migraion_Convert&ISO Best Practices.pdf` | PDF | - | EN | Convert & ISO migration | 🔴 Not extracted |
| 21 | `API_HCI_SCP_open-api_Eng.Ver- Overview & user guide.pdf` | PDF | - | EN | OpenAPI guide | 🔴 Not extracted |
| 22 | `API_HCI_SCP_open-api_Eng.Ver- Overview & user guide.docx` | DOCX | - | EN | OpenAPI guide source | 🔴 Not extracted |
| 23 | `SCP_API_OpenAPI 20240515.pdf` | PDF | 2024-05 | EN | SCP OpenAPI | 🔴 Not extracted |
| 24 | `HCI_Sangfor SCMT(Sangfor Cloud Management Tool)_User Manual.pdf` | PDF | - | EN | SCMT user manual | 🔴 Not extracted |
| 25 | `HCI_Sangfor SCMT(Sangfor Cloud Management Tool)_User Manual (Korean).pdf` | PDF | - | KR | SCMT user manual (Korean) | 🔴 Not extracted |

### P2 — Deployment / Sizing / Configuration

| # | File | Type | Version | Lang | Key Topics | Extraction Status |
|---|------|------|---------|------|------------|-------------------|
| 26 | `Recommended Specs & Max. Configuration Guide_SCP&HCI6.10.0_V1.1.pdf` | PDF | 6.10.0 V1.1 | EN | Sizing guide | 🔴 Not extracted |
| 27 | `Recommended & Max. Configuration_SCP&HCI690_202308.docx` | DOCX | 6.9.0 | EN | Sizing (v6.9) | 🔴 Not extracted |
| 28 | `Sangfor HCI Advanced Sizing & Quotation 202307.pdf` | PDF | 2023-07 | EN | Sizing & quotation | 🔴 Not extracted |
| 29 | `Sangfor HCI Advanced Sizing & Quotation 202311.pdf` | PDF | 2023-11 | EN | Sizing (updated) | 🔴 Not extracted |
| 30 | `HCI_2+1_Scenario_Witness_Deployment_Guide.pdf` | PDF | - | EN | 2+1 witness deployment | 🔴 Not extracted |
| 31 | `Sangfor HCI - SAP HANA deployment best practices.pdf` | PDF | - | EN | SAP HANA on HCI | 🔴 Not extracted |
| 32 | `Sangfor HCI - SAP HANA deployment best practices.docx` | DOCX | - | EN | SAP HANA source | 🔴 Not extracted |
| 33 | `HCI_aDeploy_Allow_Incompatible_SSD_guide.pdf` | PDF | - | EN | SSD compatibility guide | 🔴 Not extracted |
| 34 | `HCI_aDeploy_Allow_Incompatible_SSD_guide.docx` | DOCX | - | EN | SSD guide source | 🔴 Not extracted |
| 35 | `Sangfor_KubeManager_Quick Deployment Guide.pdf` | PDF | - | EN | KubeManager deployment | 🔴 Not extracted |
| 36 | `Sangfor HCI POC Plan--Template.docx` | DOCX | - | EN | PoC plan template | 🔴 Not extracted |
| 37 | `Sangfor HCI User Acceptance Testing.docx` | DOCX | - | EN | UAT template | 🔴 Not extracted |
| 38 | `HCI_POC test guide for 6.9.0.docx` | DOCX | 6.9.0 | EN | PoC test guide | 🔴 Not extracted |
| 39 | `SCP POC test guide for 6.9.0.docx` | DOCX | 6.9.0 | EN | SCP PoC guide | 🔴 Not extracted |

### P3 — Performance / Benchmarking

| # | File | Type | Version | Lang | Key Topics | Extraction Status |
|---|------|------|---------|------|------------|-------------------|
| 40 | `Performance/Performance_HCI610_虚拟存储IO_对比SMX510_nutanix-ce2.0_H3C8.0_X86架构_20240310(1).xls` | XLS | 6.10.0 | CN | Storage IO comparison data | 🔴 Not extracted (CN) |
| 41 | `Performance/Performance_深信服AI解决方案落地案例集.pptx` | PPTX | - | CN | AI solution cases | 🔴 Not extracted (CN) |
| 42 | `HCI6.10.0_가상 저장소 I:O_X86 성능 요약 20240301.xls` | XLS | 6.10.0 | KR | Storage IO performance summary | 🔴 Not extracted |
| 43 | `HCI6.10.0 가상 저장소 I:O 성능 지표 202503.pdf` | PDF | 6.10.0 | KR | Storage IO performance metrics | 🔴 Not extracted |
| 44 | `Performance_HCI610_Virtual Storage IO_Comparison with SMX510_Nutanix CE 2.0_H3C 8.0_x86 Architecture_20240310.xls` | XLS | 6.10.0 | EN | Storage IO comparison (EN) | 🔴 Not extracted |
| 45 | `HCI_Competition_Sangfor HCI 6.9.0 Performance Data (v.s. VMware vSAN) 2023 1.xlsx` | XLSX | 6.9.0 | EN | Performance vs VMware vSAN | 🔴 Not extracted |
| 46 | `HCI_Test_Performance Test Guide - V1.pdf` | PDF | V1 | EN | Performance test guide | 🔴 Not extracted |
| 47 | `HCI_Test_Performance Test Guide - V1.docx` | DOCX | V1 | EN | Performance test guide source | 🔴 Not extracted |
| 48 | `SANGFOR_aCloud_Performance Test Guide - V1.docx` | DOCX | V1 | EN | aCloud performance guide | 🔴 Not extracted |

### P4 — Sales / Marketing / Competitive

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 49 | `2026 SANGFOR HCIaSV 소개 - Simple Version.pdf` | PDF | KR | HCI intro 2026 |
| 50 | `2026 SANGFOR HCIaSV 소개 - Simple Version.pptx` | PPTX | KR | HCI intro 2026 source |
| 51 | `2026 SANGFOR HCIaSV 소개.pptx` | PPTX | KR | HCI intro 2026 full |
| 52 | `2026 SANGFOR aNET&aSEC 소개 Ver 1.0.pptx` | PPTX | KR | aNET & aSecurity intro |
| 53 | `Sangfor HCI Competitive Analysis v.s. VMware & Nutanix 2023.pptx` | PPTX | EN | vs VMware/Nutanix |
| 54 | `Sangfor HCI Competitive Analysis v.s. VMware & Nutanix_[Korean].pptx` | PPTX | KR | vs VMware/Nutanix (KR) |
| 55 | `Sangfor HCI Competitive Analysis v.s. SmartX_2024.pptx` | PPTX | EN | vs SmartX |
| 56 | `Sangfor HCI Feature comparison VS Nutanix & VMware-2023.pdf` | PDF | EN | Feature comparison |
| 57 | `VMWARE 호환관련 기능비교 - 20260422.pptx` | PPTX | KR | VMware compatibility |
| 58 | `Sangfor VMware Replacement Program 202401-Customer Version.pdf` | PDF | EN | VMware replacement |
| 59 | `Sangfor VMware Replacement Program 202401-Partner Version.pdf` | PDF | EN | VMware replacement (partner) |
| 60 | `[Internal] Sangfor VMware Replacement Program 202401-Cheatsheet.pdf` | PDF | EN | Internal cheatsheet |
| 61 | `[Internal] VMware Migration 202401-Final.pdf` | PDF | EN | VMware migration guide |
| 62 | `VMware 8.0 version_support.docx` | DOCX | EN | VMware 8.0 support |
| 63 | `VMware Replacement Checklist.docx` | DOCX | EN | Replacement checklist |
| 64 | `Sangfor vs SmartX_Partner - Korea..docx` | DOCX | KR | vs SmartX (Korean) |
| 65 | `Legacy와 HCI 비교.160427.pptx` | PPTX | KR | Legacy vs HCI |
| 66 | `Sangfor HCI Cheatsheet 2023.pdf` | PDF | EN | Quick reference |
| 67 | `Sangfor_HCI_Cheat_Sheet_2.0.pdf` | PDF | EN | Cheat sheet v2 |

### P5 — Case Studies / Customer References

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 68 | `Case_Sangfor HCI Case Study BFSI_KR 1.pdf` | PDF | KR | BFSI case study |
| 69 | `Case_Sangfor HCI 고객성공사례_KR.pdf` | PDF | KR | Customer success |
| 70 | `Case_어노테이션에이아이 AI인프라 가상화 통합 사례_20220429_Rev1.pdf` | PDF | KR | AI infra case |
| 71 | `Sangfor HCI 고객성공사례_시나리오 기준.pptx` | PPTX | KR | Customer scenarios |
| 72 | `HCI Customer Logo.pdf` | PDF | - | Customer logos |
| 73 | `Sangfor HCI Case Study Folder - 20230630.pdf` | PDF | EN | Case study collection |

### P6 — Presentations / Slide Decks

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 74 | `PP_P_Sangfor-HCI-Main-Slides_20230715_Customer Version.pptx` | PPTX | EN | Main slides (customer) |
| 75 | `PP_P_Sangfor-HCI-Main-Slides_20230715_Partner Version.pptx` | PPTX | EN | Main slides (partner) |
| 76 | `Sangfor-HCI-Main-Slides_202409_Customer Version.pptx` | PPTX | EN | Main slides 2024 |
| 77 | `Sangfor HCI Technical Main Slides 202307.pptx` | PPTX | EN | Technical slides |
| 78 | `SSG.COM - Sangfor HCI MainSlides_2024.pptx` | PPTX | KR | SSG.COM slides |
| 79 | `SANGFOR aCloud (서버가상화,HCI)_cwpark_250619.pptx` | PPTX | KR | aCloud presentation |
| 80 | `SANGFOR aCloud (서버가상화,HCI)_포스코.pptx` | PPTX | KR | POSCO presentation |
| 81 | `SANGFOR aCloud HCI&VDI.pptx` | PPTX | KR | HCI & VDI |
| 82 | `SANGFOR aCloud_HCI&VDI 자료.pptx` | PPTX | KR | HCI & VDI materials |
| 83 | `SANGFOR aCloud_HCI&VDI&SKE 자료.pptx` | PPTX | KR | HCI, VDI, SKE |
| 84 | `Sangfor HCI&VDI 2025.pptx` | PPTX | KR | HCI & VDI 2025 |
| 85 | `Sangfor HCI&VDI 효성 세미나 발표 20241118.pptx` | PPTX | KR | Hyosung seminar |
| 86 | `Sangfor HCI&VDI_xfusion-20241011.pptx` | PPTX | KR | xFusion presentation |
| 87 | `Sangfor HCI&VDI_부산 세미나 발표.pptx` | PPTX | KR | Busan seminar |
| 88 | `#Sangfor HCI&VDI 효성 세미나 발표 20241121.pptx` | PPTX | KR | Hyosung seminar v2 |
| 89 | `세계가 인정한 Full-Stack HCI, aCloud.pptx` | PPTX | KR | Full-stack HCI promo |
| 90 | `HCI 데모 구성.pptx` | PPTX | KR | Demo configuration |
| 91 | `HCI 설계구성도 - 수정3.pptx` | PPTX | KR | Design configuration |
| 92 | `HW_구성도.pptx` | PPTX | KR | HW configuration |
| 93 | `HCI_서버 가상화 구축 설계 가이드.pptx` | PPTX | KR | Server virtualization design |
| 94 | `Halla_IMS_HCI_CEO_Proposal.pptx` | PPTX | KR | Halla CEO proposal |
| 95 | `Halla_IMS_HCI_CEO_Proposal_Final.pptx` | PPTX | KR | Halla CEO proposal final |
| 96 | `Halla_IMS_HCI_CEO_Proposal_v2.pptx` | PPTX | KR | Halla CEO proposal v2 |
| 97 | `Sangfor HCI 소개자료.pptx` | PPTX | KR | HCI introduction |
| 98 | `Sangfor HCI Infra Automation with SCC.pptx` | PPTX | EN | Infra automation |

### P7 — DR / Backup / Data Protection

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 99 | `Sangfor HCI _DR_Best Practices.pdf` | PDF | EN | DR best practices |
| 100 | `Sangfor Data Protection & Disaster Recovery Solution.pdf` | PDF | EN | DP & DR solution |
| 101 | `Sangfor Data Protection & Disaster Recovery Solution.pptx` | PPTX | EN | DP & DR slides |
| 102 | `Sangfor HCI&DR 솔루션 소개 - 20251210.pdf` | PDF | KR | HCI & DR intro |
| 103 | `Sangfor DR Workbook & Templates -202206-v2.docx` | DOCX | EN | DR workbook |
| 104 | `HCI_Sangfor CDP White Paper.docx` | DOCX | EN | CDP white paper |
| 105 | `HCI_Veeam & Sangfor Joint Solution Introduction 202502.pptx` | PPTX | EN | Veeam joint solution |
| 106 | `HCI_Veeam & Sangfor Joint Solution Introduction 202502 - Kor.pptx` | PPTX | KR | Veeam (Korean) |
| 107 | `Veeam_Veeam Backup Feature List on Sangfor HCI Phase 1.xlsx` | XLSX | EN | Veeam feature list |

### P8 — Certification / Training

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 108 | `Sangfor Certified Solution Experts for HCI - 202403.pptx` | PPTX | EN | Expert certification |
| 109 | `Sangfor Certified Solution Sales for HCI - 202403.pptx` | PPTX | EN | Sales certification |
| 110 | `Sangfor Certified Solution Sales for HCI＿ＶＭ웨어　파트너 1.pptx` | PPTX | KR/EN | VMware partner cert |

### P9 — Tender / Procurement / TCO

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 111 | `240411_표준제안서(SANGFOR HCI).pptx` | PPTX | KR | Standard proposal |
| 112 | `Sangfor HCI & SCP Tender Specs 20230714.xlsx` | XLSX | EN | Tender specs |
| 113 | `Sangfor HCI & SCP Tender Specs 20230714 (Korean).xlsx` | XLSX | KR | Tender specs (KR) |
| 114 | `Sangfor HCI & SCP Tender Specs 20230714 (Korean) - Hinfo.xlsx` | XLSX | KR | Tender specs (Hinfo) |
| 115 | `Sangfor_HCI_TCO_디자인제안서_v2.pptx` | PPTX | KR | TCO design |
| 116 | `Sangfor_HCI_TCO_제안서.pptx` | PPTX | KR | TCO proposal |
| 117 | `작업계획서 - 초기구축_HCI,SCP - 20260124.xlsx` | XLSX | KR | Initial deployment plan |

### P10 — PoC Reports

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 118 | `PoC_25년 HCI PoC 프로젝트_결과 보고서.pdf` | PDF | KR | PoC result report |
| 119 | `PoC_25년 HCI PoC 프로젝트_결과 보고서.pptx` | PPTX | KR | PoC result slides |
| 120 | `250213_Sangfor HCI PoC 시나리오.pptx` | PPTX | KR | PoC scenario |
| 121 | `Sangfor_HCI_PoC 표준 시나리오.pptx` | PPTX | KR | Standard PoC scenario |
| 122 | `Sangfor_HCI_PoC 표준 시나리오_한국해양수산연수원_20250701.pptx` | PPTX | KR | PoC for maritime |
| 123 | `[SSG.COM] 25년 HCI PoC_0109.pptx` | PPTX | KR | SSG PoC |
| 124 | `Sangfor HCI POC survey table.xlsx` | XLSX | EN | PoC survey |
| 125 | `Sangfor HCI POC survey table_CJ.xlsx` | XLSX | KR | CJ PoC survey |

### P11 — Feature / Config Checklists

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 126 | `HCI_Sangfor HCI Feature List_6.9.0.xlsx` | XLSX | EN | Feature list v6.9 |
| 127 | `Sangfor HCI Configration checklist 2025.xlsx` | XLSX | EN | Configuration checklist |
| 128 | `HCI_DS_P_Sangfor_HCI_DataSheet–Software_Based_20240119.pdf` | PDF | EN | Datasheet |
| 129 | `hci_ds_p_sangfor-hci-aserver-2000-series-datasheet--software-based_20220224.pdf` | PDF | EN | aServer datasheet |
| 130 | `Sangfor HCI & SCP Technical White Paper.pdf` | PDF | EN | Combined HCI & SCP WP |
| 131 | `Sangfor HCI 6.9.0 Technical White Paper Preview Version.pdf` | PDF | 6.9.0 | EN | WP preview |
| 132 | `Tech_HCI_Sangfor HCI 6.9.0 Technical White Paper Preview Version.pdf` | PDF | 6.9.0 | EN | WP preview (alt) |
| 133 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper (Korean).pdf` | PDF | 6.10.0 | KR | White Paper (Korean) |
| 134 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper copy.pdf` | PDF | 6.10.0 | EN | WP copy |
| 135 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper2.pdf` | PDF | 6.10.0 | EN | WP variant 2 |
| 136 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper3.pdf` | PDF | 6.10.0 | EN | WP variant 3 |
| 137 | `HCI_SANGFOR_HCI_V6.10.0_Technical White Paper_Two Host.pdf` | PDF | 6.10.0 | EN | Two-host deployment |

### P12 — Other / Miscellaneous

| # | File | Type | Lang | Key Topics |
|---|------|------|------|------------|
| 138 | `ACP_Alauda Container Platform Datasheet.pdf` | PDF | EN | Alauda container platform |
| 139 | `ACP_Cloud Native Success Platform Quickstarts.pdf` | PDF | EN | Cloud native quickstarts |
| 140 | `2024_Cloud_Events_and_Conferences.pdf` | PDF | EN | Cloud events |
| 141 | `Sangfor Certified Solution Experts for HCI - 202403.pptx` | PPTX | EN | Certification |
| 142 | `Migreation_Sangfor aCloud Hyper-V support.docx` | DOCX | EN | Hyper-V migration |
| 143 | `Migreation_Sangfor aCloud Hyper-V support.pdf` | PDF | EN | Hyper-V migration |

### P13 — Non-Document / Compiled / Config

| # | File | Type | Notes |
|---|------|------|-------|
| 144 | `controllers.deploy.check_hci_install.pyc` | PYC | Compiled Python - not extractable |
| 145 | `controllers.deploy.config_hci_install.pyc` | PYC | Compiled Python |
| 146 | `controllers.deploy.install_hci_poc.pyc` | PYC | Compiled Python |
| 147 | `controllers.install.install_hci.pyc` | PYC | Compiled Python |
| 148 | `hci.pyc` | PYC | Compiled Python |
| 149 | `hci_io_profile.json` | JSON | IO profile config |
| 150 | `debug-tools.txt` | TXT | Debug tools reference |
| 151 | `HCI6.9.0_SXF_TEST_B42465896B9F3078_20240227_100828.lic` | LIC | License key |

## 4. Duplicates / Similar Documents

| Group | Documents | Recommendation |
|-------|-----------|----------------|
| White Paper v6.10.0 | 6 variants (main, aSV, Korean, copy, v2, v3, Two-Host) | Use main as primary; Two-Host for dual-node specifics |
| Admin Manual | 4 variants (2025 KR PDF, DOCX, 한글 PDF, Creit PDF) | Use 2025 as primary; Creit for reference |
| User Manual | v6.9.0, v6.10.0, v6.11.1 (EN) | Use v6.11.1 as primary (latest) |
| SCMT Migration | Korean + English + Convert&ISO | Use English as primary |
| Main Slides | 2023 Customer/Partner, 2024 Customer | Use 2024 as primary |
| Halla Proposal | 3 versions (original, v2, Final) | Use Final as primary |
| Veeam Solution | 3 versions (EN, Kor, autosaved) | Use EN as primary |
| PoC Standard | 2 versions (standard, maritime) | Use standard as primary |

## 5. Language Distribution

| Language | Count | Percentage |
|----------|-------|------------|
| English (EN) | 68 | 45% |
| Korean (KR) | 55 | 37% |
| Chinese (CN) | 3 | 2% |
| Bilingual (KR/EN) | 5 | 3% |
| N/A (code/config) | 19 | 13% |

## 6. OCR / Visual Analysis Required

| File | Reason | Priority |
|------|--------|----------|
| `HCI설계구성도 - 수정3.pptx` | Architecture diagram (image-heavy) | High |
| `HW_구성도.pptx` | Hardware configuration diagrams | High |
| `HCI_서버 가상화 구축 설계 가이드.pptx` | Design guide with diagrams | Medium |
| `Performance/Performance_深信服AI解决方案落地案例集.pptx` | Chinese AI solution visuals | Low |
| Various competitive analysis PPTXs | Screenshot-heavy comparisons | Low |

## 7. Extraction Coverage Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Fully Extracted | 5 | 3% |
| 🟡 Partially Extracted | 3 | 2% |
| 🔴 Not Extracted | 120 | 80% |
| ⬜ Not Applicable | 22 | 15% |

> **Note**: Core technical content (White Paper, User Manual, Backup Manual) has been extracted. Remaining unextracted documents are primarily sales/marketing, competitive analysis, and duplicated versions of already-extracted content.
