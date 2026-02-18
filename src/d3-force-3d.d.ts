declare module 'd3-force-3d' {
  interface ForceCollide<NodeType> {
    (alpha: number): void
    radius(radius: number | ((node: NodeType) => number)): ForceCollide<NodeType>
    strength(strength: number): ForceCollide<NodeType>
    iterations(iterations: number): ForceCollide<NodeType>
    initialize(nodes: NodeType[]): void
  }

  export function forceCollide<NodeType = unknown>(
    radius?: number | ((node: NodeType) => number),
  ): ForceCollide<NodeType>
}
