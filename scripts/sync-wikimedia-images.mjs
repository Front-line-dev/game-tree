#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const NODES_PATH = path.join(ROOT, 'src/data/nodes.json')
const NODE_IMAGE_DIR = path.join(ROOT, 'public/images/nodes')
const USER_AGENT = 'game-tree-bot/1.0 (image sync for educational visualization)'
const REQUEST_TIMEOUT_MS = 9000
const MAX_RETRIES = 1
const PROGRESS_EVERY = 10

const dryRun = process.argv.includes('--dry-run')
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

async function getSummaryImageByTitle(title) {
  if (summaryImageCache.has(title)) {
    return summaryImageCache.get(title)
  }

  const encoded = encodeURIComponent(title)
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`

  try {
    const summary = await fetchJson(summaryUrl)
    const source = summary?.originalimage?.source ?? summary?.thumbnail?.source
    if (typeof source === 'string' && source.startsWith('http')) {
      summaryImageCache.set(title, source)
      return source
    }
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
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=original|thumbnail&pithumbsize=900&titles=${encoded}`

  try {
    const data = await fetchJson(apiUrl)
    const pages = data?.query?.pages ? Object.values(data.query.pages) : []

    for (const page of pages) {
      if (!page || typeof page !== 'object' || 'missing' in page) {
        continue
      }

      const source = page.original?.source ?? page.thumbnail?.source
      if (typeof source === 'string' && source.startsWith('http')) {
        pageImageCache.set(title, source)
        return source
      }
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

  const searchApi = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=6&srsearch=${encodeURIComponent(`${base} intitle:game`)}`
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

  const titles = [...candidates].slice(0, 8)
  searchTitleCache.set(base, titles)
  return titles
}

async function pickBestImageFromTitles(titles) {
  let best = null

  for (const title of titles) {
    const [summaryImage, pageImage] = await Promise.all([
      getSummaryImageByTitle(title),
      queryPageImageByTitle(title),
    ])

    if (summaryImage) {
      const score = scoreImageUrl(summaryImage) + 2
      if (!best || score > best.score) {
        best = { imageUrl: summaryImage, score }
      }
    }

    if (pageImage) {
      const score = scoreImageUrl(pageImage)
      if (!best || score > best.score) {
        best = { imageUrl: pageImage, score }
      }
    }

    if (best && best.score >= 7) {
      break
    }
  }

  return best
}

async function resolveImageUrl(node) {
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
  ]).slice(0, 6)

  const directBest = await pickBestImageFromTitles(directTitles)
  if (directBest && directBest.score >= 6) {
    return directBest.imageUrl
  }

  const [searchOriginalTitles, searchDisplayTitles] = await Promise.all([
    searchCandidateTitles(original),
    searchCandidateTitles(display),
  ])

  const expandedTitles = uniqueStringValues([...directTitles, ...searchOriginalTitles, ...searchDisplayTitles]).slice(0, 10)
  const expandedBest = await pickBestImageFromTitles(expandedTitles)
  return expandedBest?.imageUrl ?? directBest?.imageUrl ?? null
}

async function downloadImage(url, outputPath) {
  let attempt = 0
  while (true) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': USER_AGENT,
        },
      })

      if (!response.ok) {
        throw new Error(`Image download failed (${response.status})`)
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(outputPath, bytes)
      return
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw error
      }
      attempt += 1
    }
  }
}

async function main() {
  const nodes = await readJson(NODES_PATH)
  await fs.mkdir(NODE_IMAGE_DIR, { recursive: true })

  let downloaded = 0
  let fallbackUsed = 0

  for (const [index, node] of nodes.entries()) {
    const targetRelative = `images/nodes/${node.id}.jpg`
    const targetPath = path.join(NODE_IMAGE_DIR, `${node.id}.jpg`)

    const imageUrl = await resolveImageUrl(node)
    if (!imageUrl) {
      node.imagePath = `images/fallback/${node.genreGroup}.svg`
      fallbackUsed += 1
      continue
    }

    if (!dryRun) {
      try {
        await downloadImage(imageUrl, targetPath)
        node.imagePath = targetRelative
        downloaded += 1
      } catch {
        node.imagePath = `images/fallback/${node.genreGroup}.svg`
        fallbackUsed += 1
      }
    } else {
      node.imagePath = targetRelative
      downloaded += 1
    }

    if ((index + 1) % PROGRESS_EVERY === 0 || index + 1 === nodes.length) {
      console.log(
        `[${index + 1}/${nodes.length}] downloaded=${downloaded}, fallback=${fallbackUsed}`,
      )
    }
  }

  if (!dryRun) {
    await writeJson(NODES_PATH, nodes)
  }

  console.log(`sync-wikimedia-images: nodes=${nodes.length}, downloaded=${downloaded}, fallback=${fallbackUsed}, dryRun=${dryRun}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
