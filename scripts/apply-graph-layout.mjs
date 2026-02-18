import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const nodesPath = path.join(repoRoot, 'src/data/nodes.json')
const targetLayoutPath = path.join(repoRoot, 'src/data/graph-layout.json')

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content)
}

function normalizeLayout(rawLayout, validNodeIdSet) {
  if (!isRecord(rawLayout)) {
    throw new Error('layout root must be an object')
  }

  if (rawLayout.version !== 1) {
    throw new Error('layout version must be 1')
  }

  if (!isRecord(rawLayout.nodes)) {
    throw new Error('layout.nodes must be an object')
  }

  if (!isRecord(rawLayout.viewport)) {
    throw new Error('layout.viewport must be an object')
  }

  const viewportX = rawLayout.viewport.x
  const viewportY = rawLayout.viewport.y
  const viewportK = rawLayout.viewport.k
  if (!isFiniteNumber(viewportX) || !isFiniteNumber(viewportY) || !isFiniteNumber(viewportK) || viewportK <= 0) {
    throw new Error('layout.viewport must contain finite x/y and positive k')
  }

  const normalizedNodes = {}
  for (const [nodeId, nodePosition] of Object.entries(rawLayout.nodes)) {
    if (!validNodeIdSet.has(nodeId)) {
      continue
    }
    if (!isRecord(nodePosition)) {
      throw new Error(`layout.nodes.${nodeId} must be an object`)
    }
    if (!isFiniteNumber(nodePosition.x) || !isFiniteNumber(nodePosition.y)) {
      throw new Error(`layout.nodes.${nodeId} must contain finite x/y`)
    }
    normalizedNodes[nodeId] = {
      x: nodePosition.x,
      y: nodePosition.y,
    }
  }

  const normalizedLayout = {
    version: 1,
    nodes: normalizedNodes,
    viewport: {
      x: viewportX,
      y: viewportY,
      k: viewportK,
    },
  }

  if (isRecord(rawLayout.meta)) {
    const exportedAt = rawLayout.meta.exportedAt
    const nodeCount = rawLayout.meta.nodeCount
    if (typeof exportedAt === 'string' && Number.isInteger(nodeCount) && nodeCount >= 0) {
      normalizedLayout.meta = {
        exportedAt,
        nodeCount,
      }
    }
  }

  return normalizedLayout
}

async function main() {
  const sourceLayoutArg = process.argv[2]
  if (!sourceLayoutArg) {
    throw new Error('usage: npm run layout:apply -- <layout-file.json>')
  }

  const sourceLayoutPath = path.resolve(process.cwd(), sourceLayoutArg)
  const [nodes, sourceLayout] = await Promise.all([
    readJson(nodesPath),
    readJson(sourceLayoutPath),
  ])

  if (!Array.isArray(nodes)) {
    throw new Error('src/data/nodes.json must be an array')
  }

  const validNodeIdSet = new Set(nodes.map((node) => node.id).filter((nodeId) => typeof nodeId === 'string'))
  const normalized = normalizeLayout(sourceLayout, validNodeIdSet)
  const sourceNodeCount = isRecord(sourceLayout) && isRecord(sourceLayout.nodes)
    ? Object.keys(sourceLayout.nodes).length
    : 0
  const appliedNodeCount = Object.keys(normalized.nodes).length

  await fs.writeFile(targetLayoutPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')

  console.log('[apply-graph-layout] complete')
  console.log(`- source: ${sourceLayoutPath}`)
  console.log(`- output: ${targetLayoutPath}`)
  console.log(`- nodes.applied: ${appliedNodeCount}`)
  console.log(`- nodes.removed_unknown: ${Math.max(0, sourceNodeCount - appliedNodeCount)}`)
}

main().catch((error) => {
  console.error('[apply-graph-layout] failed')
  console.error(error)
  process.exitCode = 1
})
