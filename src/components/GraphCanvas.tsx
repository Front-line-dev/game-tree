import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCollide } from 'd3-force-3d'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'

import type { GameEdge, GameNode } from '../types/graph'

interface GraphCanvasProps {
  nodes: GameNode[]
  edges: GameEdge[]
  isMobile: boolean
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

const BASE_LINK_COLOR = 'rgba(148, 163, 184, 0.82)'
const FADED_LINK_COLOR = 'rgba(148, 163, 184, 0.24)'
const BASE_ARROW_COLOR = 'rgba(248, 250, 252, 0.95)'
const FADED_ARROW_COLOR = 'rgba(148, 163, 184, 0.42)'

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function stableHash(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function readNodeId(value: string | ForceNode): string {
  return typeof value === 'string' ? value : value.id
}

function isFallbackImage(imagePath: string): boolean {
  return imagePath.includes('images/fallback/')
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const limit = Math.min(radius, width / 2, height / 2)

  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, limit)
    return
  }

  ctx.moveTo(x + limit, y)
  ctx.lineTo(x + width - limit, y)
  ctx.arcTo(x + width, y, x + width, y + limit, limit)
  ctx.lineTo(x + width, y + height - limit)
  ctx.arcTo(x + width, y + height, x + width - limit, y + height, limit)
  ctx.lineTo(x + limit, y + height)
  ctx.arcTo(x, y + height, x, y + height - limit, limit)
  ctx.lineTo(x, y + limit)
  ctx.arcTo(x, y, x + limit, y, limit)
}

function getNodeRadius(nodeId: string, selectedNodeId: string | null, isMobile: boolean): number {
  const baseRadius = isMobile ? 40 : 36
  const selectedRadius = isMobile ? 44 : 40
  return nodeId === selectedNodeId ? selectedRadius : baseRadius
}

function getQuadraticPointAt(
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u * u * startX + 2 * u * t * controlX + t * t * endX,
    y: u * u * startY + 2 * u * t * controlY + t * t * endY,
  }
}

function getQuadraticArcMidpoint(
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
): { x: number; y: number } {
  const samples = 28
  const points = [
    { x: startX, y: startY },
  ]
  const cumulativeLength = [0]

  let totalLength = 0

  for (let index = 1; index <= samples; index += 1) {
    const t = index / samples
    const point = getQuadraticPointAt(startX, startY, controlX, controlY, endX, endY, t)
    const prev = points[points.length - 1]
    totalLength += Math.hypot(point.x - prev.x, point.y - prev.y)
    points.push(point)
    cumulativeLength.push(totalLength)
  }

  if (totalLength <= 0) {
    return getQuadraticPointAt(startX, startY, controlX, controlY, endX, endY, 0.5)
  }

  const midpointLength = totalLength * 0.5
  for (let index = 1; index < cumulativeLength.length; index += 1) {
    const prevLength = cumulativeLength[index - 1]
    const nextLength = cumulativeLength[index]
    if (nextLength < midpointLength) {
      continue
    }

    const span = nextLength - prevLength || 1
    const ratio = (midpointLength - prevLength) / span
    const prevPoint = points[index - 1]
    const nextPoint = points[index]
    return {
      x: prevPoint.x + (nextPoint.x - prevPoint.x) * ratio,
      y: prevPoint.y + (nextPoint.y - prevPoint.y) * ratio,
    }
  }

  return points[points.length - 1]
}

