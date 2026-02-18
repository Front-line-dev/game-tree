import { useEffect, useMemo, useState } from 'react'

import ControlBar from './components/ControlBar'
import DetailPanel from './components/DetailPanel'
import GraphCanvas from './components/GraphCanvas'
import edgesRaw from './data/edges.json'
import graphLayoutRaw from './data/graph-layout.json'
import nodesRaw from './data/nodes.json'
import { buildVisibleGraph } from './lib/buildVisibleGraph'
import { filterGraph } from './lib/filterGraph'
import { validateGraphLayout } from './lib/validateGraphLayout'
import { assertValidGraphData } from './lib/validateGraphData'
import './styles/app.css'
import type { GameEdge, GameNode, GraphData, GraphLayout } from './types/graph'

const MOBILE_BREAKPOINT = 860

const graphData: GraphData = {
  nodes: nodesRaw as GameNode[],
  edges: edgesRaw as GameEdge[],
}
const graphNodeIdSet = new Set(graphData.nodes.map((node) => node.id))

assertValidGraphData(graphData)

export default function App() {
  const [query, setQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [designModeEnabled, setDesignModeEnabled] = useState(false)
  const [layout, setLayout] = useState<GraphLayout>(() => {
    const result = validateGraphLayout(graphLayoutRaw, graphNodeIdSet)
    if (!result.isValid) {
      console.warn(`[graph-layout] invalid layout data, normalization applied:\n${result.errors.join('\n')}`)
    }
    return result.layout
  })
  const [viewportWidth, setViewportWidth] = useState<number>(() => window.innerWidth)

  const isMobile = viewportWidth <= MOBILE_BREAKPOINT

  useEffect(() => {
    const updateViewportWidth = (): void => {
      const nextWidth = Math.round(window.visualViewport?.width ?? window.innerWidth)
      setViewportWidth(nextWidth)
    }

    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    window.addEventListener('orientationchange', updateViewportWidth)
    window.visualViewport?.addEventListener('resize', updateViewportWidth)

    return () => {
      window.removeEventListener('resize', updateViewportWidth)
      window.removeEventListener('orientationchange', updateViewportWidth)
      window.visualViewport?.removeEventListener('resize', updateViewportWidth)
    }
  }, [])

  const visibleBaseGraph = useMemo(() => buildVisibleGraph(graphData), [])

  const filteredGraph = useMemo(
    () =>
      filterGraph(visibleBaseGraph, {
        query,
      }),
    [visibleBaseGraph, query],
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

  useEffect(() => {
    if (!isMobile || !selectedNode) {
      document.body.classList.remove('modal-open')
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSelectedNodeId(null)
      }
    }

    document.body.classList.add('modal-open')
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [isMobile, selectedNode])

  const resetFilter = (): void => {
    setQuery('')
    setSelectedNodeId(null)
  }

  const closeDetailPanel = (): void => {
    setSelectedNodeId(null)
  }

  const exportLayout = (): void => {
    const payload: GraphLayout = {
      version: 1,
      nodes: layout.nodes,
      viewport: layout.viewport,
      meta: {
        exportedAt: new Date().toISOString(),
        nodeCount: Object.keys(layout.nodes).length,
      },
    }

    const fileContent = `${JSON.stringify(payload, null, 2)}\n`
    const blob = new Blob([fileContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    anchor.href = url
    anchor.download = `graph-layout-${timestamp}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Interactive Game Lineage</p>
          <h1>게임 계보 인터랙티브 그래프 V2</h1>
          <p className="demo-notice" role="note">
            이 페이지는 AI로 자동생성된 페이지이며 실제 데이터가 아닌 데모 페이지입니다.
          </p>
          <p className="subtitle">
            핵심 게임 노드와 영향 요소를 중심으로 계보를 탐색하세요.
          </p>
        </div>
        <div className="stat-chip-wrap">
          <span className="stat-chip">노드 {filteredGraph.nodes.length}</span>
          <span className="stat-chip">엣지 {filteredGraph.edges.length}</span>
          <span className="stat-chip">기본 표시 {visibleBaseGraph.nodes.length} / {visibleBaseGraph.edges.length}</span>
          <span className="stat-chip">전체 데이터 {graphData.nodes.length} / {graphData.edges.length}</span>
          {selectedNode ? <span className="stat-chip selected">선택 {selectedNode.displayTitle}</span> : null}
        </div>
      </header>

      <ControlBar
        query={query}
        onQueryChange={setQuery}
        onReset={resetFilter}
        designModeEnabled={designModeEnabled}
        onDesignModeToggle={() => setDesignModeEnabled((prev) => !prev)}
        onExportLayout={exportLayout}
      />

      <main className="app-main">
        <section className="graph-panel" aria-label="게임 계보 그래프">
          <div className="graph-help">
            {designModeEnabled
              ? '디자인 모드: 노드 드래그 배치 + 내보내기'
              : '드래그 이동, 휠 확대/축소, 배경 클릭 선택 해제'}
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
              isMobile={isMobile}
              designModeEnabled={designModeEnabled}
              layout={layout}
              selectedNodeId={effectiveSelectedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              onNodeSelect={(nodeId) => setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))}
              onBackgroundClick={() => setSelectedNodeId(null)}
              onLayoutChange={(nextLayout) => setLayout(nextLayout)}
            />
          )}
        </section>

        {!isMobile ? (
          <DetailPanel selectedNode={selectedNode} edges={filteredGraph.edges} nodeById={nodeById} />
        ) : null}
      </main>

      {isMobile && selectedNode ? (
        <div className="detail-modal-backdrop" onClick={closeDetailPanel}>
          <div className="detail-modal" onClick={(event) => event.stopPropagation()}>
            <DetailPanel
              selectedNode={selectedNode}
              edges={filteredGraph.edges}
              nodeById={nodeById}
              isModal
              onClose={closeDetailPanel}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
