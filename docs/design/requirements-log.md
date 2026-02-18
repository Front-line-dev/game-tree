# Requirements Log

사용자 요청과 운영 제약을 장기/단기로 분류해 기록하고, 결과 수치와 동기화한 문서다.

## Baseline Snapshot

- date: 2026-02-18
- nodes: 112
- edges: 113
- maxNodeId: g112
- maxEdgeId: e135

## Structured Requirements

| req_id | category | source | statement | status | reconciled_at |
| --- | --- | --- | --- | --- | --- |
| LT-001 | long_term_goal | AGENTS.md | 트래킹 파일에 사용자 절대경로를 남기지 않는다. | completed | 2026-02-18 |
| LT-002 | long_term_goal | AGENTS.md | `.DS_Store` 파일을 커밋/추적하지 않는다. | completed | 2026-02-18 |
| LT-003 | long_term_goal | AGENTS.md | 커밋/푸시 전 개인 경로와 `.DS_Store` 누수를 재검사한다. | completed | 2026-02-18 |
| LT-004 | long_term_goal | AGENTS.md | 사용자 요구사항은 장기/단기로 분류해 구조화 문서에 기록한다. | completed | 2026-02-18 |
| LT-005 | long_term_goal | AGENTS.md | 작업 완료 후 문서를 실제 결과와 reconcile한다. | completed | 2026-02-18 |
| ST-001 | short_term_task | User request | 후보 100개를 `docs/research/candidate-games.json`에 등록한다. | completed | 2026-02-18 |
| ST-002 | short_term_task | User request | 후보 스키마(`candidateId/title/status/sources/...`)를 유지한다. | completed | 2026-02-18 |
| ST-003 | short_term_task | User request | 후보 상태를 accepted/pending/rejected로 판정한다. | completed | 2026-02-18 |
| ST-004 | short_term_task | User request | 채택 노드만 `g113+`으로 `nodes.json`에 추가한다. | completed | 2026-02-18 |
| ST-005 | short_term_task | User request | 채택 노드는 최소 1개 이상 채택 엣지와 연결한다. | completed | 2026-02-18 |
| ST-006 | short_term_task | User request | 채택 엣지를 `e136+`으로 추가하고 규칙(명사구/금지어)을 준수한다. | completed | 2026-02-18 |
| ST-007 | short_term_task | User request | `analysisRef`와 `edge-evidence` 앵커를 1:1 동기화한다. | completed | 2026-02-18 |
| ST-008 | short_term_task | User request | 출처/요약/이미지 재생성 스크립트를 실행한다. | completed | 2026-02-18 |
| ST-009 | short_term_task | User request | `verify:research`, `lint`, `test:run`, `build`를 통과시킨다. | completed | 2026-02-18 |
| ST-010 | short_term_task | User request | 최종 누수 검사(`.DS_Store`, 개인 경로) 결과를 기록한다. | completed | 2026-02-18 |
| ST-011 | short_term_task | User request | 제외 후보(`pending/rejected`) 전수를 다시 조사/분석한다. | completed | 2026-02-18 |
| ST-012 | short_term_task | User request | source가 부족한 항목은 직접 재검색으로 후보 출처를 보강한다. | completed | 2026-02-18 |
| ST-013 | short_term_task | User request | 제외 사유를 게임별 결손 근거 중심으로 다시 작성한다. | completed | 2026-02-18 |
| ST-014 | short_term_task | User request | accepted 판정은 source 개수 기준이 아니라 근거 품질 기준으로 평가한다. | completed | 2026-02-18 |
| ST-015 | short_term_task | User request | accepted 3트랙 기준을 문서에 반영한다. | completed | 2026-02-18 |
| ST-016 | short_term_task | User request | 현재 저장된 모든 게임(노드)을 3트랙 기준으로 전수 재검토한다. | completed | 2026-02-18 |
| ST-017 | short_term_task | User request | 이미지 동기화 시 검토 통과 이미지 재다운로드를 방지한다. | completed | 2026-02-18 |
| ST-018 | short_term_task | User request | 화면 강제 zoom/center 이동 로직을 제거한다. | completed | 2026-02-18 |
| ST-019 | short_term_task | User request | 줌 범위를 `0.5~3.0`으로 고정해 과도한 확대/축소를 제한한다. | completed | 2026-02-18 |
| ST-020 | short_term_task | User request | 디자인 모드에서 노드를 드래그해 위치를 조정할 수 있어야 한다. | completed | 2026-02-18 |
| ST-021 | short_term_task | User request | 노드 좌표 + viewport 상태를 JSON 파일로 내보낼 수 있어야 한다. | completed | 2026-02-18 |
| ST-022 | short_term_task | User request | 내보낸 레이아웃 파일을 빌드 입력(`src/data/graph-layout.json`)으로 적용할 수 있어야 한다. | completed | 2026-02-18 |
| ST-023 | short_term_task | User request | 현재 파일 + 커밋 히스토리를 분석해 GitHub 공개 가능 여부를 점검한다(다운로드 이미지는 적합하다고 가정). | completed | 2026-02-18 |
| ST-024 | short_term_task | User request | 공개 전 산출물 정리: `.playwright-cli`/`output` 추적 파일 제거 + `.gitignore` 재유입 방지 규칙 추가. | completed | 2026-02-18 |

## Outcome Snapshot

- candidate_total: 100
- candidate_status.accepted: 20
- candidate_status.pending: 75
- candidate_status.rejected: 5
- added_nodes: 20
- added_edges: 20
- final_nodes_after_regeneration: 132
- final_edges_after_regeneration: 133
- stored_nodes_recheck_total: 132
- stored_nodes_recheck_status.accepted: 22
- stored_nodes_recheck_status.pending: 110
- stored_nodes_recheck_basis.candidate_dossier: 20
- stored_nodes_recheck_basis.legacy_graph_audit: 102
- stored_nodes_recheck_basis.legacy_graph_audit_isolated: 10
- image_sync_result: pass1(downloaded=9, kept=105, fallback=18), pass2(downloaded=3, kept=114, fallback=15)
- exclusion_reassessment: 80 candidates re-reviewed (web re-search + reason rewrite)
- acceptance_criterion_note: quality-first (directionality/anchor/mechanic/direct-quote), not source-count based
- camera_forcing_removed: initial_fit / onEngineStop_fit / node_click_center_zoom removed
- zoom_bounds: min=0.5, max=3.0
- design_mode: enabled (node drag + layout state sync)
- layout_export_payload: version, nodes(x/y), viewport(x/y/k), meta(exportedAt,nodeCount)
- layout_apply_workflow: `npm run layout:apply -- <exported-layout.json>`
- quality_checks: verify(0 warning/0 error), lint(pass), test(19 pass), build(pass), layout:apply(pass)
- leak_checks: .DS_Store(0), personal_path_matches(0), history_last50(.DS_Store=0, personal_path=0)
- public_release_audit: tracked_files/commit_history scanned, secret_patterns(0), author_email_exposure(commits=6), generated_playwright_artifacts(removed=20, remaining_tracked=0)
- reconciled_at: 2026-02-18
