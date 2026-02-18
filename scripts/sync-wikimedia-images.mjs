#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const NODES_PATH = path.join(ROOT, 'src/data/nodes.json')
const NODE_IMAGE_DIR = path.join(ROOT, 'public/images/nodes')
const IMAGE_AUDIT_PATH = path.join(ROOT, 'docs/research/image-audit.md')
const IMAGE_AUDIT_JSON_PATH = path.join(ROOT, 'docs/research/image-audit.json')
const USER_AGENT = 'game-tree-bot/1.0 (image sync for educational visualization)'
const REQUEST_TIMEOUT_MS = 9000
const MAX_RETRIES = 1
const PROGRESS_EVERY = 10
const MIN_CONFIDENCE_SCORE = 6
const MIN_IMAGE_AREA = 70_000
const MIN_RATIO = 0.55
const MAX_RATIO = 2.2

const positiveAssetRegex = /(cover|boxart|poster|packshot|key[_-]?art|front)/i
const negativeAssetRegex = /(logo|wordmark|icon|symbol|banner|logotype|text[_-]?logo|favicon)/i
const variantAssetRegex =
  /(rebirth|remake|remaster|definitive|enhanced|intergrade|board[_-]?game|deluxe|package|director(?:'s)?\s*cut)/i
const nonGameContextRegex =
  /(hairstyle|braid|surname|film|song|album|novel|mathematics|disambiguation|mythology|painting|sculpture)/i
const gameContextRegex =
  /(video game|game developed|action game|role-playing|rpg|platform game|strategy game|simulation game|puzzle game|shooter|adventure game|indie game|metroidvania|roguelike|sandbox game|survival game)/i
const commonTokenStopwords = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'video',
  'game',
  'edition',
  'remaster',
  'deluxe',
  'complete',
  'ultimate',
])

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'png', 'webp'])

const dryRun = process.argv.includes('--dry-run')
const refreshAll = process.argv.includes('--refresh-all')
const summaryImageCache = new Map()
const pageImageCache = new Map()
const searchTitleCache = new Map()

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

async function readOptionalJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function isValidatedAuditStatus(status) {
  return status === 'selected' || status === 'kept'
}

async function fetchWithTimeout(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url) {
  let attempt = 0
  while (true) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw error
      }
      attempt += 1
    }
  }
}

function normalizeTitle(rawTitle) {
  return rawTitle.replace(/\s+/g, ' ').trim()
}

function removeParenthetical(rawTitle) {
  return rawTitle.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

function removeSubtitle(rawTitle) {
  return rawTitle.split(':')[0].trim()
}

function uniqueStringValues(values) {
  const set = new Set()
  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }
    const normalized = normalizeTitle(value)
    if (normalized.length === 0) {
      continue
    }
    set.add(normalized)
  }
  return [...set]
}

function scoreImageUrl(url) {
  let score = 0
  if (/(cover|boxart|poster|front|title)/i.test(url)) {
    score += 4
  }
  if (/\.jpe?g(\?|$)/i.test(url)) {
    score += 2
  }
  if (/wikipedia\/commons/i.test(url)) {
    score += 1
  }
  return score
}

