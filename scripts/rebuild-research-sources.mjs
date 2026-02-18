#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const edgesPath = path.join(repoRoot, 'src/data/edges.json')
const sourcesPath = path.join(repoRoot, 'docs/research/sources.md')

const imageApiSources = [
  'https://www.mediawiki.org/wiki/API:Pageimages',
  'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages',
  'https://en.wikipedia.org/api/rest_v1/page/summary/',
]

async function main() {
  const edgesRaw = await fs.readFile(edgesPath, 'utf8')
  const edges = JSON.parse(edgesRaw)

  const byUrl = new Map()
  for (const edge of edges) {
    if (!byUrl.has(edge.evidenceUrl)) {
      byUrl.set(edge.evidenceUrl, edge.evidenceTitle)
    }
  }

  const sortedEntries = [...byUrl.entries()].sort((a, b) => a[1].localeCompare(b[1]))

  const lines = [
    '# 조사 출처 목록',
    '',
    '본 문서는 현재 채택된 엣지(`src/data/edges.json`)에서 실제 사용 중인 근거 출처만 기록한다.',
    '',
    '## 채택 엣지 근거 출처',
    ...sortedEntries.map(([url, title]) => `- ${title}\n  - ${url}`),
    '',
    '## 이미지 수집 API',
    ...imageApiSources.map((url) => `- ${url}`),
    '',
  ]

  await fs.writeFile(sourcesPath, `${lines.join('\n')}\n`, 'utf8')

  console.log('[rebuild-research-sources] complete')
  console.log(`- edges: ${edges.length}`)
  console.log(`- unique evidence urls: ${sortedEntries.length}`)
}

main().catch((error) => {
  console.error('[rebuild-research-sources] failed')
  console.error(error)
  process.exitCode = 1
})
