#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const edgesPath = path.join(repoRoot, 'src/data/edges.json')
const edgeEvidencePath = path.join(repoRoot, 'docs/research/edge-evidence.md')
const sourcesPath = path.join(repoRoot, 'docs/research/sources.md')
const bannedReasonRegex = /(확장|진화|정교화|후속작|연대기|출시\s*순|시리즈\s*순)/i

function collectAnchors(markdown) {
  const anchors = new Map()
  const regex = /^##\s+(e\d{3})\s*$/gm

  while (true) {
    const match = regex.exec(markdown)
    if (!match) {
      break
    }

    const anchor = match[1]
    anchors.set(anchor, (anchors.get(anchor) ?? 0) + 1)
  }

  return anchors
}

function collectMarkdownUrls(markdown) {
  const urls = new Set()
  const regex = /https?:\/\/[^\s)]+/g
  while (true) {
    const match = regex.exec(markdown)
    if (!match) {
      break
    }
    urls.add(match[0])
  }
  return urls
}

async function main() {
  const [edgesRaw, edgeEvidenceRaw, sourcesRaw] = await Promise.all([
    fs.readFile(edgesPath, 'utf8'),
    fs.readFile(edgeEvidencePath, 'utf8'),
    fs.readFile(sourcesPath, 'utf8'),
  ])

  const edges = JSON.parse(edgesRaw)
  const anchors = collectAnchors(edgeEvidenceRaw)
  const sourceUrls = collectMarkdownUrls(sourcesRaw)
  const errors = []
  const warnings = []

  for (const [anchor, count] of anchors.entries()) {
    if (count > 1) {
      errors.push(`Duplicate anchor in edge-evidence.md: ${anchor} (${count})`)
    }
  }

  const edgeIdSet = new Set(edges.map((edge) => edge.id))

  for (const anchor of anchors.keys()) {
    if (!edgeIdSet.has(anchor)) {
      warnings.push(`Orphan anchor in edge-evidence.md (no edge): ${anchor}`)
    }
  }

  for (const edge of edges) {
    const expectedRef = `docs/research/edge-evidence.md#${edge.id}`
    if (edge.analysisRef !== expectedRef) {
      errors.push(
        `analysisRef mismatch: ${edge.id} -> ${edge.analysisRef} (expected ${expectedRef})`,
      )
    }

    if (!anchors.has(edge.id)) {
      errors.push(`Missing edge evidence anchor for ${edge.id}`)
    }

    if (bannedReasonRegex.test(edge.summaryShort)) {
      errors.push(`summaryShort contains banned chronology keyword: ${edge.id} (${edge.summaryShort})`)
    }

    if (!sourceUrls.has(edge.evidenceUrl)) {
      warnings.push(`evidenceUrl not listed in sources.md: ${edge.id} (${edge.evidenceUrl})`)
    }
  }

  console.log('[verify-research-integrity]')
  console.log(`- edges: ${edges.length}`)
  console.log(`- anchors: ${anchors.size}`)
  console.log(`- source urls: ${sourceUrls.size}`)
  console.log(`- warnings: ${warnings.length}`)
  console.log(`- errors: ${errors.length}`)

  if (warnings.length > 0) {
    console.log('\n[warnings]')
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (errors.length > 0) {
    console.log('\n[errors]')
    for (const error of errors) {
      console.log(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log('research integrity check passed')
}

main().catch((error) => {
  console.error('[verify-research-integrity] failed')
  console.error(error)
  process.exitCode = 1
})
