// Prints the tagging-matrix review (planning-visual-pivot.md §4.3): per-rule
// counts, which rules are usable, near-duplicate pairs, oversize families,
// unshippable rules and the runway. Read-only.
// Run with: npm run visual:report

import { ITEMS } from '../items.js'
import {
  buildMatrixReport,
  MAX_FAMILY_SHARE,
  MIN_DEFINITE_PER_SIDE,
  NEAR_DUPLICATE_SIMILARITY,
} from '../report.js'
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'

const report = buildMatrixReport(VISUAL_RULES, ITEMS, MATRIX)
const pad = (n: number) => String(n).padStart(4)

console.log(`rule${' '.repeat(34)} yes   no  uns  unt`)
for (const c of report.counts) {
  const mark = c.eligible ? '' : `   below ${MIN_DEFINITE_PER_SIDE} on a side`
  console.log(
    `${c.ruleId.padEnd(38)}${pad(c.yes)} ${pad(c.no)} ${pad(c.unsure)} ${pad(c.untagged)}${mark}`
  )
}

console.log(
  `\nNear-duplicates (similarity >= ${NEAR_DUPLICATE_SIMILARITY}): merge or split each pair`
)
if (report.nearDuplicates.length === 0) console.log('  none')
for (const d of report.nearDuplicates) {
  console.log(
    `  ${d.a} ${d.inverted ? '~ NOT' : '~'} ${d.b}  (${d.similarity.toFixed(2)} over ${d.shared} items)`
  )
}

console.log(`\nFamilies over ${Math.round(MAX_FAMILY_SHARE * 100)}% of usable rules:`)
if (report.oversizeFamilies.length === 0) console.log('  none')
for (const f of report.oversizeFamilies) {
  console.log(`  ${f.family}: ${f.eligible} rules (${Math.round(f.share * 100)}%)`)
}

console.log('\nUnshippable (a rival no item can contradict):')
if (report.unshippable.length === 0) console.log('  none')
for (const u of report.unshippable) {
  console.log(`  ${u.ruleId}  blocked by ${u.blockedBy.join(', ')}`)
}

const untagged = report.counts.reduce((sum, c) => sum + c.untagged, 0)
console.log(`\nUsable rules: ${report.eligibleCount} of ${VISUAL_RULES.length}`)
console.log(`Runway before any are used: ${report.eligibleCount} days`)
if (untagged > 0) console.log(`Untagged cells: ${untagged} (npm run visual:tag fills them)`)
const partlyTagged = report.counts.filter((c) => c.untagged > 0).length
if (partlyTagged > 0) {
  console.log(
    `Warning: ${partlyTagged} rules still have untagged usable items. Tag them before ` +
      'generating: a partly tagged rule collides with almost every board.'
  )
}