function canonicalTitle(text) {
  return normalizeTitle(text).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function titleTokens(text) {
  return normalizeTitle(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !commonTokenStopwords.has(token))
}

function romanToArabic(token) {
  const romanMap = new Map([
    ['i', 1],
    ['ii', 2],
    ['iii', 3],
    ['iv', 4],
    ['v', 5],
    ['vi', 6],
    ['vii', 7],
    ['viii', 8],
    ['ix', 9],
    ['x', 10],
  ])
  return romanMap.get(token) ?? null
}

function titleNumbers(text) {
  const normalized = normalizeTitle(text).toLowerCase()
  const rawTokens = normalized.replace(/[^a-z0-9]+/g, ' ').split(' ')
  const result = []
  for (const token of rawTokens) {
    if (!token) {
      continue
    }
    if (/^\d+$/.test(token)) {
      result.push(Number(token))
      continue
    }

    const romanValue = romanToArabic(token)
    if (romanValue !== null) {
      result.push(romanValue)
    }
  }
  return [...new Set(result)]
}

function titleAlignment(nodeTitle, candidateTitle) {
  const nodeTokens = titleTokens(nodeTitle)
  const candidateTokens = titleTokens(candidateTitle)
  const candidateTokenSet = new Set(candidateTokens)

  if (nodeTokens.length === 0) {
    return {
      overlapRatio: 0,
      overlapCount: 0,
      nodeTokens,
      candidateTokens,
      numberMismatch: false,
    }
  }

  const overlapCount = nodeTokens.filter((token) => candidateTokenSet.has(token)).length
  const overlapRatio = overlapCount / nodeTokens.length

  const nodeNumbers = titleNumbers(nodeTitle)
  const candidateNumbers = titleNumbers(candidateTitle)
  const candidateNumberSet = new Set(candidateNumbers)

  const numberMismatch =
    nodeNumbers.length > 0 && nodeNumbers.some((number) => !candidateNumberSet.has(number))
  const candidateHasExtraNumber = nodeNumbers.length === 0 && candidateNumbers.length > 0
  const firstTokenMismatch =
    nodeTokens.length > 0 && candidateTokens.length > 0 && !candidateTokenSet.has(nodeTokens[0])

  return {
    overlapRatio,
    overlapCount,
    nodeTokens,
    candidateTokens,
    numberMismatch,
    candidateHasExtraNumber,
    firstTokenMismatch,
  }
}

function extractYears(text) {
  const result = []
  const regex = /\b(19\d{2}|20[0-3]\d)\b/g
  while (true) {
    const match = regex.exec(text)
    if (!match) {
      break
    }
    result.push(Number(match[1]))
  }
  return [...new Set(result)]
}

function scoreYearAlignment(nodeYear, text) {
  const years = extractYears(text)
  if (years.length === 0) {
    return {
      score: 0,
      reject: false,
      reason: 'year_unknown',
    }
  }

  const minDiff = Math.min(...years.map((year) => Math.abs(year - nodeYear)))
  if (minDiff <= 2) {
    return { score: 3, reject: false, reason: 'year_match' }
  }
  if (minDiff <= 5) {
    return { score: 1, reject: false, reason: 'year_near' }
  }
  if (minDiff >= 8) {
    return { score: 0, reject: true, reason: `year_mismatch:${minDiff}` }
  }
  return { score: -2, reject: false, reason: `year_far:${minDiff}` }
}

function titleMatchScore(candidateTitle, queryTitle, node) {
  const candidate = canonicalTitle(candidateTitle)
  const query = canonicalTitle(queryTitle)
  const original = canonicalTitle(node.titleOriginal)
  const display = canonicalTitle(node.displayTitle)

  if (candidate.length === 0) {
    return 0
  }

  if (candidate === original || candidate === display) {
    return 4
  }

  if (candidate === query || query === original || query === display) {
    return 3
  }

  if (
    candidate.includes(original) ||
    candidate.includes(display) ||
    original.includes(candidate) ||
    display.includes(candidate)
  ) {
    return 2
  }

  return 0
}

function detectImageExtensionFromBytes(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }

  const headText = Buffer.from(bytes.slice(0, 512)).toString('utf8').toLowerCase()
  if (headText.includes('<svg')) {
    return 'svg'
  }

  return null
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType ?? '').toLowerCase()
  if (normalized.includes('image/jpeg') || normalized.includes('image/jpg')) {
    return 'jpg'
  }
  if (normalized.includes('image/png')) {
    return 'png'
  }
  if (normalized.includes('image/webp')) {
    return 'webp'
  }
  if (normalized.includes('image/svg')) {
    return 'svg'
  }
  return null
}

function extensionFromUrl(url) {
  try {
    const parsed = new URL(url)
    const extRaw = path.extname(parsed.pathname).toLowerCase().replace('.', '')
    if (extRaw === 'jpeg') {
      return 'jpg'
    }
    if (extRaw.length > 0) {
      return extRaw
    }
  } catch {
    // ignore
  }
  return null
}

function scoreContext(description, title) {
  const source = `${description ?? ''} ${title ?? ''}`
  const isGameContext = gameContextRegex.test(source)
  const isNonGameContext = nonGameContextRegex.test(source)

  if (isGameContext && !isNonGameContext) {
    return 4
  }

  if (isGameContext) {
    return 2
  }

  if (isNonGameContext) {
    return -7
  }

  return 0
}

