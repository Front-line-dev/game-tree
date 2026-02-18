#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const NODES_PATH = path.join(ROOT, 'src/data/nodes.json')
const EDGES_PATH = path.join(ROOT, 'src/data/edges.json')
const CANDIDATES_PATH = path.join(ROOT, 'docs/research/candidate-games.json')
const OUTPUT_PATH = path.join(ROOT, 'docs/research/stored-games-track-review.md')

const TRACK_LABEL = {
  pioneer: '시스템 창시·확산형',
  popularizer: '대중화·표준화형',
  end_node: '최근 유망 끝노드형',
}

const GATE_LABEL = {
  system_definition_fixed: '시스템 정의 고정 가능',
  directional_claim_fixed: '영향 방향(A->B) 고정 가능',
  direct_quote_or_primary: '직접 인용/1차 준거 확보',
  popularity_signal: '유명성·대중성 신호',
  downstream_spread_observed: '후행 확산 관측',
  recent_release_window: '최근 출시(2023+)',
}

const REQUIRED_GATES_BY_TRACK = {
  pioneer: [
    'system_definition_fixed',
    'directional_claim_fixed',
    'direct_quote_or_primary',
    'downstream_spread_observed',
  ],
  popularizer: [
    'system_definition_fixed',
    'directional_claim_fixed',
    'direct_quote_or_primary',
    'popularity_signal',
  ],
  end_node: [
    'recent_release_window',
    'system_definition_fixed',
    'direct_quote_or_primary',
    'popularity_signal',
  ],
}

const GATE_ORDER = [
  'system_definition_fixed',
  'directional_claim_fixed',
  'direct_quote_or_primary',
  'popularity_signal',
  'downstream_spread_observed',
  'recent_release_window',
]

function boolMark(value) {
  return value ? 'Y' : 'N'
}

function parseNodeNumericId(nodeId) {
  const raw = String(nodeId ?? '').replace(/^g/i, '')
  return Number.parseInt(raw, 10)
}

function isPrimaryEvidenceUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return !hostname.endsWith('.wikipedia.org') && hostname !== 'wikipedia.org'
  } catch {
    return false
  }
}

function inferTrack({ releaseYear, outDegree }) {
  if (releaseYear >= 2023 && outDegree === 0) {
    return 'end_node'
  }
  if (outDegree >= 2) {
    return 'pioneer'
  }
  return 'popularizer'
}

function inferGates({ releaseYear, inDegree, outDegree, primaryEvidenceEdges }) {
  const connected = inDegree + outDegree > 0
  return {
    system_definition_fixed: connected,
    directional_claim_fixed: connected,
    direct_quote_or_primary: primaryEvidenceEdges > 0,
    popularity_signal: connected,
    downstream_spread_observed: outDegree >= 2,
    recent_release_window: releaseYear >= 2023,
  }
}

function normalizeCandidateGates(rawGates, fallbackGates) {
  if (!rawGates || typeof rawGates !== 'object') {
    return fallbackGates
  }

  return {
    system_definition_fixed:
      Boolean(rawGates.system_definition_fixed) || fallbackGates.system_definition_fixed,
    directional_claim_fixed:
      Boolean(rawGates.directional_claim_fixed) || fallbackGates.directional_claim_fixed,
    direct_quote_or_primary:
      Boolean(rawGates.direct_quote_or_primary) || fallbackGates.direct_quote_or_primary,
    popularity_signal: Boolean(rawGates.popularity_signal) || fallbackGates.popularity_signal,
    downstream_spread_observed:
      Boolean(rawGates.downstream_spread_observed) || fallbackGates.downstream_spread_observed,
    recent_release_window: Boolean(rawGates.recent_release_window) || fallbackGates.recent_release_window,
  }
}

function gateSummary(gates) {
  return GATE_ORDER.map((gateKey) => `${GATE_LABEL[gateKey]}:${boolMark(Boolean(gates[gateKey]))}`).join(
    ', ',
  )
}

function formatCountMap(mapObject) {
  return Object.entries(mapObject)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
}

