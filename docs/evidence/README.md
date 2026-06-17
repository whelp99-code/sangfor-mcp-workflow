# Evidence Directory

이 디렉토리에는 실행 후 검증 결과와 evidence 보고서가 저장됩니다.

- `postcheck_*.json`: Post-check 검증 결과 (PostVerifier)
- `evidence_*.md`: 실행 evidence Markdown 보고서 (EvidenceWriter)

## 상태 표기

- `dry-run`: 실제 변경을 수행하지 않은 실행 기록
- `real-run`: 승인된 변경 실행 기록
- `rollback-simulated`: 롤백 dry-run 시뮬레이션 기록
- `rollback-executed`: 롤백 execute 수행 기록
