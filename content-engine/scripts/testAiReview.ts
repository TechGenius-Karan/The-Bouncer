// ai-feedback-plan.md §11 phase 2: manually exercise getAiReviewDecision
// against real pending puzzles before wiring any HTTP endpoint — mirrors
// how queuePuzzles.ts/tagWords.ts are CLI-testable outside the app.
//
// Run with:
//   npm run content:test-ai-review -- [--rule=<substring>] [--count=<n>] <reason...>
//
// Everything that isn't a flag is joined into the reason, so the reason needs
// no quoting and cannot be mangled by whichever shell is in play. That is not
// cosmetic: with positional arguments, a reason the shell split on spaces
// silently pushed a stray word into the rule filter, and the run then tested
// puzzles nobody asked for.
//
// --rule matters more than it looks. Without it this takes whatever is first
// in the pending queue, and feedback is usually specific to a KIND of puzzle —
// asking "vary which number is hidden" about an "Is an animal" puzzle earns a
// correct agree-reject that tells you nothing about whether refine works.
//
//   npm run content:test-ai-review -- --rule=hidden-word --count=3 vary which number is hidden

import 'dotenv/config'
import { RULES } from '../rules'
import { buildReviewMenus } from '../generator/aiReviewMenu'
import { buildWordBank } from '../words/wordBank'
import { getCollections } from '../../netlify/functions/_shared/db'
import { resolveFullPuzzleDetail } from '../../netlify/functions/_shared/adminPuzzleDetail'
import { getAiReviewDecision } from '../../netlify/functions/_shared/aiReview'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')

const RULE_FILTER = flag('rule')?.toLowerCase()
const positional = args.filter((a) => !a.startsWith('--'))
// A leading bare number still means count, so the old `-- 3 <reason>` form keeps working.
const leadingCount = positional[0] !== undefined && /^\d+$/.test(positional[0])
const SAMPLE_COUNT = Number(flag('count') ?? (leadingCount ? positional[0] : 3)) || 3
const reasonWords = leadingCount && !flag('count') ? positional.slice(1) : positional
const REASON =
  reasonWords.join(' ').trim() ||
  'This rule is too easy to guess by elimination after seeing the clues.'

// Match the endpoint's own menu sizes — this script exists to reproduce what
// admin-ai-review.ts does, so anything it does differently is a blind spot.
const IN_MENU_SIZE = 100
const OUT_MENU_SIZE = 40

async function main() {
  // Echo what was parsed. The failure mode this replaces was silent: a
  // shell-split reason turned into a rule filter and the run looked fine.
  console.log(`rule filter: ${RULE_FILTER ?? '(none — first pending puzzles)'}`)
  console.log(`count:       ${SAMPLE_COUNT}`)
  console.log(`reason:      "${REASON}"`)

  const { puzzles } = await getCollections()
  const query = RULE_FILTER
    ? {
        status: 'pending_approval' as const,
        $or: [
          { ruleId: { $regex: RULE_FILTER, $options: 'i' } },
          { templateId: { $regex: RULE_FILTER, $options: 'i' } },
        ],
      }
    : { status: 'pending_approval' as const }
  const docs = await puzzles.find(query).limit(SAMPLE_COUNT).toArray()

  if (docs.length === 0) {
    if (RULE_FILTER) {
      const pending = await puzzles.distinct('ruleId', { status: 'pending_approval' })
      console.log(`No pending puzzle matches "${RULE_FILTER}". Pending rules are:`)
      console.log(`  ${pending.sort().join(', ') || '(none)'}`)
    } else {
      console.log(
        'No pending_approval puzzles to test against. Run "npm run content:queue-puzzles" first.'
      )
    }
    process.exit(0)
  }

  const wordBank = buildWordBank()

  for (const doc of docs) {
    const detail = await resolveFullPuzzleDetail(doc)
    const rule = RULES.find((r) => r.id === doc.ruleId)
    const { inWordMenu, outWordMenu, pinnedNamed, requestedMissing } = rule
      ? buildReviewMenus(
          rule,
          wordBank,
          REASON,
          [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)],
          { in: IN_MENU_SIZE, out: OUT_MENU_SIZE }
        )
      : { inWordMenu: [], outWordMenu: [], pinnedNamed: [], requestedMissing: [] }

    console.log(
      `\n=== ${detail.ruleName} (${detail.difficultyTier}) — puzzle ${detail.puzzleId} ===`
    )
    console.log(`Rule id: ${doc.ruleId}`)
    console.log(
      `IN clues:  ${detail.clues
        .filter((c) => c.label === 'IN')
        .map((c) => c.word)
        .join(', ')}`
    )
    console.log(
      `OUT clues: ${detail.clues
        .filter((c) => c.label === 'OUT')
        .map((c) => c.word)
        .join(', ')}`
    )
    console.log(`Pool:      ${detail.guests.map((g) => `${g.word}(${g.trueLabel})`).join(', ')}`)
    console.log(`Reason given: "${REASON}"`)
    if (pinnedNamed.length > 0)
      console.log(`Named words pinned into the menu: ${pinnedNamed.join(', ')}`)
    if (requestedMissing.length > 0)
      console.log(`Named words genuinely absent from the bank: ${requestedMissing.join(', ')}`)

    const { decision, rawResponse } = await getAiReviewDecision({
      puzzle: detail,
      reason: REASON,
      inWordMenu,
      outWordMenu,
      pinnedNamed,
      requestedMissing,
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
