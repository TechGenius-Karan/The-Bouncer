// Phase 4 (build-plan.md): one-time migration/seed script — loads the word
// bank and rule taxonomy into MongoDB, and writes a handful of Phase
// 3-generated candidate puzzles in as "approved" (bypassing the
// not-yet-built admin tool from Phase 6) so there's real data for the
// Netlify Functions to serve. Run with: npm run content:seed-db [count]

import 'dotenv/config'
import { getCollections } from '../../netlify/functions/_shared/db'
import type { PuzzleDoc, RuleDoc, WordDoc } from '../../netlify/functions/_shared/types'
import { generateBatchCore } from '../generator/batch'
import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'

const PUZZLE_COUNT = Number(process.argv[2]) || 5

async function main() {
  const { words, rules, puzzles } = await getCollections()

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
  await rules.bulkWrite(
    ruleDocs.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    })),
  )

  console.log(`Generating ${PUZZLE_COUNT} candidate puzzles...`)
  const batch = generateBatchCore(PUZZLE_COUNT, ['medium', 'spicy'])
  if (batch.length < PUZZLE_COUNT) {
    console.warn(`Only generated ${batch.length}/${PUZZLE_COUNT} candidates.`)
  }

  const existingCount = await puzzles.countDocuments()
  const puzzleDocs: PuzzleDoc[] = batch.map((candidate, i) => ({
    number: existingCount + i + 1,
    difficultyTier: candidate.difficultyTier,
    ruleId: candidate.ruleId,
    status: 'approved',
    clues: candidate.clues,
    guests: candidate.guests,
    createdAt: new Date(),
  }))

  if (puzzleDocs.length > 0) {
    console.log(`Inserting ${puzzleDocs.length} puzzles as "approved"...`)
    await puzzles.insertMany(puzzleDocs)
  }

  const totalApproved = await puzzles.countDocuments({ status: 'approved' })
  console.log(`Done. ${totalApproved} approved puzzles now available in total.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
