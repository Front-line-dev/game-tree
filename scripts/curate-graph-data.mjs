import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const edgesPath = path.join(repoRoot, 'src/data/edges.json')

const bannedReasonRegex = /(확장|진화|정교화|후속작)/

function normalizeShortLabel(label) {
  return String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasBannedReason(edge) {
  const fields = [edge.summaryShort, edge.summaryFull, edge.analysisRef]
  return fields.some((value) => bannedReasonRegex.test(String(value ?? '')))
}

function shouldRemove(edge) {
  if (edge.reviewMode === 'same_series_exception') {
    return 'same_series_exception'
  }

  if (String(edge.analysisRef ?? '').includes('edge-review-log.md')) {
    return 'edge_review_log_reference'
  }

  if (hasBannedReason(edge)) {
    return 'banned_reason_keyword'
  }

  return null
}

async function main() {
  const edgesRaw = await fs.readFile(edgesPath, 'utf8')
  const edges = JSON.parse(edgesRaw)

  const removedByRule = {
    same_series_exception: 0,
    edge_review_log_reference: 0,
    banned_reason_keyword: 0,
  }

  const keptEdges = []

  for (const edge of edges) {
    const removalReason = shouldRemove(edge)
    if (removalReason) {
      removedByRule[removalReason] += 1
      continue
    }

    const normalized = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      summaryShort: normalizeShortLabel(edge.summaryShort),
      evidenceTitle: edge.evidenceTitle,
      evidenceUrl: edge.evidenceUrl,
      analysisRef: edge.analysisRef,
      reviewMode: 'internal_reviewed',
    }

    keptEdges.push(normalized)
  }

  await fs.writeFile(edgesPath, `${JSON.stringify(keptEdges, null, 2)}\n`, 'utf8')

  const removedCount = edges.length - keptEdges.length

  console.log('[curate-graph-data] complete')
  console.log(`- total edges: ${edges.length}`)
  console.log(`- kept edges: ${keptEdges.length}`)
  console.log(`- removed edges: ${removedCount}`)
  console.log(`- removed.same_series_exception: ${removedByRule.same_series_exception}`)
  console.log(`- removed.edge_review_log_reference: ${removedByRule.edge_review_log_reference}`)
  console.log(`- removed.banned_reason_keyword: ${removedByRule.banned_reason_keyword}`)
}

main().catch((error) => {
  console.error('[curate-graph-data] failed')
  console.error(error)
  process.exitCode = 1
})
