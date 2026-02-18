import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')
const targetNodesPath = path.join(repoRoot, 'src/data/nodes.json')
const targetLayoutPath = path.join(repoRoot, 'src/data/graph-layout.json')

const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  k: 1,
}

const configuredPath = process.env.USER_NODES_FILE?.trim()
const candidates = [
  configuredPath,
  'input/nodes.user.json',
  'input/nodes.json',
  'src/data/nodes.user.json',
].filter(Boolean)

const selected = candidates.find((candidate) => fs.existsSync(path.resolve(repoRoot, candidate)))

if (!selected) {
  console.log('[prepare-build-nodes] no user nodes file found, using src/data/nodes.json')
  process.exit(0)
}

const sourcePath = path.resolve(repoRoot, selected)
const relativeSourcePath = path.relative(repoRoot, sourcePath)

if (sourcePath === targetNodesPath) {
  console.log('[prepare-build-nodes] source is already src/data/nodes.json, skipping')
  process.exit(0)
}

const raw = fs.readFileSync(sourcePath, 'utf8')
let parsed

try {
  parsed = JSON.parse(raw)
} catch (error) {
  throw new Error(`[prepare-build-nodes] invalid JSON in ${selected}: ${error.message}`)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function writeNodes(nodes, sourceLabel) {
  if (!Array.isArray(nodes)) {
    throw new Error('[prepare-build-nodes] nodes payload must be a JSON array')
  }

  const invalidNodeIndex = nodes.findIndex(
    (item) => !isRecord(item) || typeof item.id !== 'string' || item.id.trim() === '',
  )
  if (invalidNodeIndex >= 0) {
    throw new Error(`[prepare-build-nodes] invalid node entry at index ${invalidNodeIndex} (missing string id)`)
  }

  fs.writeFileSync(targetNodesPath, `${JSON.stringify(nodes, null, 2)}\n`, 'utf8')
  console.log(`[prepare-build-nodes] applied ${sourceLabel} -> src/data/nodes.json (${nodes.length} nodes)`)
}

function normalizeViewport(value, warnings) {
  if (!isRecord(value)) {
    if (value !== undefined) {
      warnings.push('viewport is invalid, fallback to default viewport')
    }
    return { ...DEFAULT_VIEWPORT }
  }

  const { x, y, k } = value
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(k) || k <= 0) {
    warnings.push('viewport is invalid, fallback to default viewport')
    return { ...DEFAULT_VIEWPORT }
  }

  return { x, y, k }
}

function normalizeLayout(layoutCandidate) {
  if (!isRecord(layoutCandidate.nodes)) {
    throw new Error('[prepare-build-nodes] layout.nodes must be an object')
  }

  const repoNodesRaw = fs.readFileSync(targetNodesPath, 'utf8')
  const repoNodes = JSON.parse(repoNodesRaw)
  const validNodeIdSet = new Set(
    Array.isArray(repoNodes)
      ? repoNodes
          .map((node) => (isRecord(node) && typeof node.id === 'string' ? node.id : null))
          .filter(Boolean)
      : [],
  )

  const warnings = []
  const normalizedNodes = {}
  let ignoredUnknownNodeCount = 0

  for (const [nodeId, position] of Object.entries(layoutCandidate.nodes)) {
    if (!isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
      warnings.push(`ignored invalid layout node "${nodeId}" (x/y must be finite numbers)`)
      continue
    }

    if (validNodeIdSet.size > 0 && !validNodeIdSet.has(nodeId)) {
      ignoredUnknownNodeCount += 1
      continue
    }

    normalizedNodes[nodeId] = {
      x: position.x,
      y: position.y,
    }
  }

  if (layoutCandidate.version !== undefined && layoutCandidate.version !== 1) {
    warnings.push('layout version is not 1, normalized to version 1')
  }

  const normalized = {
    version: 1,
    nodes: normalizedNodes,
    viewport: normalizeViewport(layoutCandidate.viewport, warnings),
  }

  if (isRecord(layoutCandidate.meta)) {
    const { exportedAt, nodeCount } = layoutCandidate.meta
    if (typeof exportedAt === 'string' && Number.isInteger(nodeCount) && nodeCount >= 0) {
      normalized.meta = { exportedAt, nodeCount }
    }
  }

  return {
    normalized,
    warnings,
    ignoredUnknownNodeCount,
  }
}

if (Array.isArray(parsed)) {
  writeNodes(parsed, relativeSourcePath)
  process.exit(0)
}

if (isRecord(parsed) && Array.isArray(parsed.nodes)) {
  writeNodes(parsed.nodes, relativeSourcePath)
  process.exit(0)
}

if (isRecord(parsed) && isRecord(parsed.nodes)) {
  const { normalized, warnings, ignoredUnknownNodeCount } = normalizeLayout(parsed)
  fs.writeFileSync(targetLayoutPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')

  console.log(
    `[prepare-build-nodes] applied ${relativeSourcePath} -> src/data/graph-layout.json (${Object.keys(normalized.nodes).length} nodes)`,
  )
  if (ignoredUnknownNodeCount > 0) {
    console.warn(`[prepare-build-nodes] ignored ${ignoredUnknownNodeCount} unknown node id(s)`)
  }
  for (const warning of warnings) {
    console.warn(`[prepare-build-nodes] ${warning}`)
  }
  process.exit(0)
}

throw new Error(
  '[prepare-build-nodes] unsupported format: use JSON array(nodes), { "nodes": [...] }, or layout object { "version": 1, "nodes": { ... }, "viewport": { ... } }',
)
