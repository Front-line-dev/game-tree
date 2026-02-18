import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const nodesPath = path.join(repoRoot, 'src/data/nodes.json')
const edgesPath = path.join(repoRoot, 'src/data/edges.json')

const genreSummarySeed = {
  rpg: '캐릭터 성장과 역할 수행의 재미를 강조한 RPG',
  action: '즉각적인 조작 반응과 전투 리듬이 핵심인 액션 게임',
  platformer: '이동 동선과 점프 판정의 완성도를 중시한 플랫폼 게임',
  adventure: '탐험과 상호작용으로 서사를 전달하는 어드벤처 게임',
  shooter: '조준 감각과 전장 템포의 균형이 중요한 슈팅 게임',
  strategy: '의사결정과 운영 판단이 승패를 가르는 전략 게임',
  simulation: '시스템 운영과 상태 관리를 중심으로 설계한 시뮬레이션 게임',
  sandbox: '자율 목표와 시스템 조합 플레이를 강조한 샌드박스 게임',
  survival: '자원 압박과 생존 선택의 긴장을 다루는 생존 게임',
  puzzle: '규칙 해석과 문제 해결 과정이 중심인 퍼즐 게임',
  indie: '실험적 아이디어와 강한 개성을 전면에 둔 인디 게임',
}

function pickIncomingDescription(incomingEdge, nodeById) {
  if (!incomingEdge) {
    return null
  }

  const sourceNode = nodeById.get(incomingEdge.source)
  const sourceName = sourceNode?.displayTitle ?? incomingEdge.source
  return {
    sourceName,
    factor: incomingEdge.summaryShort,
  }
}

function pickOutgoingDescription(outgoingEdge) {
  if (!outgoingEdge) {
    return null
  }

  return outgoingEdge.summaryShort
}

function buildSummary(node, incomingEdge, outgoingEdge, nodeById) {
  const base = genreSummarySeed[node.genreGroup] ?? '장르 특성이 뚜렷한 게임'
  const incomingInfo = pickIncomingDescription(incomingEdge, nodeById)
  const outgoingText = pickOutgoingDescription(outgoingEdge)

  if (incomingInfo && outgoingText) {
    return `${base}. ${incomingInfo.sourceName}의 ${incomingInfo.factor}에 영향을 받았고 ${outgoingText} 요소로 후속 흐름에 기준을 남긴 작품이다.`
  }

  if (incomingInfo) {
    return `${base}. ${incomingInfo.sourceName}의 ${incomingInfo.factor}에 영향을 받아 고유한 플레이 감각을 만든 작품이다.`
  }

  if (outgoingText) {
    return `${base}. ${outgoingText} 요소를 대표적으로 보여 주며 이후 계보에 참고점을 남긴 작품이다.`
  }

  return `${base}. 현재 계보 데이터에서 직접 연결된 선행/후행 영향은 확인되지 않았다.`
}

function pickIncomingEdge(incoming, nodeById) {
  if (incoming.length === 0) {
    return null
  }

  return [...incoming].sort((a, b) => {
    const aYear = nodeById.get(a.source)?.releaseYear ?? Number.MAX_SAFE_INTEGER
    const bYear = nodeById.get(b.source)?.releaseYear ?? Number.MAX_SAFE_INTEGER

    if (aYear !== bYear) {
      return aYear - bYear
    }

    return a.id.localeCompare(b.id)
  })[0]
}

function pickOutgoingEdge(outgoing) {
  if (outgoing.length === 0) {
    return null
  }

  return [...outgoing].sort((a, b) => a.id.localeCompare(b.id))[0]
}

async function main() {
  const [nodesRaw, edgesRaw] = await Promise.all([
    fs.readFile(nodesPath, 'utf8'),
    fs.readFile(edgesPath, 'utf8'),
  ])

  const nodes = JSON.parse(nodesRaw)
  const edges = JSON.parse(edgesRaw)

  const incomingMap = new Map()
  const outgoingMap = new Map()

  for (const edge of edges) {
    if (!outgoingMap.has(edge.source)) {
      outgoingMap.set(edge.source, [])
    }
    if (!incomingMap.has(edge.target)) {
      incomingMap.set(edge.target, [])
    }

    outgoingMap.get(edge.source).push(edge)
    incomingMap.get(edge.target).push(edge)
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const nextNodes = nodes.map((node) => {
    const incoming = incomingMap.get(node.id) ?? []
    const outgoing = outgoingMap.get(node.id) ?? []

    const incomingEdge = pickIncomingEdge(incoming, nodeById)
    const outgoingEdge = pickOutgoingEdge(outgoing)

    return {
      ...node,
      summary: buildSummary(node, incomingEdge, outgoingEdge, nodeById),
    }
  })

  await fs.writeFile(nodesPath, `${JSON.stringify(nextNodes, null, 2)}\n`, 'utf8')

  console.log('[rebuild-node-summaries] complete')
  console.log(`- nodes updated: ${nextNodes.length}`)
  console.log(`- edges used: ${edges.length}`)
}

main().catch((error) => {
  console.error('[rebuild-node-summaries] failed')
  console.error(error)
  process.exitCode = 1
})