export default function GraphCanvas({
  nodes,
  edges,
  isMobile,
  selectedNodeId,
  highlightedNodeIds,
  onNodeSelect,
  onBackgroundClick,
}: GraphCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const failedImagePathSetRef = useRef<Set<string>>(new Set())
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

  const { edgeCurvatureById, edgeArrowRelPosById } = useMemo(() => {
    const outgoingMap = new Map<string, GameEdge[]>()
    const incomingMap = new Map<string, GameEdge[]>()
    const pairMap = new Map<string, GameEdge[]>()

    for (const edge of edges) {
      if (!outgoingMap.has(edge.source)) {
        outgoingMap.set(edge.source, [])
      }
      if (!incomingMap.has(edge.target)) {
        incomingMap.set(edge.target, [])
      }

      const pairKey =
        edge.source < edge.target
          ? `${edge.source}__${edge.target}`
          : `${edge.target}__${edge.source}`

      if (!pairMap.has(pairKey)) {
        pairMap.set(pairKey, [])
      }

      outgoingMap.get(edge.source)?.push(edge)
      incomingMap.get(edge.target)?.push(edge)
      pairMap.get(pairKey)?.push(edge)
    }

    const sourceRankByEdgeId = new Map<string, number>()
    const targetRankByEdgeId = new Map<string, number>()
    const pairRankByEdgeId = new Map<string, number>()

    for (const edgeGroup of outgoingMap.values()) {
      const sorted = [...edgeGroup].sort((a, b) =>
        `${a.target}:${a.id}`.localeCompare(`${b.target}:${b.id}`),
      )
      const centerIndex = (sorted.length - 1) / 2

      sorted.forEach((edge, index) => {
        sourceRankByEdgeId.set(edge.id, index - centerIndex)
      })
    }

    for (const edgeGroup of incomingMap.values()) {
      const sorted = [...edgeGroup].sort((a, b) =>
        `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`),
      )
      const centerIndex = (sorted.length - 1) / 2

      sorted.forEach((edge, index) => {
        targetRankByEdgeId.set(edge.id, index - centerIndex)
      })
    }

    for (const edgeGroup of pairMap.values()) {
      const sorted = [...edgeGroup].sort((a, b) => a.id.localeCompare(b.id))
      const centerIndex = (sorted.length - 1) / 2

      sorted.forEach((edge, index) => {
        pairRankByEdgeId.set(edge.id, index - centerIndex)
      })
    }

    const curvatureById = new Map<string, number>()
    const arrowRelPosById = new Map<string, number>()

    for (const edge of edges) {
      const sourceRank = sourceRankByEdgeId.get(edge.id) ?? 0
      const targetRank = targetRankByEdgeId.get(edge.id) ?? 0
      const pairRank = pairRankByEdgeId.get(edge.id) ?? 0
      const sourceDegree = Math.max(0, (outgoingMap.get(edge.source)?.length ?? 1) - 1)
      const targetDegree = Math.max(0, (incomingMap.get(edge.target)?.length ?? 1) - 1)
      const crowdingDegree = Math.max(sourceDegree, targetDegree)
      const rankDirection =
        Math.sign(sourceRank || targetRank || pairRank) || (stableHash(edge.id) % 2 === 0 ? 1 : -1)
      const jitter = ((stableHash(edge.id) % 1000) / 1000 - 0.5) * 0.028

      const antiCancelBoost = (Math.abs(sourceRank) + Math.abs(targetRank)) * 0.12 * rankDirection
      const crowdingBoost = Math.min(0.16, crowdingDegree * 0.038) * rankDirection

      let curvature =
        sourceRank * 0.24 + targetRank * 0.2 + pairRank * 0.2 + antiCancelBoost + crowdingBoost + jitter
      curvature = clamp(-0.58, curvature, 0.58)

      if (Math.abs(curvature) < 0.05) {
        curvature = 0.05 * rankDirection
      }

      curvatureById.set(edge.id, curvature)

      const incomingSpread = Math.min(2, targetDegree) * 0.07
      const outgoingSpread = Math.min(2, sourceDegree) * 0.028
      let arrowRelPos = 0.9 - targetRank * incomingSpread - sourceRank * outgoingSpread

      if (crowdingDegree >= 2) {
        arrowRelPos -= rankDirection * 0.018
      }

      arrowRelPos = clamp(0.76, arrowRelPos, 0.96)
      arrowRelPosById.set(edge.id, arrowRelPos)
    }

    return {
      edgeCurvatureById: curvatureById,
      edgeArrowRelPosById: arrowRelPosById,
    }
  }, [edges])

  const trySelectNearestNode = (event: MouseEvent): boolean => {
    if (!isMobile) {
      return false
    }

    const graph = graphRef.current
    if (!graph) {
      return false
    }

    const fallbackRect = wrapperRef.current?.getBoundingClientRect()
    const pointerX =
      typeof event.offsetX === 'number'
        ? event.offsetX
        : typeof fallbackRect?.left === 'number'
          ? event.clientX - fallbackRect.left
          : 0
    const pointerY =
      typeof event.offsetY === 'number'
        ? event.offsetY
        : typeof fallbackRect?.top === 'number'
          ? event.clientY - fallbackRect.top
          : 0

    let nearestNodeId: string | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const node of graphData.nodes as ForceNode[]) {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') {
        continue
      }

      const nodeScreen = graph.graph2ScreenCoords(node.x, node.y)
      const distance = Math.hypot(nodeScreen.x - pointerX, nodeScreen.y - pointerY)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestNodeId = node.id
      }
    }

    if (!nearestNodeId) {
      return false
    }

    const selectionDistanceLimit =
      selectedNodeId === null ? Number.POSITIVE_INFINITY : 72

    if (nearestDistance > selectionDistanceLimit) {
      return false
    }

    onNodeSelect(nearestNodeId)
    return true
  }

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

    const collideRadius = (isMobile ? 40 : 36) + (isMobile ? 24 : 18)
    const collideForce = forceCollide<ForceNode>(collideRadius)
      .strength(isMobile ? 1 : 0.9)
      .iterations(2)

    graph.d3Force(
      'collide',
      collideForce as unknown as ((alpha: number) => void) & {
        initialize?: (nodes: ForceNode[]) => void
      },
    )

    chargeForce?.strength?.(isMobile ? -320 : -290)
    linkForce?.distance?.(isMobile ? 215 : 190)
    linkForce?.strength?.(0.58)
    graph.d3ReheatSimulation()

    const timer = window.setTimeout(() => {
      graph.zoomToFit(420, isMobile ? 56 : 100)
      if (isMobile) {
        graph.zoom(Math.max(graph.zoom(), 0.86), 240)
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [graphData.nodes.length, graphData.links.length, isMobile, size.width, size.height])

  return (
    <div ref={wrapperRef} className="graph-canvas-wrapper">
      <ForceGraph2D
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        enableNodeDrag={false}
        minZoom={isMobile ? 0.52 : 0.38}
        maxZoom={7.5}
        backgroundColor="rgba(0,0,0,0)"
        linkDirectionalArrowLength={(link) => {
          const typed = link as ForceLink
          const sourceId = readNodeId(typed.source)
          const targetId = readNodeId(typed.target)
          const isFocused =
            selectedNodeId !== null && (sourceId === selectedNodeId || targetId === selectedNodeId)
          if (isMobile) {
            return isFocused ? 32 : 28
          }
          return isFocused ? 30 : 26
        }}
        linkDirectionalArrowRelPos={(link) => {
          const typed = link as ForceLink
          return edgeArrowRelPosById.get(typed.id) ?? 0.9
        }}
        linkCurvature={(link) => {
          const typed = link as ForceLink
          return edgeCurvatureById.get(typed.id) ?? 0.08
        }}
        nodeRelSize={8}
        cooldownTicks={190}
        onEngineStop={() => {
          const graph = graphRef.current
          if (!graph || selectedNodeId) {
            return
          }

          graph.zoomToFit(260, isMobile ? 56 : 92)
          if (isMobile) {
            graph.zoom(Math.max(graph.zoom(), 0.9), 220)
          }
        }}
        onNodeClick={(node) => {
          const typedNode = node as ForceNode
          onNodeSelect(typedNode.id)

          if (typeof typedNode.x === 'number' && typeof typedNode.y === 'number') {
            const graph = graphRef.current
            if (!graph) {
              return
            }

            graph.centerAt(typedNode.x, typedNode.y, 280)
            graph.zoom(Math.max(graph.zoom(), isMobile ? 1.05 : 1.3), 280)
          }
        }}
        onBackgroundClick={(event) => {
          if (trySelectNearestNode(event)) {
            return
          }
          onBackgroundClick()
        }}
        nodeLabel={(node) => {
          const typed = node as ForceNode
          return `${typed.displayTitle} (${typed.titleOriginal})`
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const typed = node as ForceNode
          const x = typed.x ?? 0
          const y = typed.y ?? 0
          const radius = getNodeRadius(typed.id, selectedNodeId, isMobile)

          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI)
          ctx.fill()
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const typed = node as ForceNode
          const x = typed.x ?? 0
          const y = typed.y ?? 0
          const isSelected = typed.id === selectedNodeId
          const isHighlighted = highlightedNodeIds.has(typed.id)
          const radius = getNodeRadius(typed.id, selectedNodeId, isMobile)
          const imagePath = typed.imagePath
          const hasImage =
            !isFallbackImage(imagePath) && !failedImagePathSetRef.current.has(imagePath)

          let image = imageCacheRef.current.get(imagePath)
          if (!image) {
            image = new Image()
            image.src = imagePath
            image.onload = () => {
              graphRef.current?.resumeAnimation()
            }
            image.onerror = () => {
              failedImagePathSetRef.current.add(imagePath)
              graphRef.current?.resumeAnimation()
            }
            imageCacheRef.current.set(imagePath, image)
          }

          ctx.save()
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI)
          ctx.closePath()
          ctx.clip()

          if (hasImage && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
            const aspect = image.naturalWidth / image.naturalHeight
            const box = radius * 2

            if (aspect >= 1) {
              const drawWidth = box * aspect
              ctx.drawImage(image, x - drawWidth / 2, y - box / 2, drawWidth, box)
            } else {
              const drawHeight = box / aspect
              ctx.drawImage(image, x - box / 2, y - drawHeight / 2, box, drawHeight)
            }
          } else if (!hasImage) {
            const gradient = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius)
            gradient.addColorStop(0, '#0f172a')
            gradient.addColorStop(1, '#1e293b')
            ctx.fillStyle = gradient
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)

            ctx.fillStyle = '#e2e8f0'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.font = `700 ${Math.max(5, Math.min(11, 10 / globalScale))}px "Noto Sans KR", "Pretendard", sans-serif`

            const lines = wrapText(ctx, typed.displayTitle, (radius * 1.55) / globalScale).slice(0, 3)
            const lineHeight = 11 / globalScale
            const startY = y - ((lines.length - 1) * lineHeight) / 2
            lines.forEach((line, index) => {
              ctx.fillText(line, x, startY + lineHeight * index)
            })
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

          const fontSize = Math.max(4, Math.min(12, 11 / globalScale))
          const lineHeight = fontSize + 1 / globalScale
          const paddingX = 6 / globalScale
          const paddingY = 3 / globalScale
          const textMaxWidth = (isMobile ? 98 : 140) / globalScale

          ctx.font = `700 ${fontSize}px "Noto Sans KR", "Pretendard", sans-serif`
          const lines = wrapText(ctx, typed.displayTitle, textMaxWidth)
          const titleLines = lines.slice(0, 2)

          if (lines.length > 2 && titleLines[1]) {
            let clipped = titleLines[1]
            while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > textMaxWidth) {
              clipped = clipped.slice(0, -1)
            }
            titleLines[1] = `${clipped}…`
          }

          const maxLineWidth = Math.max(...titleLines.map((line) => ctx.measureText(line).width), 18)
          const chipWidth = maxLineWidth + paddingX * 2
          const chipHeight = titleLines.length * lineHeight + paddingY * 2
          const chipX = x - chipWidth / 2
          const chipY = y - radius - chipHeight - 6 / globalScale

          drawRoundedRect(ctx, chipX, chipY, chipWidth, chipHeight, 7 / globalScale)
          ctx.fillStyle = isSelected ? 'rgba(249, 115, 22, 0.24)' : 'rgba(2, 6, 23, 0.86)'
          ctx.fill()

          ctx.strokeStyle = isSelected ? 'rgba(249, 115, 22, 0.9)' : 'rgba(148, 163, 184, 0.42)'
          ctx.lineWidth = isSelected ? 1.4 / globalScale : 1.1 / globalScale
          ctx.stroke()

          ctx.fillStyle = '#f8fafc'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          titleLines.forEach((line, index) => {
            const lineY = chipY + paddingY + lineHeight * (index + 0.5)
            ctx.fillText(line, chipX + chipWidth / 2, lineY)
          })
        }}
        linkDirectionalArrowColor={(link) => {
          const typed = link as ForceLink
          const sourceId = readNodeId(typed.source)
          const targetId = readNodeId(typed.target)

          if (!selectedNodeId) {
            return BASE_ARROW_COLOR
          }

          return sourceId === selectedNodeId || targetId === selectedNodeId
            ? BASE_ARROW_COLOR
            : FADED_ARROW_COLOR
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
            return 3
          }

          return sourceId === selectedNodeId || targetId === selectedNodeId ? 4.2 : 2.6
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
          const curvature = edgeCurvatureById.get(typed.id) ?? 0.08

          const dx = endX - startX
          const dy = endY - startY
          const distance = Math.hypot(dx, dy)
          const safeDistance = distance > 0 ? distance : 1

          const midpointX = startX + dx * 0.5
          const midpointY = startY + dy * 0.5

          // Match force-graph's internal quadratic control-point formula exactly:
          // cp = midpoint + (l * curvature) * [cos(a - PI/2), sin(a - PI/2)]
          const angle = Math.atan2(dy, dx)
          const controlOffset = safeDistance * curvature
          const controlX = midpointX + controlOffset * Math.cos(angle - Math.PI / 2)
          const controlY = midpointY + controlOffset * Math.sin(angle - Math.PI / 2)

          const onCurvePoint =
            Math.abs(curvature) > 0.0001 && distance > 0
              ? getQuadraticArcMidpoint(
                  startX,
                  startY,
                  controlX,
                  controlY,
                  endX,
                  endY,
                )
              : { x: midpointX, y: midpointY }

          const labelX = onCurvePoint.x
          const labelY = onCurvePoint.y

          const fontSize = Math.max(4, Math.min(11, 10 / globalScale))
          const lineHeight = fontSize + 1 / globalScale
          const paddingX = 6 / globalScale
          const paddingY = 3 / globalScale
          const maxWidth = (isFocused ? 170 : 120) / globalScale

          ctx.font = `700 ${fontSize}px "Noto Sans KR", "Pretendard", sans-serif`
          const lines = wrapText(ctx, typed.summaryShort, maxWidth)
          const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 10)
          const boxWidth = textWidth + paddingX * 2
          const boxHeight = lines.length * lineHeight + paddingY * 2
          const boxX = labelX - boxWidth / 2
          const boxY = labelY - boxHeight / 2

          drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 6 / globalScale)
          ctx.fillStyle = isFocused ? 'rgba(2, 6, 23, 0.94)' : 'rgba(2, 6, 23, 0.82)'
          ctx.fill()

          ctx.fillStyle = isFocused ? '#f8fafc' : '#cbd5e1'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          lines.forEach((line, index) => {
            const lineY = boxY + paddingY + lineHeight * (index + 0.5)
            ctx.fillText(line, labelX, lineY)
          })
        }}
      />
    </div>
  )
}
