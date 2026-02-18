# 2026-02-18 피드백 반영 목표/설계

## 최종 목표
게임 트리 그래프를 다음 기준으로 개편한다.

1. 시각/상호작용 품질 개선
- 썸네일 없는 노드는 장르 플레이스홀더 대신 게임명 텍스트 노드로 렌더링한다.
- 노드의 보이는 크기와 클릭 가능한 영역을 일치시킨다.
- 엣지 화살표 방향이 명확히 보이도록 대비/크기/위치를 개선한다.
- 엣지 라벨과 노드 타이틀의 겹침/가림을 줄여 가독성을 높인다.
- 모바일에서 노드 상세는 거의 전체 화면 팝업으로 노출한다.

2. 데이터 규칙 정비
- 엣지 텍스트는 영향 요소(명사구)만 표시한다.
- 엣지 상세 문장(`summaryFull`)은 제거하고 `summaryShort` 단일 필드로 운영한다.
- `same_series_exception` 엣지는 제거한다.
- `확장|진화|정교화|후속작` 근거/설명은 비허용으로 제거한다.
- 기본 그래프에는 유효 엣지 참여 노드만 표시한다(전체 수집 데이터는 파일에 유지).
- 모든 게임 summary는 "영향 + 개척" 짧은 템플릿으로 재작성한다.

## 성공 기준
- UI
  - 노드 히트영역이 시각 반경과 일치한다.
  - 화살표 방향 인지가 쉬워진다.
  - 엣지 라벨/노드 타이틀 겹침이 이전 대비 현저히 감소한다.
  - 모바일에서 노드 클릭 시 `role="dialog"` 상세 팝업이 열린다.
- 데이터
  - `edges.json`에서 `summaryFull`이 제거된다.
  - `reviewMode`는 `internal_reviewed`만 남는다.
  - 비허용 키워드/예외 사유 엣지가 제거된다.
  - 기본 그래프 노드는 유효 엣지 endpoint 집합으로 제한된다.
  - `nodes.json` summary가 템플릿으로 갱신된다.
- 품질
  - lint/test/build 통과.
  - README 및 연구 문서가 변경된 규칙과 일치.

## 구현 단계
1. 데이터 정제 스크립트 추가
- `scripts/curate-graph-data.mjs`
  - `same_series_exception` 제거
  - `확장|진화|정교화|후속작` 키워드 포함 엣지 제거
  - `summaryFull` 제거
  - 결과 저장 + 통계 출력

2. 노드 summary 재작성 스크립트 추가
- `scripts/rebuild-node-summaries.mjs`
  - 템플릿: `영향: {대표 선행 게임}의 {영향 요소}. 개척: {대표 후행 영향 요소}.`
  - 엣지 없는 노드는 고정 최소 문구

3. 타입/검증 규칙 변경
- `src/types/graph.ts`
  - `GameEdge.summaryFull` 제거
  - `GameEdge.reviewMode`를 `internal_reviewed` 단일값으로 축소
- `src/lib/validateGraphData.ts`
  - `summaryFull` 검증 제거
  - `same_series_exception` 검증 제거
  - 비허용 키워드 검증 추가

4. 표시 데이터 파이프라인 추가
- `src/lib/buildVisibleGraph.ts`
  - 유효 엣지 endpoint 노드만 기본 표시 데이터로 생성
- `src/App.tsx`
  - `buildVisibleGraph(graphData)`를 필터 입력으로 사용

5. 그래프 렌더링 개선
- `src/components/GraphCanvas.tsx`
  - fallback/이미지 실패 시 텍스트 노드 렌더링
  - `nodePointerAreaPaint`로 히트영역 정합
  - 화살표 길이/대비/위치 조정
  - `onRenderFramePost`에서 노드 타이틀 + 엣지 라벨 최상단 렌더
  - 라벨 충돌 회피 배치 적용

6. 상세 패널 모바일 팝업화
- `src/App.tsx`, `src/components/DetailPanel.tsx`, `src/styles/app.css`
  - 모바일(860px 이하) 선택 노드 상세를 오버레이 다이얼로그로 렌더
  - 딤 배경/닫기 버튼/배경 클릭 닫기/ESC 닫기/바디 스크롤 잠금

7. 테스트 보강
- `src/lib/validateGraphData.test.ts`
- `src/lib/filterGraph.test.ts`
- `src/lib/buildVisibleGraph.test.ts` (신규)
- `src/App.test.tsx` (모바일 팝업 + 요소형 엣지 텍스트)

8. 문서 동기화
- `README.md`
- `docs/research/relation-taxonomy.md`
- `docs/research/edge-review-log.md` (아카이브 상태 명시)
- 본 문서의 진행/결과 업데이트

## 문서 기준 충돌(사전 확인)
- `README.md`
  - 현재 `summaryFull` 상세 설명 상시 노출을 주요 기능으로 안내 중
  - `same_series_exception` 검수 체계를 전제로 한 설명 존재
- `docs/research/relation-taxonomy.md`
  - `summaryFull` 운영 원칙이 포함되어 신규 정책과 충돌
  - 동일 시리즈 예외 허용 정책 포함
- `docs/research/edge-review-log.md`
  - 동일 시리즈 예외를 허용하는 근거 문서로 운영 중

## 의사결정 고정값
- 모바일 breakpoint: `max-width: 860px`
- 엣지 표시 필드: `summaryShort` 단일 사용
- 비허용 판정: `reviewMode` + 금지 키워드 규칙
- 노드 summary 생성 방식: 템플릿 자동 생성 우선

## 진행 상태
- [x] 문서 선행 작성
- [x] 코드/데이터 수정
- [x] 테스트 실행
- [x] 문서 동기화 최종 반영

## 구현 결과 (2026-02-18)
- 데이터
  - `src/data/edges.json`: 135 -> 113
  - `summaryFull` 제거 완료
  - `reviewMode`: `internal_reviewed`만 유지
  - 금지 키워드/동일 시리즈 예외 기준으로 22개 엣지 제거
  - `src/data/nodes.json`: 112개 노드 summary를 자연어 스타일(장르 특징 + 선행 영향 + 후행 기여)로 갱신 완료
  - 기본 표시 노드: 102개(전체 수집 112개는 파일에 유지)
- UI
  - fallback/이미지 실패 노드 텍스트 렌더링 적용
  - `nodePointerAreaPaint` 기반 히트영역 정합 적용
  - 화살표 길이/색 대비/위치 조정 적용
  - `onRenderFramePost` 기반 노드 타이틀/엣지 요소 라벨 상단 렌더 적용
  - 라벨 충돌 회피 배치 적용
  - 모바일 상세 오버레이 다이얼로그(딤/닫기/ESC/스크롤 잠금) 적용
- 테스트/검증
  - `npm run lint` 통과
  - `npm run test:run` 통과 (14 passed)
  - `npm run build` 통과

## 잔여 메모
- 번들 사이즈 경고(`dist/assets/index-*.js` > 500 kB)는 기능 요구사항 범위 밖으로 유지했다.
