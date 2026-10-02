// Normalizes every item's raw icon into public/icons/visual/<id>.svg and
// writes the review contact sheet. Never deletes anything: an orphaned output
// file is reported and fails the run, and removing it is a human decision.
// Run with: npm run visual:icons

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildContactSheet, type SheetEntry } from '../contactSheet.js'
import { ICON_OUTPUT_DIR, rawIconPath, strokeScaleFor } from '../iconSources.js'
import { ITEMS } from '../items.js'
import { normalizeSvg } from '../normalize.js'
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'
import { validateItems } from '../validateItems.js'

const SHEET_PATH = join(process.cwd(), 'content-engine', 'output', 'icon-sheet.html')

const problems = validateItems(ITEMS)
if (problems.length > 0) {
  for (const p of problems) console.error(`INVALID  ${p}`)
  process.exit(1)
}

const failures: string[] = []
const warnings: string[] = []
const changed: string[] = []
const entries: SheetEntry[] = []

mkdirSync(ICON_OUTPUT_DIR, { recursive: true })

for (const item of ITEMS) {
  const source = rawIconPath(item)
  if (!existsSync(source)) {
    failures.push(`${item.id}: no raw file at ${source} (run npm run visual:fetch-icons)`)
    continue
  }
  const result = normalizeSvg(readFileSync(source, 'utf8'), strokeScaleFor(item))
  if (!result.ok) {
    for (const reason of result.reasons) failures.push(`${item.id}: ${reason}`)
    continue
  }
  for (const warning of result.warnings) warnings.push(`${item.id}: ${warning}`)

  const out = join(ICON_OUTPUT_DIR, `${item.id}.svg`)
  if (!existsSync(out) || readFileSync(out, 'utf8') !== result.svg) changed.push(item.id)
  writeFileSync(out, result.svg)
  entries.push({ id: item.id, name: item.name, svg: result.svg })
}

const expected = new Set(ITEMS.map((i) => `${i.id}.svg`))
const orphans = readdirSync(ICON_OUTPUT_DIR).filter((f) => !expected.has(f))

mkdirSync(join(process.cwd(), 'content-engine', 'output'), { recursive: true })
writeFileSync(SHEET_PATH, buildContactSheet(entries))

console.log(`Normalized ${entries.length}/${ITEMS.length} icons -> ${ICON_OUTPUT_DIR}`)
console.log(`Contact sheet -> ${SHEET_PATH}`)
if (changed.length > 0) console.log(`Changed (${changed.length}): ${changed.join(', ')}`)
// Shape rules are judged on the icon as drawn (planning-visual-pivot.md §4.1),
// so a redrawn icon's existing shape answers may now be wrong.
const shapeRules = VISUAL_RULES.filter((r) => r.family === 'shape')
for (const id of changed) {
  const tagged = shapeRules.filter((r) => MATRIX.cellOf(id, r.id) !== undefined)
  if (tagged.length > 0) {
    console.log(`  re-check ${id}'s shape tags: ${tagged.map((r) => r.id).join(', ')}`)
  }
}
for (const w of warnings) console.warn(`warn  ${w}`)
for (const f of failures) console.error(`FAIL  ${f}`)
for (const o of orphans) {
  console.error(`ORPHAN  ${o} has no item; delete it by hand if that is intended`)
}
if (failures.length > 0 || orphans.length > 0) process.exit(1)
