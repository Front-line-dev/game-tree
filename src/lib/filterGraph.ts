import type { FilterParams, GraphData } from '../types/graph'

const normalize = (value: string): string => value.trim().toLocaleLowerCase()

export function filterGraph(data: GraphData, params: FilterParams): GraphData {
  const normalizedQuery = normalize(params.query)

  if (normalizedQuery.length === 0) {
    return {
      nodes: data.nodes,
      edges: data.edges,
    }
  }

  const matchedNodeIds = new Set(
    data.nodes
      .filter((node) => {
        const displayTitle = normalize(node.displayTitle)
        const titleOriginal = normalize(node.titleOriginal)
        return displayTitle.includes(normalizedQuery) || titleOriginal.includes(normalizedQuery)
      })
      .map((node) => node.id),
  )

  const visibleNodeIds = new Set<string>(matchedNodeIds)
  const visibleEdges = data.edges.filter((edge) => {
    const sourceMatched = matchedNodeIds.has(edge.source)
    const targetMatched = matchedNodeIds.has(edge.target)

    if (!sourceMatched && !targetMatched) {
      return false
    }

    visibleNodeIds.add(edge.source)
    visibleNodeIds.add(edge.target)
    return true
  })

  const visibleNodes = data.nodes.filter((node) => visibleNodeIds.has(node.id))

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
  }
}
