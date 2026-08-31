// ai-feedback-plan.md §11 phase 2: manually exercise getAiReviewDecision
// against real pending puzzles before wiring any HTTP endpoint — mirrors
// how queuePuzzles.ts/tagWords.ts are CLI-testable outside the app.
// Run with: npm run content:test-ai-review -- [count] ["a fake reviewer reason"]

import 'dotenv/config'
import { RULES } from '../rules'
import { shuffle } from '../generator/random'
import { buildWordBank } from '../words/wordBank'
import { getCollections } from '../../netlify/functions/_shared/db'
import { resolveFullPuzzleDetail } from '../../netlify/functions/_shared/adminPuzzleDetail'
import { getAiReviewDecision } from '../../netlify/functions/_shared/aiReview'

const SAMPLE_COUNT = Number(process.argv[2]) || 3
const REASON = process.argv[3] ?? 'This rule is too easy to guess by elimination after seeing the clues.'

async function main() {
  const { puzzles } = await getCollections()
  const docs = await puzzles.find({ status: 'pending_approval' }).limit(SAMPLE_COUNT).toArray()

  if (docs.length === 0) {
    console.log('No pending_approval puzzles to test against. Run "npm run content:queue-puzzles" first.')
    process.exit(0)
  }

  const wordBank = buildWordBank()

  for (const doc of docs) {
    const detail = await resolveFullPuzzleDetail(doc)
    const rule = RULES.find((r) => r.id === doc.ruleId)
    const usedIds = new Set([...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)])
    const available = wordBank.filter((w) => !w.safety.blocked && !usedIds.has(w.id))
    const inWordMenu = rule
      ? shuffle(available.filter((w) => rule.evaluate(w)))
          .slice(0, 100)
          .map((w) => ({ word: w.spelling, ...(rule.variantOf?.(w) ? { variant: rule.variantOf(w)! } : {}) }))
      : []
    const outWordMenu = rule ? shuffle(available.filter((w) => !rule.evaluate(w))).slice(0, 40).map((w) => w.spelling) : []

    console.log(`\n=== ${detail.ruleName} (${detail.difficultyTier}) — puzzle ${detail.puzzleId} ===`)
    console.log(`Reason given: "${REASON}"`)
    const { decision, rawResponse } = await getAiReviewDecision({
      puzzle: detail,
      reason: REASON,
      inWordMenu,
      outWordMenu,
    })
    console.log('Decision:', decision)
    if (rawResponse) console.log('Raw response:', rawResponse)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
