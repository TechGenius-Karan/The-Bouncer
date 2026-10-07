// Lists every OpenMoji entry inside the item scope, for a human to pick items
// from. Writes content-engine/output/openmoji-candidates.tsv (gitignored).
// Run with: npm run visual:candidates

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ITEMS } from '../items.js'
import { isCandidate, OPENMOJI_DATA_URL, type OpenMojiEntry } from '../openmoji.js'

const OUTPUT = join(process.cwd(), 'content-engine', 'output', 'openmoji-candidates.tsv')

async function main() {
  const res = await fetch(OPENMOJI_DATA_URL)
  if (!res.ok) throw new Error(`OpenMoji data fetch failed: ${res.status} ${OPENMOJI_DATA_URL}`)
  const entries = (await res.json()) as OpenMojiEntry[]

  const taken = new Set(ITEMS.flatMap((i) => (i.icon.set === 'openmoji' ? [i.icon.hex] : [])))
  const rows = entries.filter(isCandidate).map((e) => {
    const status = taken.has(e.hexcode) ? 'taken' : ''
    return [status, e.hexcode, e.group, e.subgroups, e.annotation].join('\t')
  })

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, ['status\thex\tgroup\tsubgroup\tannotation', ...rows].join('\n') + '\n')
  console.log(`${rows.length} candidates (${taken.size} already in items.ts) -> ${OUTPUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
