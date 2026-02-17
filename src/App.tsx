import { useMemo, useState } from 'react'

import ControlBar from './components/ControlBar'
import DetailPanel from './components/DetailPanel'
import GraphCanvas from './components/GraphCanvas'
import edgesRaw from './data/edges.json'
import nodesRaw from './data/nodes.json'
import { filterGraph } from './lib/filterGraph'
import { assertValidGraphData } from './lib/validateGraphData'
import './styles/app.css'
import type { GameEdge, GameNode, GraphData } from './types/graph'

const graphData: GraphData = {
  nodes: nodesRaw as GameNode[],
  edges: edgesRaw as GameEdge[],
}

assertValidGraphData(graphData)

export default function App() {
  const [query, setQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const filteredGraph = useMemo(
    () =>
      filterGraph(graphData, {
        query,
      }),
    [query],
  )

  const effectiveSelectedNodeId =
    selectedNodeId && filteredGraph.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : null

  const nodeById = useMemo(
    () => new Map(graphData.nodes.map((node) => [node.id, node])),
    [],
  )

  const highlightedNodeIds = useMemo(() => {
    if (!effectiveSelectedNodeId) {
      return new Set<string>()
    }

    const next = new Set<string>([effectiveSelectedNodeId])
    for (const edge of filteredGraph.edges) {
      if (edge.source === effectiveSelectedNodeId) {
        next.add(edge.target)
      }
      if (edge.target === effectiveSelectedNodeId) {
        next.add(edge.source)
      }
    }
    return next
  }, [filteredGraph.edges, effectiveSelectedNodeId])

  const selectedNode = useMemo(
    () => filteredGraph.nodes.find((node) => node.id === effectiveSelectedNodeId) ?? null,
    [filteredGraph.nodes, effectiveSelectedNodeId],
  )

  const resetFilter = (): void => {
    setQuery('')
    setSelectedNodeId(null)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Interactive Game Lineage</p>
          <h1>게임 계보 인터랙티브 그래프 V2</h1>
          <p className="subtitle">
            큰 이미지 노드를 중심으로 계보를 탐색하고, 모든 엣지 설명을 그래프 위에서 바로 확인하세요.
          </p>
        </div>
        <div className="stat-chip-wrap">
          <span className="stat-chip">노드 {filteredGraph.nodes.length}</span>
          <span className="stat-chip">엣지 {filteredGraph.edges.length}</span>
          <span className="stat-chip">전체 데이터 {graphData.nodes.length} / {graphData.edges.length}</span>
          {selectedNode ? <span className="stat-chip selected">선택 {selectedNode.displayTitle}</span> : null}
        </div>
      </header>

      <ControlBar query={query} onQueryChange={setQuery} onReset={resetFilter} />

      <main className="app-main">
        <section className="graph-panel" aria-label="게임 계보 그래프">
          <div className="graph-help">
            드래그로 이동, 휠로 확대/축소, 배경 클릭으로 선택 해제, 엣지 텍스트는 항상 표시
          </div>
          {filteredGraph.nodes.length === 0 ? (
            <div className="empty-state">
              <h2>검색 결과가 없습니다</h2>
              <p>검색어를 조정해 주세요.</p>
            </div>
          ) : (
            <GraphCanvas
              nodes={filteredGraph.nodes}
              edges={filteredGraph.edges}
              selectedNodeId={effectiveSelectedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              onNodeSelect={(nodeId) => setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))}
              onBackgroundClick={() => setSelectedNodeId(null)}
            />
          )}
        </section>

        <DetailPanel selectedNode={selectedNode} edges={filteredGraph.edges} nodeById={nodeById} />
      </main>
    </div>
  )
}
