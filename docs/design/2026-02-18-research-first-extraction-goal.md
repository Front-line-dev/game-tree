# 2026-02-18 연구 우선 데이터 추출 재정의 목표/설계

## 최종 목표
- 노드/엣지 수량 확대를 목표로 두지 않는다.
- 실제 영향 관계가 성립하는 데이터만 채택한다.
- 관계 근거 강도와 타당성 평가를 우선하고, 약한 관계는 추가하지 않거나 기존 데이터에서도 제외한다.
- 이미지 품질보다 정확도를 우선해, 확신이 낮으면 자동 fallback 처리한다.

## 실행 원칙
1. 문서 정책 선반영
- 수량 고정/증가를 목표로 삼는 표현을 제거한다.
- 채택/보류/기각 기준을 문서로 명시한다.

2. 관계 추출
- 후보는 위키, 공식 문서, 인터뷰/포스트모템, 신뢰 가능한 게임 저널에서 수집한다.
- 후보마다 채택/보류/기각 판정을 기록한다.
- 채택 항목만 `src/data/edges.json`에 반영한다.

3. 이미지 적용
- 비게임/로고/아이콘/배너 성격 이미지는 제외한다.
- MIME-확장자 불일치를 방지한다.
- 종횡비/해상도/콘텐츠 힌트 기반 신뢰도를 계산한다.
- 확신이 낮으면 fallback으로 전환하고 감사 로그를 남긴다.

4. 텍스트 재작성
- 노드 summary는 혼합형 문체(핵심 요약 + 관계 맥락)로 갱신한다.
- 엣지 텍스트는 영향 요소 명사구 규칙을 유지한다.
- 근거 문서는 채택 관계 중심으로 정리한다.

## 수용 기준
- 정책 문서/README/연구 문서에서 수량 목표 표현이 제거되어 있다.
- 관계 데이터는 근거 기반 판정 원칙(채택/보류/기각)을 따른다.
- 이미지 동기화 결과에서 저신뢰 후보가 자동 fallback 처리된다.
- 이미지 감사 로그가 생성된다.
- `npm run lint`, `npm run test:run`, `npm run build`가 통과한다.

## 구현 단계
1. 문서 반영
- `README.md`
- `docs/research/relation-taxonomy.md`
- `docs/research/extraction-policy.md` (신규)
- `docs/research/image-audit.md` (신규)

2. 스크립트 반영
- `scripts/sync-wikimedia-images.mjs` 개선
- 관계 근거 무결성 검증 스크립트 추가

3. 데이터 갱신
- 이미지 동기화 실행 후 `nodes.json` imagePath 갱신
- 노드 summary 재생성
- 근거 문서/출처 문서 정리

4. 검증
- 관계 무결성 검사
- lint/test/build

## 진행 상태
- [x] 목표/설계 문서 선행 작성
- [x] 문서 정책 반영
- [x] 이미지 스크립트 개선
- [x] 관계 무결성 검증 도구 추가
- [x] 데이터/텍스트 갱신
- [x] lint/test/build 검증

## 구현 결과 (2026-02-18)
- 문서
  - `README.md`, `docs/research/relation-taxonomy.md`, `docs/design/2026-02-18-feedback-goal.md`에 연구 우선/수량 비목표 정책을 반영했다.
  - `docs/research/extraction-policy.md`를 신규 추가했다.
  - `docs/research/edge-evidence.md`를 채택 엣지 1:1 anchor 기준으로 정리했다.
  - `docs/research/sources.md`를 실제 사용 출처 재생성 방식으로 전환했다.
- 스크립트
  - `scripts/sync-wikimedia-images.mjs`에 엄격 이미지 판정(로고/변형판/연도/제목 정합성/형식 검증/fallback)을 반영했다.
  - 기본 동작을 증분 모드로 전환해 검증 통과 이미지는 재다운로드하지 않고 재사용(`kept`)하도록 변경했다.
  - 전체 재검증이 필요할 때만 `--refresh-all` 옵션으로 강제 재처리하도록 지원했다.
  - `scripts/verify-research-integrity.mjs`를 추가해 엣지-근거-출처 무결성 검증을 자동화했다.
  - `scripts/rebuild-research-sources.mjs`를 추가해 실제 사용 출처 문서를 재생성하도록 했다.
  - `scripts/rebuild-node-summaries.mjs`를 혼합형 문체(핵심 요약 + 관계 맥락)로 조정했다.
- 데이터
  - 최신 이미지 동기화 결과: `downloaded=96`, `fallback=16` (노드 총 112).
  - 증분 재실행 검증 결과: `downloaded=7`, `kept=89`, `fallback=16`.
  - `src/data/nodes.json`의 `imagePath`와 `summary`를 현재 정책 기준으로 갱신했다.
  - 이미지 감사 로그를 `docs/research/image-audit.md`, `docs/research/image-audit.json`에 기록했다.
- 검증
  - `npm run verify:research` 통과 (warnings 0, errors 0)
  - `npm run lint` 통과
  - `npm run test:run` 통과 (15 passed)
  - `npm run build` 통과

## 추가 작업 계획 (2026-02-18, 엣지 텍스트 정렬)
### 최종 목표
- 그래프에서 엣지 텍스트(`summaryShort`) 위치가 엣지 경로와 어긋나 보이는 문제를 줄인다.

### 단계
1. `src/components/GraphCanvas.tsx`의 라벨 좌표 계산을 force-graph 곡선 수식(제어점 기반)과 일치시킨다.
2. 엣지 곡선의 경로 중앙점(길이 기준) 좌표를 구해 라벨 중심을 정확히 일치시킨다.
3. 라벨 중앙 정렬 요구를 우선해 추가 nudge/밀어내기 보정은 적용하지 않는다.
4. `npm run lint`, `npm run test:run`, `npm run build`로 회귀를 확인한다.
