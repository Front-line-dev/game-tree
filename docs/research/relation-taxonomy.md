# 엣지 설명 기준 (V2)

## 변경 이력
- V1: 관계 타입(`relationType`) 기반 분류.
- V2: 관계 타입을 제거하고, 각 엣지의 설명 텍스트(`summaryShort`, `summaryFull`)를 단일 기준으로 사용.

## V2 운영 원칙
- 방향성은 `영향 준 작품 -> 영향 받은 작품`으로 고정한다.
- `summaryShort`는 그래프 상시 라벨용으로 14자 내외(검증 최대 20자)로 유지한다.
- `summaryFull`은 노드 선택 시 전체 맥락을 보여주는 1~2문장 설명으로 작성한다.
- 단순 연대기/후속작 연결은 제거한다.
- 동일 시리즈 연결은 기본 제거하고, 예외만 `reviewMode=same_series_exception`으로 허용한다.
- 동일 시리즈 예외는 `docs/research/edge-review-log.md`에 검수 기록이 있어야 한다.

## 관련 문서
- 엣지 근거 모음: `docs/research/edge-evidence.md`
- 동일 시리즈 예외 검수: `docs/research/edge-review-log.md`
- 제목 표기 기준: `docs/research/title-style-guide.md`
