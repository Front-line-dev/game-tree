import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'

import type { GameEdge, GameNode } from '../types/graph'

interface GraphCanvasProps {
  nodes: GameNode[]
  edges: GameEdge[]
  selectedNodeId: string | null
  highlightedNodeIds: Set<string>
  onNodeSelect: (nodeId: string) => void
  onBackgroundClick: () => void
}

interface ForceNode extends GameNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
}

type ForceLink = Omit<GameEdge, 'source' | 'target'> & {
  source: string | ForceNode
  target: string | ForceNode
}

const NODE_RADIUS = 36
const NODE_RADIUS_SELECTED = 40
const BASE_LINK_COLOR = 'rgba(148, 163, 184, 0.78)'
const FADED_LINK_COLOR = 'rgba(148, 163, 184, 0.26)'

function readNodeId(value: string | ForceNode): string {
  return typeof value === 'string' ? value : value.id
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''

  for (const char of text) {
    const next = current + char
    if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
      current = next
      continue
    }

    lines.push(current)
    current = char
  }

  if (current.length > 0) {
    lines.push(current)
  }

  return lines
}

export default function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds,
  onNodeSelect,
  onBackgroundClick,
}: GraphCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [size, setSize] = useState({ width: 960, height: 680 })

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) {
      return undefined
    }

    const updateSize = (): void => {
      const nextWidth = Math.max(element.clientWidth, 380)
      const nextHeight = Math.max(element.clientHeight, 520)
      setSize({ width: nextWidth, height: nextHeight })
    }

    updateSize()

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null

    observer?.observe(element)
    window.addEventListener('resize', updateSize)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({ ...node })),
      links: edges.map((edge) => ({ ...edge })),
    }),
    [nodes, edges],
  )

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || graphData.nodes.length === 0) {
      return
    }

    const chargeForce = graph.d3Force('charge') as
      | { strength?: (value: number) => void }
      | undefined
    const linkForce = graph.d3Force('link') as
      | { distance?: (value: number) => void; strength?: (value: number) => void }
      | undefined

    chargeForce?.strength?.(-230)
    linkForce?.distance?.(165)
    linkForce?.strength?.(0.58)
    graph.d3ReheatSimulation()

    const timer = window.setTimeout(() => {
      graph.zoomToFit(420, 100)
    }, 120)

    return () => window.clearTimeout(timer)
  }, [graphData.nodes.length, graphData.links.length, size.width, size.height])

  return (
    <div ref={wrapperRef} className="graph-canvas-wrapper">
      <ForceGraph2D
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        enableNodeDrag={false}
        minZoom={0.38}
        maxZoom={7.5}
        backgroundColor="rgba(0,0,0,0)"
        linkDirectionalArrowLength={9}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.08}
        nodeRelSize={8}
        cooldownTicks={190}
        onNodeClick={(node) => {
          const typedNode = node as ForceNode
          onNodeSelect(typedNode.id)

          if (typeof typedNode.x === 'number' && typeof typedNode.y === 'number') {
            const graph = graphRef.current
            if (!graph) {
              return
            }

            graph.centerAt(typedNode.x, typedNode.y, 280)
            graph.zoom(Math.max(graph.zoom(), 1.3), 280)
          }
        }}
        onBackgroundClick={onBackgroundClick}
        nodeLabel={(node) => {
          const typed = node as ForceNode
          return `${typed.displayTitle} (${typed.titleOriginal})`
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const typed = node as ForceNode
          const x = typed.x ?? 0
          const y = typed.y ?? 0
          const isSelected = typed.id === selectedNodeId
          const isHighlighted = highlightedNodeIds.has(typed.id)
          const radius = isSelected ? NODE_RADIUS_SELECTED : NODE_RADIUS

          const cached = imageCacheRef.current.get(typed.imagePath)
          let image = cached
          if (!image) {
            image = new Image()
            image.src = typed.imagePath
            image.onload = () => {
              graphRef.current?.resumeAnimation()
            }
            imageCacheRef.current.set(typed.imagePath, image)
          }

          ctx.save()
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI)
          ctx.closePath()
          ctx.clip()

          if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
            const aspect = image.naturalWidth / image.naturalHeight
            const box = radius * 2

            if (aspect >= 1) {
              const drawWidth = box * aspect
              ctx.drawImage(image, x - drawWidth / 2, y - box / 2, drawWidth, box)
            } else {
              const drawHeight = box / aspect
              ctx.drawImage(image, x - box / 2, y - drawHeight / 2, box, drawHeight)
            }
          } else {
            ctx.fillStyle = '#334155'
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
          }

          ctx.restore()

          ctx.beginPath()
          ctx.arc(x, y, radius + 1.2, 0, 2 * Math.PI)
          ctx.strokeStyle = isSelected
            ? '#f97316'
            : isHighlighted
              ? '#38bdf8'
              : 'rgba(148, 163, 184, 0.9)'
          ctx.lineWidth = isSelected ? 4 : isHighlighted ? 3 : 2
          ctx.stroke()

          const fontSize = Math.max(4, Math.min(11, 10 / globalScale))
          ctx.font = `700 ${fontSize}px "Noto Sans KR", "Pretendard", sans-serif`
          ctx.fillStyle = '#e2e8f0'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(typed.displayTitle, x + radius + 6, y)
        }}
        linkColor={(link) => {
          const typed = link as ForceLink
          const sourceId = readNodeId(typed.source)
          const targetId = readNodeId(typed.target)

          if (!selectedNodeId) {
            return BASE_LINK_COLOR
          }

          return sourceId === selectedNodeId || targetId === selectedNodeId
            ? BASE_LINK_COLOR
            : FADED_LINK_COLOR
        }}
        linkWidth={(link) => {
          const typed = link as ForceLink
          const sourceId = readNodeId(typed.source)
          const targetId = readNodeId(typed.target)

          if (!selectedNodeId) {
            return 2.6
          }

          return sourceId === selectedNodeId || targetId === selectedNodeId ? 4 : 2.6
        }}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link, ctx, globalScale) => {
          const typed = link as ForceLink
          if (typeof typed.source === 'string' || typeof typed.target === 'string') {
            return
          }

          const startX = typed.source.x
          const startY = typed.source.y
          const endX = typed.target.x
          const endY = typed.target.y

          if (
            typeof startX !== 'number' ||
            typeof startY !== 'number' ||
            typeof endX !== 'number' ||
            typeof endY !== 'number'
          ) {
            return
          }

          const sourceId = typed.source.id
          const targetId = typed.target.id
          const isFocused =
            selectedNodeId !== null && (sourceId === selectedNodeId || targetId === selectedNodeId)

          const label = isFocused ? typed.summaryFull : typed.summaryShort
          const midX = startX + (endX - startX) * 0.5
          const midY = startY + (endY - startY) * 0.5
          const fontSize = Math.max(4, Math.min(10, 9 / globalScale))
          const maxWidth = isFocused ? Math.max(120, 260 / globalScale) : Math.max(70, 140 / globalScale)

          ctx.font = `${isFocused ? '700' : '600'} ${fontSize}px "Noto Sans KR", "Pretendard", sans-serif`
          const lines = wrapText(ctx, label, maxWidth)
          const lineHeight = fontSize + 2 / globalScale
          const boxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 18)
          const boxHeight = lines.length * lineHeight
          const paddingX = 5 / globalScale
          const paddingY = 3 / globalScale

          ctx.fillStyle = isFocused ? 'rgba(2, 6, 23, 0.9)' : 'rgba(2, 6, 23, 0.64)'
          ctx.fillRect(
            midX - boxWidth / 2 - paddingX,
            midY - boxHeight / 2 - paddingY,
            boxWidth + paddingX * 2,
            boxHeight + paddingY * 2,
          )

          ctx.fillStyle = isFocused ? '#f8fafc' : '#cbd5e1'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          lines.forEach((line, index) => {
            const y = midY - boxHeight / 2 + lineHeight * (index + 0.5)
            ctx.fillText(line, midX, y)
          })
        }}
      />
    </div>
  )
}
