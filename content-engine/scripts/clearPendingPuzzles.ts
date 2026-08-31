// Clears the review queue without touching anything already approved or
// scheduled — unlike resetPuzzles.ts, which wipes every puzzle and result.
//
// Needed because pending candidates go stale whenever the taxonomy or word
// bank changes: they were built against rules and words that may no longer
// exist, so reviewing them is wasted effort. `--stale` additionally removes
// puzzles of ANY status whose rule id is gone from the taxonomy — those can't
// render a correct reveal, so an approved one is a live bug rather than just
// clutter.
//
// Dry run by default; pass --yes to actually delete.
// Run with: npm run content:clear-pending -- --yes [--stale]

import 'dotenv/config'
import { RULES } from '../rules'
import { getCollections } from '../../netlify/functions/_shared/db'

const CONFIRMED = process.argv.includes('--yes')
const INCLUDE_STALE = process.argv.includes('--stale')

async function main() {
  const { puzzles } = await getCollections()
  const knownRuleIds = new Set(RULES.map((r) => r.id))

  const pending = await puzzles.countDocuments({ status: 'pending_approval' })
  console.log(`Pending review: ${pending}`)

  let staleIds: unknown[] = []
  if (INCLUDE_STALE) {
    const others = await puzzles
      .find({ status: { $ne: 'pending_approval' } }, { projection: { ruleId: 1, status: 1, number: 1 } })
      .toArray()
    const stale = others.filter((p) => !knownRuleIds.has(p.ruleId))
    staleIds = stale.map((p) => p._id)
    console.log(`Non-pending puzzles referencing a removed rule: ${stale.length}`)
    for (const p of stale) console.log(`  #${p.number ?? '-'} (${p.status}) rule "${p.ruleId}"`)
  }

  if (!CONFIRMED) {
    console.log('\nDry run — nothing deleted. Re-run with --yes to apply.')
    process.exit(0)
  }

  const cleared = await puzzles.deleteMany({ status: 'pending_approval' })
  console.log(`\nDeleted ${cleared.deletedCount} pending puzzle(s).`)
  if (staleIds.length > 0) {
    const staleDelete = await puzzles.deleteMany({ _id: { $in: staleIds as never[] } })
    console.log(`Deleted ${staleDelete.deletedCount} stale non-pending puzzle(s).`)
  }
  console.log('Approved/scheduled puzzles on live rules were left untouched.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
