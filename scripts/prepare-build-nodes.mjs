import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')
const targetPath = path.join(repoRoot, 'src/data/nodes.json')

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

if (sourcePath === targetPath) {
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

if (!Array.isArray(parsed)) {
  throw new Error('[prepare-build-nodes] user nodes file must contain a JSON array')
}

fs.writeFileSync(targetPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
console.log(
  `[prepare-build-nodes] applied ${path.relative(repoRoot, sourcePath)} -> src/data/nodes.json (${parsed.length} nodes)`,
)
