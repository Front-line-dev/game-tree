# Game Tree V2

게임 간 영향 관계를 탐색하는 인터랙티브 그래프 웹앱입니다.

## 주요 기능
- 100개 이상 노드 + 120개 이상 엣지 데이터셋
- 대표 이미지 기반 대형 원형 노드(기본 72px) 렌더링
- 방향성 엣지(영향 준 쪽 -> 영향 받은 쪽)와 굵은 링크 표시
- 엣지 요약 텍스트(`summaryShort`) 상시 표시
- 노드 선택 시 연결 엣지의 상세 설명(`summaryFull`) 전체 표시
- 검색(통용명/원문) + 초기화 컨트롤
- 데이터 스키마 검증(`zod` + 동일 시리즈 예외 검수 규칙)

## 실행
```bash
npm install
npm run dev
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
- 이미지: `public/images/nodes/*`, `public/images/fallback/*`
- 출처 목록: `docs/research/sources.md`
- 엣지 근거: `docs/research/edge-evidence.md`
- 동일 시리즈 예외 검수 로그: `docs/research/edge-review-log.md`
- 제목 표기 가이드: `docs/research/title-style-guide.md`
