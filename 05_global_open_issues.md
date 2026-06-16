# 글로벌 Open Issues
> **Last Updated**: 2026-06-16 03:57 KST

## 1. 문서 부족 제품
| 제품 | 상태 | 설명 |
|------|------|------|
| NGAF | EOL (2025-01-15) | User Manual 없음. Feature List만 보유. NSF로 마이그레이션 필요 |
| SASE | 문서 부족 | Slide만 보유. User Manual/API 문서 없음 |
| Cyber Command | 문서 부족 | Datasheet/Slides만 보유. User Manual 없음 |
| EPP | 문서 부족 | 제품 폴더에 문서 거의 없음 |
| SCP | 문서 부족 | Feature List만 보유 |

## 2. NGAF EOL 이슈
- 전 하드웨어 모델 EOL (2025-01-15)
- NSF(Network Secure) v8.0.95로 마이그레이션 필요
- 정책 마이그레이션 자동화 도구 확인 필요

## 3. 제품별 확인 필요 항목
| 제품 | 항목 | 수 |
|------|------|---|
| SKE | etcd 백업, GPU 지원, 최신 버전 | 8 |
| hDR | RPO/RTO, 대역폭, 최신 버전 | 6 |
| NGAF | NSF 마이그레이션, 성능 벤치마크 | 4 |
| SASE | POP, 프로토콜, 라이선스 | 10 |
| Cyber Command | STA 배포, API, 백업 | 8 |
| VDI | HA, API, DR, HDP 스펙 | 7 |
| IAG | API, DR, 최신 버전 | 5 |

## 4. RAG 인덱스 적재 현황
- 적재 완료: 36 파일, 168 chunks, 125,648 lines
- 미적재: EPP, SCP, SDWAN, aStor, Network Secure, Company (문서 없음)

## 5. 다음 작업
1. NGAF/SASE/Cyber Command User Manual 추가 확보
2. SKE/hDR 최신 버전 문서 확보
3. NSF 마이그레이션 가이드 상세화
4. Wiki 페이지를 Obsidian/MkDocs로 마이그레이션
