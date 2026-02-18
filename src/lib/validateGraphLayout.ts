import type {
  GraphLayout,
  GraphLayoutMeta,
  GraphLayoutNode,
  GraphLayoutValidationResult,
  GraphViewport,
} from '../types/graph'

const DEFAULT_VIEWPORT: GraphViewport = {
  x: 0,
  y: 0,
  k: 1,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sanitizeViewport(
  value: unknown,
  errors: string[],
): GraphViewport {
  if (!isRecord(value)) {
    errors.push('viewport must be an object')
    return { ...DEFAULT_VIEWPORT }
  }

  const { x, y, k } = value
  if (!isFiniteNumber(x)) {
    errors.push('viewport.x must be a finite number')
  }
  if (!isFiniteNumber(y)) {
    errors.push('viewport.y must be a finite number')
  }
  if (!isFiniteNumber(k) || k <= 0) {
    errors.push('viewport.k must be a finite positive number')
  }

  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(k) || k <= 0) {
    return { ...DEFAULT_VIEWPORT }
  }

  return { x, y, k }
}

function sanitizeMeta(value: unknown): GraphLayoutMeta | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const { exportedAt, nodeCount } = value
  const isValidNodeCount =
    typeof nodeCount === 'number' && Number.isInteger(nodeCount) && nodeCount >= 0
  if (typeof exportedAt !== 'string' || !isValidNodeCount) {
    return undefined
  }

  return {
    exportedAt,
    nodeCount,
  }
}

function sanitizeNodes(
  value: unknown,
  validNodeIdSet?: ReadonlySet<string>,
  errors?: string[],
): Record<string, GraphLayoutNode> {
  if (!isRecord(value)) {
    errors?.push('nodes must be an object')
    return {}
  }

  const normalized: Record<string, GraphLayoutNode> = {}
  for (const [nodeId, nodeValue] of Object.entries(value)) {
    if (validNodeIdSet && !validNodeIdSet.has(nodeId)) {
      continue
    }

    if (!isRecord(nodeValue)) {
      errors?.push(`nodes.${nodeId} must be an object`)
      continue
    }

    const { x, y } = nodeValue
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      errors?.push(`nodes.${nodeId} must contain finite x/y values`)
      continue
    }

    normalized[nodeId] = { x, y }
  }

  return normalized
}

export function createDefaultGraphLayout(): GraphLayout {
  return {
    version: 1,
    nodes: {},
    viewport: { ...DEFAULT_VIEWPORT },
  }
}

export function validateGraphLayout(
  value: unknown,
  validNodeIdSet?: ReadonlySet<string>,
): GraphLayoutValidationResult {
  const errors: string[] = []
  const fallback = createDefaultGraphLayout()

  if (!isRecord(value)) {
    errors.push('layout root must be an object')
    return {
      isValid: false,
      errors,
      layout: fallback,
    }
  }

  if (value.version !== 1) {
    errors.push('version must be 1')
  }

  const normalized: GraphLayout = {
    version: 1,
    nodes: sanitizeNodes(value.nodes, validNodeIdSet, errors),
    viewport: sanitizeViewport(value.viewport, errors),
  }

  const meta = sanitizeMeta(value.meta)
  if (meta) {
    normalized.meta = meta
  }

  return {
    isValid: errors.length === 0,
    errors,
    layout: normalized,
  }
}

export function assertValidGraphLayout(
  value: unknown,
  validNodeIdSet?: ReadonlySet<string>,
): GraphLayout {
  const result = validateGraphLayout(value, validNodeIdSet)
  if (!result.isValid) {
    throw new Error(`Invalid graph layout:\n${result.errors.join('\n')}`)
  }
  return result.layout
}
