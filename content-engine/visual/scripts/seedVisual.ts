// Loads the visual item captions and rules into MongoDB (planning-visual-pivot.md
// §5.3). Upserts only: nothing is ever deleted, and word documents are never
// touched. Retired rules and blocked items are written too, because a puzzle
// that already used one still needs its reveal text and captions.
// Run with: npm run content:seed-visual

import 'dotenv/config'
import { getCollections } from '../../../netlify/functions/_shared/db.js'
import { ITEMS } from '../items.js'
import { VISUAL_RULES } from '../rules.js'
import { validateItems } from '../validateItems.js'

async function main() {
  const problems = validateItems(ITEMS)
  if (problems.length > 0) {
    for (const p of problems) console.error(`INVALID  ${p}`)
    process.exit(1)
  }
  const { rules, visualItems } = await getCollections()

  console.log(`Upserting ${ITEMS.length} visual items...`)
  await visualItems.bulkWrite(
    ITEMS.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { name: item.name } },
        upsert: true,
      },
    }))
  )

  console.log(`Upserting ${VISUAL_RULES.length} visual rules...`)
  // $set, like seedDatabase.ts, so a live field set on a rule doc elsewhere
  // survives a re-seed. `subtlety` is required by RuleDoc; visual rules have
  // none (D7), so it is 0.
  await rules.bulkWrite(
    VISUAL_RULES.map((rule) => ({
      updateOne: {
        filter: { _id: rule.id },
        update: {
          $set: {
            name: rule.reveal,
            descriptionTemplate: rule.reveal,
            family: 'visual',
            subtlety: 0,
          },
        },
        upsert: true,
      },
    }))
  )

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
