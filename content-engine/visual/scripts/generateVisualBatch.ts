// Phase 3's yield gate (planning-visual-pivot.md §6): one board attempt per
// eligible rule, written to content-engine/output/ for reading through.
// Offline: nothing is queued and no database is read, so every rule counts as
// unused. Yield = rules that produced a board / eligible rules.
// Run with: npm run content:generate-visual

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBoard, eligibleRules, type GeneratorInput } from '../generator.js'
import { ITEMS } from '../items.js'
import { batchSeed } from '../random.js'
import { VISUAL_RULES } from '../rules.js'
import { MATRIX } from '../tags/index.js'
import type { VisualCandidate } from '../types.js'

const YIELD_GATE = 0.75
const OUTPUT_DIR = join(process.cwd(), 'content-engine', 'output')
const today = new Date().toISOString().slice(0, 10)

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
rules.forEach((rule, index) => {
  const board = buildBoard(rule, input, batchSeed(today, index))
  if (board) boards.push(board)
  else failed.push(rule.id)
})

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

const share = rules.length === 0 ? 0 : boards.length / rules.length
console.log(
  `Yield: ${boards.length}/${rules.length} eligible rules produced a board ` +
    `(${Math.round(share * 100)}%; the gate is ${YIELD_GATE * 100}%).`
)
if (failed.length > 0) console.log(`No board: ${failed.join(', ')}`)
console.log(`Written to ${join(OUTPUT_DIR, 'visual-candidates.md')} (and .json)`)
if (share < YIELD_GATE) process.exit(1)