function evaluateCandidate(candidate, node) {
  const reasons = []
  let score = 0

  const url = String(candidate.imageUrl ?? '')
  if (!url.startsWith('http')) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'invalid_url'],
      rejectReason: 'invalid_url',
    }
  }

  if (negativeAssetRegex.test(url)) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'logo_like_asset'],
      rejectReason: 'logo_like_asset',
    }
  }

  const nodeVariantSource = `${node.titleOriginal} ${node.displayTitle}`
  if (variantAssetRegex.test(url) && !variantAssetRegex.test(nodeVariantSource)) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'variant_asset_mismatch'],
      rejectReason: 'variant_asset_mismatch',
    }
  }

  const ext = extensionFromUrl(url)
  if (ext === 'svg') {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'svg_asset'],
      rejectReason: 'svg_asset',
    }
  }

  const width = Number(candidate.width ?? 0)
  const height = Number(candidate.height ?? 0)
  const hasDimensions = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0

  if (hasDimensions) {
    const ratio = width / height
    const area = width * height

    if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
      return {
        accepted: false,
        score,
        reasons: [...reasons, `ratio_outlier:${ratio.toFixed(3)}`],
        rejectReason: 'ratio_outlier',
      }
    }

    if (area < MIN_IMAGE_AREA) {
      return {
        accepted: false,
        score,
        reasons: [...reasons, `low_resolution:${Math.round(area)}`],
        rejectReason: 'low_resolution',
      }
    }

    score += 2
    reasons.push('dimension_ok')
  } else {
    score -= 2
    reasons.push('dimension_missing')
  }

  const contextScore = scoreContext(candidate.description, candidate.candidateTitle)
  if (contextScore <= -7) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'non_game_context'],
      rejectReason: 'non_game_context',
    }
  }

  score += contextScore
  if (contextScore > 0) {
    reasons.push('game_context')
  }

  const titleScore = titleMatchScore(candidate.candidateTitle, candidate.queryTitle, node)
  const alignment = titleAlignment(node.titleOriginal, candidate.candidateTitle)

  if (alignment.numberMismatch) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'title_number_mismatch'],
      rejectReason: 'title_number_mismatch',
    }
  }

  if (alignment.candidateHasExtraNumber) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'unexpected_numbered_variant'],
      rejectReason: 'unexpected_numbered_variant',
    }
  }

  if (alignment.firstTokenMismatch) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, 'first_token_mismatch'],
      rejectReason: 'first_token_mismatch',
    }
  }

  if (alignment.overlapRatio < 0.5) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, `title_overlap_low:${alignment.overlapRatio.toFixed(2)}`],
      rejectReason: 'title_overlap_low',
    }
  }

  score += titleScore
  if (titleScore > 0) {
    reasons.push('title_match')
  }
  reasons.push(`title_overlap:${alignment.overlapRatio.toFixed(2)}`)

  const yearContext = `${candidate.description ?? ''} ${candidate.candidateTitle ?? ''} ${candidate.imageUrl ?? ''}`
  const yearScore = scoreYearAlignment(node.releaseYear, yearContext)
  if (yearScore.reject) {
    return {
      accepted: false,
      score,
      reasons: [...reasons, yearScore.reason],
      rejectReason: yearScore.reason,
    }
  }
  score += yearScore.score
  if (yearScore.reason !== 'year_unknown') {
    reasons.push(yearScore.reason)
  }

  if (positiveAssetRegex.test(url)) {
    score += 3
    reasons.push('asset_name_positive')
  }

  if (candidate.sourceKind.includes('original')) {
    score += 1
    reasons.push('original_image')
  }

  score += scoreImageUrl(url)
  if (/wikipedia\/commons/i.test(url)) {
    score += 1
  }

  if (/\(video game\)/i.test(candidate.candidateTitle) || /\(video game\)/i.test(candidate.queryTitle)) {
    score += 2
    reasons.push('video_game_title')
  }

  return {
    accepted: true,
    score,
    reasons,
    rejectReason: null,
  }
}

function buildSummaryCandidates(summary, queryTitle) {
  const candidates = []
  if (!summary || typeof summary !== 'object') {
    return candidates
  }

  const candidateTitle = String(summary.title ?? queryTitle)
  const description = `${summary.description ?? ''} ${summary.extract ?? ''}`.trim()

  const originalSource = summary?.originalimage?.source
  if (typeof originalSource === 'string' && originalSource.startsWith('http')) {
    candidates.push({
      imageUrl: originalSource,
      width: summary?.originalimage?.width ?? null,
      height: summary?.originalimage?.height ?? null,
      description,
      sourceKind: 'summary_original',
      candidateTitle,
      queryTitle,
    })
  }

  const thumbSource = summary?.thumbnail?.source
  if (typeof thumbSource === 'string' && thumbSource.startsWith('http')) {
    candidates.push({
      imageUrl: thumbSource,
      width: summary?.thumbnail?.width ?? null,
      height: summary?.thumbnail?.height ?? null,
      description,
      sourceKind: 'summary_thumbnail',
      candidateTitle,
      queryTitle,
    })
  }

  return candidates
}

