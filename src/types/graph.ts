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
  summaryFull: string
  evidenceTitle: string
  evidenceUrl: string
  analysisRef: string
  reviewMode: 'internal_reviewed' | 'same_series_exception'
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
