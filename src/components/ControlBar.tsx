interface ControlBarProps {
  query: string
  onQueryChange: (value: string) => void
  onReset: () => void
  designModeEnabled: boolean
  onDesignModeToggle: () => void
  onExportLayout: () => void
}

export default function ControlBar({
  query,
  onQueryChange,
  onReset,
  designModeEnabled,
  onDesignModeToggle,
  onExportLayout,
}: ControlBarProps) {
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

      <div className="control-actions">
        <button type="button" className="design-mode-button" onClick={onDesignModeToggle}>
          {designModeEnabled ? '디자인 모드 끄기' : '디자인 모드 켜기'}
        </button>
        <button
          type="button"
          className="export-layout-button"
          onClick={onExportLayout}
          disabled={!designModeEnabled}
        >
          레이아웃 내보내기
        </button>
        <button type="button" className="reset-button" onClick={onReset}>
          검색 초기화
        </button>
      </div>
    </section>
  )
}
