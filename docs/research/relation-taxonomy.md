# 엣지 설명 기준 (V3)

## 변경 이력
- V1: 관계 타입(`relationType`) 기반 분류.
- V2: 관계 타입 제거, `summaryShort` + `summaryFull` 이중 텍스트 운영.
- V3: `summaryShort` 단일 요소 라벨 체계로 통합.

## V3 운영 원칙
- 방향성은 `영향 준 작품 -> 영향 받은 작품`으로 고정한다.
- 엣지 표시 텍스트는 `summaryShort` 단일 필드만 사용한다.
- `summaryShort`는 문장이 아닌 영향 요소(명사구)로 작성한다.
  - 예시(금지): `종족 비대칭 운영 철학이 영웅 기반 RTS 설계에도 영향을 주었다.`
  - 예시(허용): `종족 비대칭 운영`
- 단순 연대기/후속작 연결은 제거한다.
- `same_series_exception`은 운영하지 않는다.
- `확장|진화|정교화|후속작` 근거는 비허용으로 제거한다.
- 엣지 근거는 게임 플레이 또는 핵심 컨셉 영향으로만 유지한다.

## 관련 문서
- 엣지 근거 모음: `docs/research/edge-evidence.md`
- 동일 시리즈 예외(아카이브): `docs/research/edge-review-log.md`
- 제목 표기 기준: `docs/research/title-style-guide.md`
