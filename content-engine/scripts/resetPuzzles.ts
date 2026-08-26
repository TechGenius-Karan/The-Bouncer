// Pre-deployment fresh-start tool — wipes the `puzzles` and `results`
// collections so the next generated puzzle starts back at #1 (PuzzleDoc.number
// is just `countDocuments() + i + 1` at generation time, see queuePuzzles.ts /
// scheduled-generate-puzzles.ts — there's no separate counter to reset).
// `results` is wiped alongside `puzzles` rather than left behind: results
// reference puzzleId with no DB-level foreign key, and there are no player
// accounts (userId is always null), so old results would just become
// unreachable orphans with nothing worth preserving.
//
// Deliberately CLI-only, not an admin HTTP endpoint — a one-click "wipe
// everything" button in a deployed admin UI is a foot-gun this tool doesn't
// need. Defaults to a dry-run preview; pass --yes to actually delete.
// Run with: npm run content:reset-puzzles -- --yes

import 'dotenv/config'
import { getCollections } from '../../netlify/functions/_shared/db'

const CONFIRMED = process.argv.includes('--yes')

async function main() {
  const { puzzles, results } = await getCollections()

  const puzzleCount = await puzzles.countDocuments()
  const resultCount = await results.countDocuments()

  console.log(`Found ${puzzleCount} puzzle(s) and ${resultCount} result(s).`)

  if (!CONFIRMED) {
    console.log('Dry run only — nothing deleted. Re-run with --yes to actually wipe both collections.')
    process.exit(0)
  }

  const puzzleDelete = await puzzles.deleteMany({})
  const resultDelete = await results.deleteMany({})

  console.log(`Deleted ${puzzleDelete.deletedCount} puzzle(s) and ${resultDelete.deletedCount} result(s).`)
  console.log('The next generated puzzle will start at #1. `words` and `rules` were left untouched.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
