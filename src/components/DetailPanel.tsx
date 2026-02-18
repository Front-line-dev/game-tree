import type { GameEdge, GameNode } from '../types/graph'

interface DetailPanelProps {
  selectedNode: GameNode | null
  edges: GameEdge[]
  nodeById: Map<string, GameNode>
  isModal?: boolean
  onClose?: () => void
}

function renderEdgeLine(
  edge: GameEdge,
  directionLabel: string,
  counterPartyTitle: string,
) {
  return (
    <li key={edge.id} className="evidence-item">
      <p className="evidence-line">
        <strong>{directionLabel}</strong> {counterPartyTitle}
      </p>
      <p className="evidence-line">요소: {edge.summaryShort}</p>
      <a href={edge.evidenceUrl} target="_blank" rel="noreferrer" className="evidence-link">
        {edge.evidenceTitle}
      </a>
    </li>
  )
}

export default function DetailPanel({
  selectedNode,
  edges,
  nodeById,
  isModal = false,
  onClose,
}: DetailPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="detail-panel" aria-live="polite">
        <h2>게임 상세</h2>
        <p className="detail-empty">노드를 클릭하면 연결된 영향 요소와 근거를 볼 수 있습니다.</p>
      </aside>
    )
  }

  const outgoing = edges.filter((edge) => edge.source === selectedNode.id)
  const incoming = edges.filter((edge) => edge.target === selectedNode.id)

  const panelClassName = isModal ? 'detail-panel detail-panel-modal' : 'detail-panel'
  const Wrapper = isModal ? 'section' : 'aside'

  return (
    <Wrapper
      className={panelClassName}
      aria-live="polite"
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal || undefined}
      aria-label={isModal ? `${selectedNode.displayTitle} 상세 정보` : undefined}
    >
      <div className="detail-panel-header-row">
        <h2>게임 상세</h2>
        {isModal ? (
          <button type="button" className="detail-close-button" onClick={onClose} aria-label="상세 닫기">
            닫기
          </button>
        ) : null}
      </div>
      <section className="detail-card">
        <h3>
          {selectedNode.displayTitle}
          <span className="detail-subtitle">{selectedNode.titleOriginal}</span>
        </h3>
        <dl>
          <div>
            <dt>출시연도</dt>
            <dd>{selectedNode.releaseYear}</dd>
          </div>
          <div>
            <dt>플랫폼</dt>
            <dd>{selectedNode.platforms.join(', ')}</dd>
          </div>
          <div>
            <dt>장르군</dt>
            <dd>{selectedNode.genreGroup}</dd>
          </div>
        </dl>
        <p className="detail-summary">{selectedNode.summary}</p>
      </section>

      <section className="detail-card">
        <h3>연결 엣지 요소</h3>
        {outgoing.length === 0 && incoming.length === 0 ? (
          <p className="detail-empty">현재 표시 가능한 연결이 없습니다.</p>
        ) : (
          <ul className="evidence-list">
            {outgoing.map((edge) => {
              const target = nodeById.get(edge.target)
              return renderEdgeLine(edge, '영향 줌 →', target?.displayTitle ?? edge.target)
            })}
            {incoming.map((edge) => {
              const source = nodeById.get(edge.source)
              return renderEdgeLine(edge, '영향 받음 ←', source?.displayTitle ?? edge.source)
            })}
          </ul>
        )}
      </section>
    </Wrapper>
  )
}
