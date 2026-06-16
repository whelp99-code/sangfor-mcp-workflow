# Global File Inventory — /Volumes/My Passport/00. Attached/

> **Stage 1 Complete** | Last Updated: 2026-06-16 | HCI 폴더 제외 처리 완료

## 1. Overview

| Item | Value |
|------|-------|
| Scan Root | `/Volumes/My Passport/00. Attached/` |
| Excluded | `/Volumes/My Passport/00. Attached/5. HCI` |
| Total Files Found | 711 |
| Excluded Files (HCI) | ~366 |
| Processed Files | 345 |
| Scan Date | 2026-06-16 |

> **⚠️ /Volumes/My Passport/00. Attached/5. HCI 제외 처리 완료**

## 2. Folder Distribution

| Folder | Files | Primary Product | File Types |
|--------|-------|-----------------|------------|
| `1. NGAF` | 11 | NGAF | PDF(10), XLSX(1) |
| `2. IAG` | 7 | IAG | PDF(3), PPTX(1), XLSX(3) |
| `3. EPP` | 2 | EPP, hDR | PDF(2) |
| `4. Cyber Command` | 12 | Cyber Command | PDF(5), PPTX(6), XLSX(1) |
| `6. VDI` | 46 | VDI | PDF(12), PPTX(19), DOCX(4), XLSX(8), HTML(1), PPT(2) |
| `7. SASE` | 8 | SASE/aTrust | PDF(2), PPTX(4), JPG(1), XLSX(1) |
| `Brochure` | 25 | Multi-product | PDF(25) |
| `Reference` | 5 | SAP/HCI | PDF(2), DOCX(3) |
| `SCMT Kernel` | 18 | SCMT | ZIP(18) |
| `SKE` | 32 | SKE | PDF(5), PPTX(8), DOCX(5), XLSX(7), TXT(4), PPT(1) |
| `Sangfor 회사소개` | 6 | Company | PPTX(6) |
| `Tech Command` | 4 | Misc | TXT(4) |

## 3. File Type Distribution

| Type | Count | Percentage | Extractable |
|------|-------|------------|-------------|
| PPTX | 158 | 45.8% | python-pptx |
| PDF | 98 | 28.4% | pdftotext |
| XLSX | 36 | 10.4% | openpyxl |
| ZIP | 20 | 5.8% | Not extractable (binary) |
| DOCX | 19 | 5.5% | textutil |
| TXT | 8 | 2.3% | Direct read |
| PPT | 2 | 0.6% | python-pptx |
| HTML | 1 | 0.3% | Direct read |
| JPG | 1 | 0.3% | OCR needed |
| MP4 | 1 | 0.3% | Not extractable |
| PY | 1 | 0.3% | Direct read |

## 4. Product Classification Summary

| Product | Files | Primary Folder | Priority |
|---------|-------|----------------|----------|
| **NGAF** | 11 | 1. NGAF | 1순위 |
| **IAG** | 7 | 2. IAG | 1순위 |
| **EPP** | 2 | 3. EPP | 2순위 |
| **Cyber Command** | 12 | 4. Cyber Command | 2순위 |
| **VDI** | 46 | 6. VDI | 2순위 |
| **SASE/aTrust** | 8 | 7. SASE | 1순위 |
| **SKE** | 32 | SKE | 1순위 |
| **SCMT** | 18 | SCMT Kernel | 2순위 |
| **hDR/aDR** | 1 | 3. EPP | 1순위 |
| **SCP** | 3 | Brochure | 1순위 |
| **aStor** | 1 | Brochure | 2순위 |
| **SDWAN** | 1 | Brochure | 2순위 |
| **Network Secure** | 3 | Brochure | 2순위 |
| **SIER** | 1 | Brochure | 3순위 |
| **Company** | 6 | Sangfor 회사소개 | 3순위 |
| **Multi-product** | 25 | Brochure | 3순위 |
| **SAP Reference** | 5 | Reference | 3순위 |
| **Misc** | 4 | Tech Command | 3순위 |

## 5. Excluded Files

| Reason | Count | Path |
|--------|-------|------|
| HCI 폴더 제외 | ~366 | `/Volumes/My Passport/00. Attached/5. HCI/*` |
| Temp/Lock files | 5 | `~$*` files |
| .DS_Store | 12 | `.DS_Store` |

## 6. Key Documents by Product

### NGAF (1순위)
- `Sangfor NGAF vs SonicWall.pdf` — 경쟁 비교
- `NGAF-End-of-Order_*.pdf` (8건) — EOL/EOS 공지
- `Sangfor NGAF_FL_I_ Feature List_based on 8.0.47_v1_20230506.xlsx` — 기능 목록

### IAG (1순위)
- `SANGFOR_IAG_v13.0.80_User_Manual_EN.pdf` — 사용자 매뉴얼 (42MB)
- `Sangfor_IAG_V13.0.80_Associate_2024_02_Deployment.pdf` — 배포 가이드
- `Sangfor IAG 소개자료.pdf` — 소개 자료
- `SANGFOR_IAG_New_ Sizing Guide-20250103.xlsx` — 사이징 가이드

### SKE (1순위)
- `SKE_Sangfor Kubernetes Engine Technical White Paper.pdf` — 기술 백서
- `Sangfor_SKE1.0_User Manual.pdf` — 사용자 매뉴얼 (26MB)
- `Sangfor_SKE_Function Introduction.pdf` — 기능 소개
- `SKE_Sangfor_Kubernetes Engine_Version Fuction Training_V3.pptx` — 버전 기능 교육
- `SKE_Sangfor Kubernetes Engine Feature List.xlsx` — 기능 목록

### VDI (2순위)
- `SANGFOR_VDI_VDC_v5.9.1_User Manual_20240117.pdf` — 사용자 매뉴얼 (47MB)
- `SANGFOR_VDI_IOM_v2.0_User Manual_20231228.docx` — IOM 매뉴얼
- `Sangfor VDI Main Slides_2026.pdf` — 메인 슬라이드
- `Sangfor aDesk VDI Version and Feature List 20241216.xlsx` — 기능 목록

### Cyber Command (2순위)
- `CC_Sangfor Cyber Command - NDR PlatformDarktrace Battle Card_20240821.pdf` — 경쟁 비교
- `CC_Cyber Command Main Product Slides_03.12.2024.pptx` — 메인 슬라이드
- `CC_Cyber Command Pitch Deck_03.12.2024.pptx` — 피치 덱
- `MDR_Cyber Guardian - Partner v2.3.pptx` — MDR 가이드

### SASE (1순위)
- `Sangfor SASE Main Slide 2026.pdf` — 메인 슬라이드
- `SASE Sales Training [July 2025].pptx` — 영업 교육
- `SASE Pre-Sales Training [July 2025].pptx` — 프리세일즈 교육

### hDR/aDR (1순위)
- `Sangfor_hDR_User_Manual_V2.0.pdf` — hDR 사용자 매뉴얼 (10MB)