function buildPageCandidates(page, queryTitle) {
  const candidates = []
  if (!page || typeof page !== 'object') {
    return candidates
  }

  const candidateTitle = String(page.title ?? queryTitle)
  const description = `${page.description ?? ''} ${page.extract ?? ''}`.trim()

  const originalSource = page?.original?.source
  if (typeof originalSource === 'string' && originalSource.startsWith('http')) {
    candidates.push({
      imageUrl: originalSource,
      width: page?.original?.width ?? null,
      height: page?.original?.height ?? null,
      description,
      sourceKind: 'page_original',
      candidateTitle,
      queryTitle,
    })
  }

  const thumbSource = page?.thumbnail?.source
  if (typeof thumbSource === 'string' && thumbSource.startsWith('http')) {
    candidates.push({
      imageUrl: thumbSource,
      width: page?.thumbnail?.width ?? null,
      height: page?.thumbnail?.height ?? null,
      description,
      sourceKind: 'page_thumbnail',
      candidateTitle,
      queryTitle,
    })
  }

  return candidates
}

async function getSummaryImageByTitle(title) {
  if (summaryImageCache.has(title)) {
    return summaryImageCache.get(title)
  }

  const encoded = encodeURIComponent(title)
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`

  try {
    const summary = await fetchJson(summaryUrl)
    summaryImageCache.set(title, summary)
    return summary
  } catch {
    // ignore
  }

  summaryImageCache.set(title, null)
  return null
}

async function queryPageImageByTitle(title) {
  if (pageImageCache.has(title)) {
    return pageImageCache.get(title)
  }

  const encoded = encodeURIComponent(title)
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages|description|extracts&exintro=1&explaintext=1&piprop=original|thumbnail&pithumbsize=900&titles=${encoded}`

  try {
    const data = await fetchJson(apiUrl)
    const pages = data?.query?.pages ? Object.values(data.query.pages) : []

    for (const page of pages) {
      if (!page || typeof page !== 'object' || 'missing' in page) {
        continue
      }

      pageImageCache.set(title, page)
      return page
    }
  } catch {
    // ignore
  }

  pageImageCache.set(title, null)
  return null
}

