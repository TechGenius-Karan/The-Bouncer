// Phase 3's yield gate (planning-visual-pivot.md §6): 20 board attempts per
// eligible rule, on the fixed seeds 1..20, so every run measures the same
// thing. Offline: nothing is queued and no database is read, so every rule
// counts as unused.
// Yield = boards / (eligible rules × 20), the gate. Coverage = rules with at
// least one board / eligible rules. One board per rule (its lowest working
// seed) is written to content-engine/output/ for reading through.
// Run with: npm run content:generate-visual

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBoard, eligibleRules, type GeneratorInput } from '../generator.js'
import { ITEMS } from '../items.js'
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'
import type { VisualCandidate } from '../types.js'

const YIELD_GATE = 0.75
const ATTEMPTS_PER_RULE = 20
const OUTPUT_DIR = join(process.cwd(), 'content-engine', 'output')

const input: GeneratorInput = {
  items: ITEMS,
  rules: VISUAL_RULES,
  matrix: MATRIX,
  usedRuleIds: new Set(),
  pendingRuleIds: new Set(),
  rejectCounts: new Map(),
}
const nameOf = new Map(ITEMS.map((i) => [i.id, i.name]))
const revealOf = new Map(VISUAL_RULES.map((r) => [r.id, r.reveal]))

const rules = eligibleRules(input)
const boards: VisualCandidate[] = []
const failed: string[] = []
let built = 0
for (const rule of rules) {
  let first: VisualCandidate | null = null
  for (let seed = 1; seed <= ATTEMPTS_PER_RULE; seed++) {
    const board = buildBoard(rule, input, seed)
    if (!board) continue
    built++
    if (!first) first = board
  }
  if (first) boards.push(first)
  else failed.push(rule.id)
}

function describe(c: VisualCandidate, index: number): string {
  const clues = (label: 'IN' | 'OUT') =>
    c.clues
      .filter((x) => x.label === label)
      .map((x) => nameOf.get(x.wordId))
      .join(', ')
  const decoys = c.liveDecoys.map((d) => `${d.negated ? 'NOT ' : ''}${revealOf.get(d.ruleId)}`)
  return [
    `### ${index + 1}. ${revealOf.get(c.ruleId)} (${c.ruleId}, seed ${c.generatorSeed})`,
    `Clues — IN: ${clues('IN')} | OUT: ${clues('OUT')}`,
    `Live decoys after clues: ${decoys.join('; ')}`,
    'Pool:',
    ...c.guests.map(
      (g) =>
        `  - ${nameOf.get(g.wordId)} — ${g.trueLabel}${g.trapType ? ` [${g.trapType} trap]` : ''}`
    ),
  ].join('\n')
}

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(join(OUTPUT_DIR, 'visual-candidates.json'), JSON.stringify(boards, null, 2))
writeFileSync(
  join(OUTPUT_DIR, 'visual-candidates.md'),
  [
    `# Visual boards — ${boards.length} of ${rules.length} eligible rules`,
    '',
    ...boards.map(describe),
  ].join('\n\n')
)

const attempts = rules.length * ATTEMPTS_PER_RULE
const yieldShare = attempts === 0 ? 0 : built / attempts
const percent = (n: number) => `${Math.round(n * 100)}%`
console.log(
  `Yield: ${built}/${attempts} attempts produced a board ` +
    `(${percent(yieldShare)}; the gate is ${percent(YIELD_GATE)}).`
)
console.log(
  `Coverage: ${boards.length}/${rules.length} eligible rules produced at least one board ` +
    `(${percent(rules.length === 0 ? 0 : boards.length / rules.length)}).`
)
console.log(`No board: ${failed.length > 0 ? failed.join(', ') : 'none'}`)
console.log(`Written to ${join(OUTPUT_DIR, 'visual-candidates.md')} (and .json)`)
if (yieldShare < YIELD_GATE) process.exit(1)