async function main() {
  const [nodesRaw, edgesRaw, candidatesRaw] = await Promise.all([
    fs.readFile(NODES_PATH, 'utf8'),
    fs.readFile(EDGES_PATH, 'utf8'),
    fs.readFile(CANDIDATES_PATH, 'utf8'),
  ])

  const nodes = JSON.parse(nodesRaw)
  const edges = JSON.parse(edgesRaw)
  const candidates = JSON.parse(candidatesRaw)

  const acceptedCandidateByNodeId = new Map(
    candidates
      .filter((candidate) => candidate.status === 'accepted' && typeof candidate.acceptedNodeId === 'string')
      .map((candidate) => [candidate.acceptedNodeId, candidate]),
  )

  const inDegreeByNodeId = new Map(nodes.map((node) => [node.id, 0]))
  const outDegreeByNodeId = new Map(nodes.map((node) => [node.id, 0]))
  const primaryEvidenceEdgeByNodeId = new Map(nodes.map((node) => [node.id, 0]))

  for (const edge of edges) {
    if (outDegreeByNodeId.has(edge.source)) {
      outDegreeByNodeId.set(edge.source, outDegreeByNodeId.get(edge.source) + 1)
    }
    if (inDegreeByNodeId.has(edge.target)) {
      inDegreeByNodeId.set(edge.target, inDegreeByNodeId.get(edge.target) + 1)
    }

    if (isPrimaryEvidenceUrl(edge.evidenceUrl)) {
      if (primaryEvidenceEdgeByNodeId.has(edge.source)) {
        primaryEvidenceEdgeByNodeId.set(edge.source, primaryEvidenceEdgeByNodeId.get(edge.source) + 1)
      }
      if (primaryEvidenceEdgeByNodeId.has(edge.target)) {
        primaryEvidenceEdgeByNodeId.set(edge.target, primaryEvidenceEdgeByNodeId.get(edge.target) + 1)
      }
    }
  }

  const sortedNodes = [...nodes].sort((a, b) => parseNodeNumericId(a.id) - parseNodeNumericId(b.id))

  const statusCounts = { accepted: 0, pending: 0, rejected: 0 }
  const trackCounts = { pioneer: 0, popularizer: 0, end_node: 0 }
  const basisCounts = {
    candidate_dossier: 0,
    legacy_graph_audit: 0,
    legacy_graph_audit_isolated: 0,
  }
  const missingCounts = new Map()

  const rowLines = []

  for (const node of sortedNodes) {
    const inDegree = inDegreeByNodeId.get(node.id) ?? 0
    const outDegree = outDegreeByNodeId.get(node.id) ?? 0
    const primaryEvidenceEdges = primaryEvidenceEdgeByNodeId.get(node.id) ?? 0
    const fallbackGates = inferGates({
      releaseYear: node.releaseYear,
      inDegree,
      outDegree,
      primaryEvidenceEdges,
    })

    const acceptedCandidate = acceptedCandidateByNodeId.get(node.id)
    const track = acceptedCandidate?.acceptanceTrack ?? inferTrack({ releaseYear: node.releaseYear, outDegree })
    const gates = normalizeCandidateGates(acceptedCandidate?.acceptanceCriteriaReview?.gates, fallbackGates)
    const requiredGates = REQUIRED_GATES_BY_TRACK[track]

    let missingForTrack = requiredGates.filter((gateKey) => !gates[gateKey]).map((gateKey) => GATE_LABEL[gateKey])
    let status = 'pending'
    let basis = 'legacy_graph_audit'
    let decision = ''

    if (acceptedCandidate) {
      status = 'accepted'
      basis = 'candidate_dossier'
      missingForTrack = acceptedCandidate.acceptanceCriteriaReview?.missingForTrackAcceptance ?? []
      decision = '후보 채택 심사 기록을 근거로 accepted 유지'
    } else {
      const connected = inDegree + outDegree > 0
      if (!connected) {
        basis = 'legacy_graph_audit_isolated'
      }
      status = missingForTrack.length === 0 ? 'accepted' : 'pending'
      decision =
        status === 'accepted'
          ? `자동 게이트 검사로 ${TRACK_LABEL[track]} 기준 충족`
          : `미충족: ${missingForTrack.join(', ')}`
    }

    statusCounts[status] += 1
    trackCounts[track] += 1
    basisCounts[basis] += 1
    for (const missing of missingForTrack) {
      missingCounts.set(missing, (missingCounts.get(missing) ?? 0) + 1)
    }

    const missingText = missingForTrack.length > 0 ? missingForTrack.join(', ') : '-'
    rowLines.push(
      `| ${node.id} | ${node.displayTitle} | ${node.releaseYear} | ${status} | ${track} | ${inDegree}/${outDegree} | ${primaryEvidenceEdges} | ${gateSummary(gates)} | ${missingText} | ${basis} | ${decision} |`,
    )
  }

  const sortedMissing = [...missingCounts.entries()].sort((a, b) => b[1] - a[1])
  const missingSummary = sortedMissing.length
    ? sortedMissing.map(([label, count]) => `${label}:${count}`).join(', ')
    : 'none'

  const now = new Date().toISOString()
  const markdown = `# 저장 노드 3트랙 재검토 로그

- reevaluated_at: ${now}
- basis: strict accepted-track gates + candidate dossier + current graph evidence
- total_nodes: ${sortedNodes.length}
- status: ${formatCountMap(statusCounts)}
- track: ${formatCountMap(trackCounts)}
- basis_counts: ${formatCountMap(basisCounts)}
- missing_gate_counts: ${missingSummary}

| nodeId | title | releaseYear | status | acceptanceTrack | in/out | primaryEvidenceEdges | gate summary | missing for track | basis | decision |
| --- | --- | ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
${rowLines.join('\n')}
`

  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8')
  console.log(
    `[rebuild-stored-game-track-review] nodes=${sortedNodes.length}, accepted=${statusCounts.accepted}, pending=${statusCounts.pending}, rejected=${statusCounts.rejected}`,
  )
}

main().catch((error) => {
  console.error('[rebuild-stored-game-track-review] failed')
  console.error(error)
  process.exitCode = 1
})
