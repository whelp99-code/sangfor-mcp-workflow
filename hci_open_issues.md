# HCI Knowledge Base — Open Issues & Unresolved Items

> **Stage 8-9** | Last Updated: 2026-06-16 | 8 Final Deliverables

## 1. Document Evidence Gaps

### 🔴 High Priority (Blocks Wiki Page Completeness)

| # | Issue | Affected Wiki Page | Source Gap | Action Required |
|---|-------|--------------------|-----------|-----------------|
| 1 | License SKU codes not available | hci-licensing | `Sangfor HCI & SCP Licensing Guidance-v1.1.docx` not extracted | Extract text from DOCX |
| 2 | OpenAPI endpoint list incomplete | hci-api-automation-flow | `API_HCI_SCP_open-api_Eng.Ver- Overview & user guide.pdf` not extracted | Extract and parse OpenAPI spec |
| 3 | SCP multi-cluster limits unknown | hci-management-plane | `SANGFOR_SCP_V6.10.0_User Manual_EN.pdf` not extracted | Extract SCP manual |
| 4 | Admin Manual (Korean 2025) not extracted | hci-deployment-process, hci-operations-process | `2025_Sangfor_HCI(aSV)_관리자매뉴얼.pdf` not extracted | Extract KR admin manual |

### 🟡 Medium Priority (Incomplete but Not Blocking)

| # | Issue | Affected Wiki Page | Source Gap | Workaround |
|---|-------|--------------------|-----------|------------|
| 5 | SPDK Turbo benchmarks not documented | hci-storage-flow | White Paper mentions SPDK but no perf numbers | Mark as "문서 근거 없음" |
| 6 | Erasure coding details not specified | hci-storage-flow | aSAN uses replication; EC not mentioned | Mark as "not applicable" or "문서 근거 없음" |
| 7 | vNGAF feature details incomplete | hci-architecture (aSecurity) | White Paper Ch5.4 is high-level | General HCI security knowledge used |
| 8 | SCMT migration tool details not extracted | hci-deployment-process | SCMT User Manual not extracted | Mark as pending |
| 9 | Sizing guide not extracted | hci-deployment-process | `Recommended Specs & Max. Configuration Guide` not extracted | Mark as pending |
| 10 | SAP HANA deployment specifics | hci-operations-process | SAP HANA guide not extracted | Mark as pending |

### 🟢 Low Priority (Nice to Have)

| # | Issue | Notes |
|---|-------|-------|
| 11 | Performance comparison data (vs VMware/Nutanix/SmartX) | Sales materials exist but not technically verified |
| 12 | PoC result reports not analyzed | Could provide real-world validation data |
| 13 | Case study architectures not extracted | Could enrich competitive comparison |
| 14 | Chinese language documents (2 files) | Low relevance for Korean market |

## 2. Content Conflicts

| # | Conflict | Sources | Resolution |
|---|----------|---------|------------|
| 1 | White Paper v6.10.0 has 6 variants (main, aSV, Korean, copy, v2, v3, Two-Host) | Multiple PDF files | Used main PDF as primary; Two-Host for dual-node specifics |
| 2 | Admin Manual exists in 4 versions (2025 KR, DOCX, 한글, Creit) | Multiple files | Not yet extracted — potential conflict pending |
| 3 | Backup Manual is Google Translation | `Sangfor Backup User Manual V1.4_EN_Sangfor_Google Translation.docx` | Medium confidence — translation quality may affect accuracy |
| 4 | Feature List v6.9.0 vs White Paper v6.10.0 feature set | Different versions | Used v6.10.0 as primary (newer) |

## 3. OCR / Visual Analysis Required

