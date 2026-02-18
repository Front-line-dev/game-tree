export interface GameNode {
  id: string
  displayTitle: string
  titleOriginal: string
  releaseYear: number
  platforms: string[]
  summary: string
  genreGroup:
    | 'rpg'
    | 'action'
    | 'platformer'
    | 'adventure'
    | 'shooter'
    | 'strategy'
    | 'simulation'
    | 'sandbox'
    | 'survival'
    | 'puzzle'
    | 'indie'
  imagePath: string
}

export interface GameEdge {
  id: string
  source: string
  target: string
  summaryShort: string
  evidenceTitle: string
  evidenceUrl: string
  analysisRef: string
  reviewMode: 'internal_reviewed'
}

export interface GraphData {
  nodes: GameNode[]
  edges: GameEdge[]
}

export interface FilterParams {
  query: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface GraphLayoutNode {
  x: number
  y: number
}

export interface GraphViewport {
  x: number
  y: number
  k: number
}

export interface GraphLayoutMeta {
  exportedAt: string
  nodeCount: number
}

export interface GraphLayout {
  version: 1
  nodes: Record<string, GraphLayoutNode>
  viewport: GraphViewport
  meta?: GraphLayoutMeta
}

export interface GraphLayoutValidationResult {
  isValid: boolean
  errors: string[]
  layout: GraphLayout
}
