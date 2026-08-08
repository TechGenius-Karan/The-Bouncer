// Phase 3 review checkpoint (build-plan.md): generate a batch of candidate
// puzzles across both difficulty tiers and dump them for manual read-through.
// Run with: npm run content:generate -- [count]

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateBatchCore } from '../generator/batch'
import type { CandidatePuzzle } from '../generator/types'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'

const COUNT = Number(process.argv[2]) || 20
const OUTPUT_DIR = join(process.cwd(), 'content-engine', 'output')

const wordBank = buildWordBank()
const wordsById = new Map(wordBank.map((w) => [w.id, w]))
const rulesById = new Map(RULES.map((r) => [r.id, r]))

function spellingOf(wordId: string): string {
  return wordsById.get(wordId)?.spelling ?? wordId
}

function describeCandidate(candidate: CandidatePuzzle, index: number): string {
  const rule = rulesById.get(candidate.ruleId)!
  const clueIn = candidate.clues.filter((c) => c.label === 'IN').map((c) => spellingOf(c.wordId))
  const clueOut = candidate.clues.filter((c) => c.label === 'OUT').map((c) => spellingOf(c.wordId))
  const decoyNames = candidate.liveDecoys.map((d) => rulesById.get(d.ruleId)?.name ?? d.ruleId)

  const lines = [
    `### ${index + 1}. [${candidate.difficultyTier.toUpperCase()}] ${rule.name} (subtlety ${rule.subtlety})`,
    `Rule: ${rule.descriptionTemplate}`,
    `Clues — IN: ${clueIn.join(', ')} | OUT: ${clueOut.join(', ')}`,
    `Live decoys after clues: ${decoyNames.length > 0 ? decoyNames.join(', ') : 'none'}`,
    'Pool:',
    ...candidate.guests.map((g) => {
      const tag = g.trapType ? ` [${g.trapType} trap]` : ''
      return `  - ${spellingOf(g.wordId)} — ${g.trueLabel}${tag}`
    }),
  ]
  return lines.join('\n')
}

const batch = generateBatchCore(COUNT, ['medium', 'spicy'])

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(join(OUTPUT_DIR, 'candidates.json'), JSON.stringify(batch, null, 2))

const summary = [
  `# Candidate batch — ${batch.length} puzzles (requested ${COUNT})`,
  '',
  ...batch.map((c, i) => describeCandidate(c, i)),
].join('\n\n')
writeFileSync(join(OUTPUT_DIR, 'candidates.md'), summary)

console.log(`Generated ${batch.length}/${COUNT} candidates.`)
console.log(`Written to ${join(OUTPUT_DIR, 'candidates.json')} and candidates.md`)
if (batch.length < COUNT) {
  console.warn(
    `Warning: only ${batch.length} of ${COUNT} requested candidates could be generated — the seed word bank may be running low for some rules.`,
  )
}
