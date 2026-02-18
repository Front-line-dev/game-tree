import type { GraphData } from '../types/graph'

export function buildVisibleGraph(data: GraphData): GraphData {
  const visibleNodeIds = new Set<string>()

  for (const edge of data.edges) {
    visibleNodeIds.add(edge.source)
    visibleNodeIds.add(edge.target)
  }

  return {
    nodes: data.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: data.edges,
  }
}
