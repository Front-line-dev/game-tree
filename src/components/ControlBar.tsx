interface ControlBarProps {
  query: string
  onQueryChange: (value: string) => void
  onReset: () => void
}

export default function ControlBar({ query, onQueryChange, onReset }: ControlBarProps) {
  return (
    <section className="control-bar" aria-label="그래프 탐색 컨트롤">
      <div className="control-search-wrap">
        <label htmlFor="game-query" className="control-label">
          게임 검색
        </label>
        <input
          id="game-query"
          className="search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="게임명 검색 (통용명/원문)"
        />
      </div>

      <button type="button" className="reset-button" onClick={onReset}>
        검색 초기화
      </button>
    </section>
  )
}