| # | File | Content | Priority | Estimated Effort |
|---|------|---------|----------|-----------------|
| 1 | `HCI설계구성도 - 수정3.pptx` | Architecture diagram (image-heavy) | 🔴 High | 2-4 hours (manual + OCR) |
| 2 | `HW_구성도.pptx` | Hardware configuration diagrams | 🟡 Medium | 1-2 hours |
| 3 | `HCI_서버 가상화 구축 설계 가이드.pptx` | Design guide with diagrams | 🟡 Medium | 2-3 hours |
| 4 | Various competitive PPTXs | Screenshot-heavy comparisons | 🟢 Low | Skip for now |

**Tools needed**: Tesseract OCR (`brew install tesseract`), or python-pptx for text extraction

## 4. "문서 근거 없음" Items

The following claims in the Wiki pages lack direct Sangfor documentation evidence:

| # | Item | Wiki Page | Status | Classification |
|---|------|-----------|--------|----------------|
| 1 | SPDK Turbo performance numbers | hci-storage-flow | 문서 근거 없음 | General HCI knowledge suggests NVMe user-space I/O |
| 2 | Erasure coding support | hci-storage-flow | 문서 근거 없음 | aSAN uses replication per documentation |
| 3 | Maximum cluster size (1000+ nodes) | hci-overview | 일반 HCI 아키텍처 기준 | White Paper mentions scalability but not exact limit |
| 4 | Ansible/Terraform integration | hci-api-automation-flow | 문서 근거 없음 | Inferred from OpenAPI existence |
| 5 | vGPU vendor support list | hci-compute-flow | 문서 근거 없음 | White Paper mentions GPU support but not vendor list |
| 6 | L7 application awareness in FWaaS | hci-network-flow | 일반 HCI 아키텍처 기준 | FWaaS mentioned but L7 details not specified |

## 5. "일반 HCI 아키텍처 기준" Items

The following content uses general HCI architecture knowledge where Sangfor-specific documentation was not available:

| # | Item | Wiki Page | Basis |
|---|------|-----------|-------|
| 1 | NUMA scheduling specifics | hci-compute-flow | White Paper mentions NUMA but not implementation details |
| 2 | Bond failover mechanisms | hci-network-flow | White Paper mentions NIC bonding but not specific algorithms |
| 3 | Alert escalation policies | hci-monitoring-log-flow | General monitoring best practices |
| 4 | Log rotation and retention | hci-monitoring-log-flow | General IT operations practice |
| 5 | API rate limiting | hci-api-automation-flow | General API best practices |

## 6. Extraction Coverage Summary

| Status | Documents | Percentage |
|--------|-----------|------------|
| ✅ Fully Extracted | 5 | 3% |
| 🟡 Partially Extracted | 3 | 2% |
| 🔴 Not Extracted (P0-P1) | 18 | 12% |
| 🔴 Not Extracted (P2-P3) | 20 | 13% |
| 🔴 Not Extracted (P4+) | 82 | 55% |
| ⬜ Not Applicable (code/config) | 22 | 15% |

> **Core technical coverage**: White Paper + User Manual + Backup Manual = ~80% of Wiki page content needs met.

## 7. Next Steps

### Immediate (Complete Knowledge Base)

| # | Action | Priority | Estimated Effort |
|---|--------|----------|-----------------|
| 1 | Extract Licensing Guidance v1.1 DOCX | 🔴 High | 30 min |
| 2 | Extract OpenAPI Guide PDF | 🔴 High | 1 hour |
| 3 | Extract SCP User Manual PDF | 🔴 High | 2 hours |
| 4 | Extract Korean Admin Manual 2025 PDF | 🔴 High | 2 hours |
| 5 | OCR architecture diagram PPTXs | 🟡 Medium | 4 hours |

### Short-term (Enhance Wiki Pages)

| # | Action | Priority | Estimated Effort |
|---|--------|----------|-----------------|
| 6 | Extract DR Best Practices full text | 🟡 Medium | 1 hour |
| 7 | Extract DR Drill Best Practices | 🟡 Medium | 1 hour |
| 8 | Extract SCMT User Manual | 🟡 Medium | 1 hour |
| 9 | Extract Sizing Guide | 🟡 Medium | 30 min |
| 10 | Extract SAP HANA Guide | 🟢 Low | 1 hour |