async function searchCandidateTitles(query) {
  const base = normalizeTitle(query)
  if (searchTitleCache.has(base)) {
    return searchTitleCache.get(base)
  }

  if (base.length === 0) {
    searchTitleCache.set(base, [])
    return []
  }

  const candidates = new Set([base, `${base} (video game)`])

  const searchApi = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=8&srsearch=${encodeURIComponent(`${base} video game`)}`
  try {
    const data = await fetchJson(searchApi)
    const items = data?.query?.search
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item?.title === 'string') {
          candidates.add(item.title)
        }
      }
    }
  } catch {
    // ignore
  }

  const titles = [...candidates].slice(0, 10)
  searchTitleCache.set(base, titles)
  return titles
}

async function collectCandidatesFromTitle(title) {
  const [summary, page] = await Promise.all([
    getSummaryImageByTitle(title),
    queryPageImageByTitle(title),
  ])

  return [...buildSummaryCandidates(summary, title), ...buildPageCandidates(page, title)]
}

async function resolveBestCandidate(node) {
  const original = normalizeTitle(node.titleOriginal)
  const display = normalizeTitle(node.displayTitle)

  const directTitles = uniqueStringValues([
    original,
    `${original} (video game)`,
    removeSubtitle(original),
    removeParenthetical(original),
    display,
    `${display} (video game)`,
    removeSubtitle(display),
    removeParenthetical(display),
  ]).slice(0, 8)

  const [searchOriginalTitles, searchDisplayTitles] = await Promise.all([
    searchCandidateTitles(original),
    searchCandidateTitles(display),
  ])

  const allTitles = uniqueStringValues([
    ...directTitles,
    ...searchOriginalTitles,
    ...searchDisplayTitles,
  ]).slice(0, 12)

  const evaluations = []

  for (const title of allTitles) {
    const candidates = await collectCandidatesFromTitle(title)
    for (const candidate of candidates) {
      const evaluation = evaluateCandidate(candidate, node)
      evaluations.push({
        ...candidate,
        ...evaluation,
      })
    }
  }

  const accepted = evaluations
    .filter((item) => item.accepted)
    .sort((a, b) => b.score - a.score)

  if (accepted.length === 0) {
    return {
      best: null,
      bestScore: null,
      reason: 'no_valid_candidate',
      evaluations,
    }
  }

  const best = accepted[0]
  if (best.score < MIN_CONFIDENCE_SCORE) {
    return {
      best: null,
      bestScore: best.score,
      reason: `low_confidence:${best.score}`,
      evaluations,
    }
  }

  return {
    best,
    bestScore: best.score,
    reason: null,
    evaluations,
  }
}

async function clearPreviousNodeImages(nodeId) {
  const files = await fs.readdir(NODE_IMAGE_DIR)
  const prefix = `${nodeId}.`
  await Promise.all(
    files
      .filter((name) => name.startsWith(prefix))
      .map((name) => fs.unlink(path.join(NODE_IMAGE_DIR, name))),
  )
}

async function downloadImage(candidate, nodeId) {
  let attempt = 0
  while (true) {
    try {
      const response = await fetchWithTimeout(candidate.imageUrl, {
        headers: {
          'User-Agent': USER_AGENT,
        },
      })

      if (!response.ok) {
        throw new Error(`Image download failed (${response.status})`)
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type')
      const ext =
        extensionFromContentType(contentType) ??
        detectImageExtensionFromBytes(bytes) ??
        extensionFromUrl(candidate.imageUrl)

      if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) {
        throw new Error(`unsupported_image_type:${ext ?? 'unknown'}`)
      }

      await clearPreviousNodeImages(nodeId)
      const fileName = `${nodeId}.${ext}`
      const outputPath = path.join(NODE_IMAGE_DIR, fileName)
      await fs.writeFile(outputPath, bytes)

      return {
        imagePath: `images/nodes/${fileName}`,
        ext,
        contentType: contentType ?? 'unknown',
      }
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw error
      }
      attempt += 1
    }
  }
}

function buildAuditMarkdown({ startedAt, nodesCount, downloaded, fallbackUsed, dryRunMode, entries }) {
  const fallbackByReason = new Map()
  for (const entry of entries) {
    if (entry.status !== 'fallback') {
      continue
    }
    const key = entry.reason ?? 'unknown'
    fallbackByReason.set(key, (fallbackByReason.get(key) ?? 0) + 1)
  }

  const fallbackRows = [...fallbackByReason.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `| ${reason} | ${count} |`)
    .join('\n')

  const entryRows = entries
    .map((entry) => {
      const score = typeof entry.score === 'number' ? entry.score : ''
      const imagePath = entry.imagePath ?? ''
      const imageUrl = entry.imageUrl ?? ''
      return `| ${entry.nodeId} | ${entry.title} | ${entry.status} | ${score} | ${entry.reason ?? ''} | ${imagePath} | ${imageUrl} |`
    })
    .join('\n')

  return `# 이미지 감사 로그

## 실행 정보
- 실행 시각: ${startedAt}
- dry-run: ${dryRunMode}
- refresh-all: ${refreshAll}
- 전체 노드: ${nodesCount}
- 이미지 반영: ${downloaded}
- 재사용(검증 통과): ${entries.filter((entry) => entry.status === 'kept').length}
- fallback: ${fallbackUsed}

## 판정 규칙
- 채택: 게임 식별 가능(커버/키아트/대표 스크린샷) + 규격/형식 검증 통과.
- fallback: 비게임/무관 이미지, 로고/아이콘/배너 성격 이미지, MIME/확장자 불일치, 저해상도 또는 종횡비 이상치.

## fallback 사유 집계
| reason | count |
| --- | ---: |
${fallbackRows || '| (none) | 0 |'}

## 노드별 결과
| nodeId | title | status | score | reason | imagePath | imageUrl |
| --- | --- | --- | ---: | --- | --- | --- |
${entryRows}
`
}

async function main() {
  const nodes = await readJson(NODES_PATH)
  const previousAudit = await readOptionalJson(IMAGE_AUDIT_JSON_PATH)
  const previousEntryByNodeId = new Map(
    (previousAudit?.entries ?? []).map((entry) => [entry.nodeId, entry]),
  )
  await fs.mkdir(NODE_IMAGE_DIR, { recursive: true })

  const startedAt = new Date().toISOString()
  let downloaded = 0
  let fallbackUsed = 0
  let kept = 0
  const auditEntries = []

  for (const [index, node] of nodes.entries()) {
    if (!refreshAll) {
      const previous = previousEntryByNodeId.get(node.id)
      if (
        previous &&
        isValidatedAuditStatus(previous.status) &&
        typeof previous.imagePath === 'string' &&
        previous.imagePath.startsWith('images/nodes/')
      ) {
        const previousAbsolute = path.join(ROOT, 'public', previous.imagePath)
        if (await fileExists(previousAbsolute)) {
          node.imagePath = previous.imagePath
          kept += 1
          auditEntries.push({
            nodeId: node.id,
            title: node.displayTitle,
            status: 'kept',
            score: previous.score ?? null,
            reason: 'reuse_validated_asset',
            imagePath: previous.imagePath,
            imageUrl: previous.imageUrl ?? null,
          })
          if ((index + 1) % PROGRESS_EVERY === 0 || index + 1 === nodes.length) {
            console.log(
              `[${index + 1}/${nodes.length}] downloaded=${downloaded}, kept=${kept}, fallback=${fallbackUsed}`,
            )
          }
          continue
        }
      }
    }

    const resolved = await resolveBestCandidate(node)
    if (!resolved.best) {
      node.imagePath = `images/fallback/${node.genreGroup}.svg`
      fallbackUsed += 1
      auditEntries.push({
        nodeId: node.id,
        title: node.displayTitle,
        status: 'fallback',
        score: resolved.bestScore,
        reason: resolved.reason,
      })
      continue
    }

    if (!dryRun) {
      try {
        const downloadedImage = await downloadImage(resolved.best, node.id)
        node.imagePath = downloadedImage.imagePath
        downloaded += 1
        auditEntries.push({
          nodeId: node.id,
          title: node.displayTitle,
          status: 'selected',
          score: resolved.best.score,
          reason: resolved.best.reasons.join(','),
          imagePath: node.imagePath,
          imageUrl: resolved.best.imageUrl,
        })
      } catch {
        node.imagePath = `images/fallback/${node.genreGroup}.svg`
        fallbackUsed += 1
        auditEntries.push({
          nodeId: node.id,
          title: node.displayTitle,
          status: 'fallback',
          score: resolved.best.score,
          reason: 'download_failed_or_unsupported_type',
          imageUrl: resolved.best.imageUrl,
        })
      }
    } else {
      const ext = extensionFromUrl(resolved.best.imageUrl)
      if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) {
        node.imagePath = `images/fallback/${node.genreGroup}.svg`
        fallbackUsed += 1
        auditEntries.push({
          nodeId: node.id,
          title: node.displayTitle,
          status: 'fallback',
          score: resolved.best.score,
          reason: 'dry_run_unsupported_extension',
          imageUrl: resolved.best.imageUrl,
        })
      } else {
        node.imagePath = `images/nodes/${node.id}.${ext}`
        downloaded += 1
        auditEntries.push({
          nodeId: node.id,
          title: node.displayTitle,
          status: 'selected',
          score: resolved.best.score,
          reason: `dry_run:${resolved.best.reasons.join(',')}`,
          imagePath: node.imagePath,
          imageUrl: resolved.best.imageUrl,
        })
      }
    }

    if ((index + 1) % PROGRESS_EVERY === 0 || index + 1 === nodes.length) {
      console.log(
        `[${index + 1}/${nodes.length}] downloaded=${downloaded}, kept=${kept}, fallback=${fallbackUsed}`,
      )
    }
  }

  if (!dryRun) {
    await writeJson(NODES_PATH, nodes)
  }

  const auditContent = buildAuditMarkdown({
    startedAt,
    nodesCount: nodes.length,
    downloaded,
    fallbackUsed,
    dryRunMode: dryRun,
    entries: auditEntries,
  })
  await fs.writeFile(IMAGE_AUDIT_PATH, auditContent, 'utf8')
  await writeJson(IMAGE_AUDIT_JSON_PATH, {
    generatedAt: startedAt,
    dryRun,
    refreshAll,
    nodes: nodes.length,
    downloaded,
    kept,
    fallback: fallbackUsed,
    entries: auditEntries,
  })

  console.log(
    `sync-wikimedia-images: nodes=${nodes.length}, downloaded=${downloaded}, kept=${kept}, fallback=${fallbackUsed}, dryRun=${dryRun}, refreshAll=${refreshAll}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
