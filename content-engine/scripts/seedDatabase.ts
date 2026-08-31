// One-time-ish migration script — loads the word bank and rule taxonomy
// into MongoDB. Run this whenever the taxonomy changes, not routinely.
//
// This used to also generate and insert puzzle candidates directly as
// "approved," bypassing review entirely — that shortcut existed only
// because the real admin tool (Phase 6) didn't exist yet. Now that it does,
// bootstrapping a fresh environment is a four-step chain instead of one
// command: this script (words/rules) -> `content:queue-puzzles` (generates
// a pending_approval batch) -> approve through the /admin review screen ->
// `content:schedule` (assigns real dates to approved puzzles, unchanged).
// Run with: npm run content:seed-db

import 'dotenv/config'
import { getCollections } from '../../netlify/functions/_shared/db'
import type { RuleDoc, WordDoc } from '../../netlify/functions/_shared/types'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'

async function main() {
  const { words, rules } = await getCollections()

  const wordBank = buildWordBank()
  const wordDocs: WordDoc[] = wordBank.map((w) => ({
    _id: w.id,
    spelling: w.spelling,
    length: w.length,
    frequencyScore: w.frequencyScore,
    partOfSpeech: w.partOfSpeech,
    tags: w.tags,
    safety: w.safety,
  }))

  const ruleDocs: RuleDoc[] = RULES.map((r) => ({
    _id: r.id,
    name: r.name,
    descriptionTemplate: r.descriptionTemplate,
    family: r.family,
    subtlety: r.subtlety,
  }))

  console.log(`Upserting ${wordDocs.length} words...`)
  await words.bulkWrite(
    wordDocs.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    })),
  )

  console.log(`Upserting ${ruleDocs.length} rules...`)
  // $set (not replaceOne) — a rule can carry a live subtletyOverride
  // toggle (ai-feedback-plan.md) that this script must never wipe out on a
  // routine re-seed after the taxonomy changes; only the code-defined fields
  // below are touched.
  await rules.bulkWrite(
    ruleDocs.map((doc) => ({
      updateOne: { filter: { _id: doc._id }, update: { $set: doc }, upsert: true },
    })),
  )

  console.log('Done. Run "npm run content:queue-puzzles" next to generate puzzles for review.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