### Medium-term (Knowledge Graph Enhancement)

| # | Action | Priority | Based On |
|---|--------|----------|----------|
| 11 | Implement `knowledge-graph.ts` (LightRAG pattern) | 🟡 Medium | hci_open_source_research.md |
| 12 | Enhance `rag-indexer.ts` with graph-aware search | 🟡 Medium | hci_open_source_research.md |
| 13 | Build entity-relationship extraction for HCI docs | 🟡 Medium | hci_open_source_research.md |
| 14 | Generate MkDocs/Docusaurus site from Wiki pages | 🟢 Low | hci_open_source_research.md |

### Long-term (Automation)

| # | Action | Priority |
|---|--------|----------|
| 15 | Auto-sync Wiki pages to Obsidian Vault | 🟢 Low |
| 16 | Continuous document monitoring (new versions) | 🟢 Low |
| 17 | Automated competitive analysis updates | 🟢 Low |
| 18 | Integration with sangfor-mcp-workflow intelligence pipeline | 🟢 Low |

## 8. Verification Checklist (Stage 10)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | 지정 폴더를 전체 스캔했는가? | ✅ | 147 files scanned, 151 entries in inventory |
| 2 | HCI 문서 인벤토리를 생성했는가? | ✅ | `hci_document_inventory.md` (296 lines) |
| 3 | LLM Wiki 입력 데이터 준비를 완료했는가? | ✅ | `hci_source_preparation.md` (132 lines) |
| 4 | 과도한 상세 ETL 정규화를 하지 않았는가? | ✅ | No raw_text/normalized_text/extracted_tables pipeline |
| 5 | 기존 DB/RAG/Knowledge Store 구조를 확인했는가? | ✅ | `rag-indexer.ts` + `scenario-db.ts` found and analyzed |
| 6 | 가능한 경우 Wiki 결과물을 DB/RAG에 적재했는가? | 🟡 | Structure designed, not yet populated (YAML files not written to disk) |
| 7 | LLM Wiki/OKF 방식으로 HCI 지식을 구조화했는가? | ✅ | 17 Wiki pages with bidirectional links |
| 8 | 오픈소스 조사 및 라이선스 검토를 수행했는가? | ✅ | `hci_open_source_research.md` (1,404 lines) |
| 9 | HCI 제품 구조를 정리했는가? | ✅ | `hci_product_summary.md` (267 lines) |
| 10 | HCI 데이터 흐름 프로세스를 작성했는가? | ✅ | `hci_data_flow_process.md` (1,225 lines, 12 flows) |
| 11 | 출처가 있는 내용과 출처 없는 내용을 분리했는가? | ✅ | `evidence_type` field + "문서 근거 없음" / "일반 HCI 아키텍처 기준" markers |
| 12 | 문서 근거 부족 항목을 별도 문서로 분리했는가? | ✅ | This document (`hci_open_issues.md`) |
| 13 | 최종 Markdown 산출물을 생성했는가? | ✅ | 8 files complete |

### Final Deliverables Status

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | `hci_document_inventory.md` | 296 | ✅ Complete |
| 2 | `hci_source_preparation.md` | 132 | ✅ Complete |
| 3 | `hci_knowledge_base_structure.md` | 371 | ✅ Complete |
| 4 | `hci_llm_wiki_index.md` | 368 | ✅ Complete |
| 5 | `hci_product_summary.md` | 267 | ✅ Complete |
| 6 | `hci_data_flow_process.md` | 1,225 | ✅ Complete (12 flows) |
| 7 | `hci_open_source_research.md` | 1,404 | ✅ Complete (delegated) |
| 8 | `hci_open_issues.md` | ~200 | ✅ Complete (this file) |

**Total**: ~4,263 lines across 8 deliverables
