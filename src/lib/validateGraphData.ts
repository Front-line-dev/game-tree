import { z } from 'zod'

import type { GraphData, ValidationResult } from '../types/graph'

const nodeSchema = z.object({
  id: z.string().min(1),
  displayTitle: z.string().min(1),
  titleOriginal: z.string().min(1),
  releaseYear: z.number().int().min(1970).max(2035),
  platforms: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
  genreGroup: z.enum([
    'rpg',
    'action',
    'platformer',
    'adventure',
    'shooter',
    'strategy',
    'simulation',
    'sandbox',
    'survival',
    'puzzle',
    'indie',
  ]),
  imagePath: z.string().min(1),
})

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  summaryShort: z.string().min(1).max(20),
  evidenceTitle: z.string().min(1),
  evidenceUrl: z.url(),
  analysisRef: z.string().min(1),
  reviewMode: z.literal('internal_reviewed'),
})

const graphDataSchema = z.object({
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema).min(1),
})

function hasDuplicate(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }
    seen.add(value)
  }

  return [...duplicates]
}

export function validateGraphData(data: GraphData): ValidationResult {
  const errors: string[] = []
  const parseResult = graphDataSchema.safeParse(data)
  const bannedReasonRegex = /(확장|진화|정교화|후속작|연대기|출시\s*순|시리즈\s*순)/

  if (!parseResult.success) {
    const zodErrors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
    )
    return {
      isValid: false,
      errors: zodErrors,
    }
  }

  const nodeIds = data.nodes.map((node) => node.id)
  const edgeIds = data.edges.map((edge) => edge.id)

  const duplicateNodeIds = hasDuplicate(nodeIds)
  if (duplicateNodeIds.length > 0) {
    errors.push(`Duplicate node IDs: ${duplicateNodeIds.join(', ')}`)
  }

  const duplicateEdgeIds = hasDuplicate(edgeIds)
  if (duplicateEdgeIds.length > 0) {
    errors.push(`Duplicate edge IDs: ${duplicateEdgeIds.join(', ')}`)
  }

  const nodeIdSet = new Set(nodeIds)
  for (const edge of data.edges) {
    if (!nodeIdSet.has(edge.source)) {
      errors.push(`Edge ${edge.id} references missing source node: ${edge.source}`)
    }
    if (!nodeIdSet.has(edge.target)) {
      errors.push(`Edge ${edge.id} references missing target node: ${edge.target}`)
    }

    if (!edge.analysisRef.startsWith('docs/research/') || !edge.analysisRef.includes('#')) {
      errors.push(
        `Edge ${edge.id} analysisRef must point to docs/research/* with an anchor`,
      )
    }

    if (edge.analysisRef.includes('edge-review-log.md')) {
      errors.push(`Edge ${edge.id} analysisRef must not reference edge-review-log.md`)
    }

    if (bannedReasonRegex.test(edge.summaryShort)) {
      errors.push(
        `Edge ${edge.id} summaryShort contains banned reason keyword (확장|진화|정교화|후속작|연대기|출시 순|시리즈 순)`,
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function assertValidGraphData(data: GraphData): void {
  const result = validateGraphData(data)
  if (!result.isValid) {
    throw new Error(`Invalid graph data:\n${result.errors.join('\n')}`)
  }
}
