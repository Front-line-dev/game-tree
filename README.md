# Game Tree V2

게임 간 영향 관계를 탐색하는 인터랙티브 그래프 웹앱입니다.

## 주요 기능
- 전체 수집 데이터(노드 112, 엣지 113)와 기본 표시 데이터(유효 엣지 참여 노드만) 분리 운영
- 대표 이미지 노드 + 썸네일 부재 시 게임명 텍스트 노드 렌더링
- 방향성 엣지 화살표(영향 준 쪽 -> 영향 받은 쪽) 및 요소 라벨(`summaryShort`) 상시 표시
- 노드 타이틀/엣지 라벨 충돌 회피 렌더링
- 게임 상세 요약을 자연어 스타일(장르 특징 + 선행 영향 + 후행 기여)로 자동 생성
- 모바일(860px 이하) 노드 상세 오버레이 다이얼로그
- 검색(통용명/원문) + 초기화 컨트롤
- 데이터 스키마 검증(`zod`, 단일 reviewMode + 금지 키워드 규칙)

## 실행
```bash
npm install
npm run dev
```

## 데이터 정비 스크립트
```bash
# 엣지 정제 (same_series_exception, 금지 키워드 제거 + summaryFull 제거)
npm run curate:graph

# 노드 summary 템플릿 재생성
npm run rebuild:summaries
```

## 이미지 동기화
Wikimedia 기반 자동 이미지 수집 스크립트를 제공합니다.

```bash
# 수집 결과 미반영 검증
npm run sync:images:dry

# 실제 다운로드 + nodes.json imagePath 갱신
npm run sync:images
```

## 테스트
```bash
npm run lint
npm run test:run
```

## 빌드
```bash
npm run build
```

`vite.config.ts`의 `base: './'` 설정으로 `dist/index.html` 자산 경로는 상대 경로로 생성됩니다.

## 데이터/문서
- 노드: `src/data/nodes.json`
- 엣지: `src/data/edges.json`
- 기본 표시 노드 산출 로직: `src/lib/buildVisibleGraph.ts`
- 이미지: `public/images/nodes/*`, `public/images/fallback/*`
- 출처 목록: `docs/research/sources.md`
- 엣지 근거: `docs/research/edge-evidence.md`
- 아카이브된 동일 시리즈 예외 로그: `docs/research/edge-review-log.md`
- 엣지 규칙: `docs/research/relation-taxonomy.md`
- 목표/설계 문서: `docs/design/2026-02-18-feedback-goal.md`
