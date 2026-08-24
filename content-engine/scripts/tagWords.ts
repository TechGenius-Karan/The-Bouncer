// Step 3 (build-plan.md Phase 10.5 §2): propose category/property tags for
// every seed word by testing membership against a curated target list.
// Output is *suggested* tags for human review (Step 4) — never written
// back into seedWords.ts directly.
// Run with: npm run content:tag-words

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { suggestCategoryTag, suggestPropertyTag, type TagSuggestion } from '../words/tagSuggestion'
import { buildWordBank } from '../words/wordBank'

const OUTPUT_DIR = join(process.cwd(), 'content-engine', 'output')

// Curated starting list — informed by eyeballing the actual seed word
// bank's likely clusters (animals, buildings, weather/food-adjacent words),
// plus a couple of planning.md §7.1.2's own examples (fruit, tool) even
// where the seed bank may be thin — a low/zero hit count is itself useful
// signal about whether the word bank needs semantic-focused expansion
// later, not a bug in the script.
const CATEGORY_TARGETS = ['animal', 'bird', 'building', 'fruit', 'tool', 'vehicle', 'body part']
const PROPERTY_TARGETS = ['cold', 'hot', 'round', 'sweet', 'loud', 'kitchen']

function describeSuggestion(r: TagSuggestion): string {
  const count = r.matchedWords.length
  const words = count > 0 ? r.matchedWords.join(', ') : '_no matches in the current word bank_'
  return `## ${r.tag} (${count} match${count === 1 ? '' : 'es'})\n${words}`
}

async function main() {
  const wordBank = buildWordBank()
  const seedSpellings = wordBank.map((w) => w.spelling)

  console.log(
    `Tagging ${seedSpellings.length} seed words against ${CATEGORY_TARGETS.length} category and ${PROPERTY_TARGETS.length} property targets...`
  )

  const categoryResults: TagSuggestion[] = []
  for (const term of CATEGORY_TARGETS) {
    categoryResults.push(await suggestCategoryTag(term, seedSpellings))
  }

  const propertyResults: TagSuggestion[] = []
  for (const term of PROPERTY_TARGETS) {
    propertyResults.push(await suggestPropertyTag(term, seedSpellings))
  }

  const allResults = [...categoryResults, ...propertyResults]

  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(join(OUTPUT_DIR, 'suggestedTags.json'), JSON.stringify(allResults, null, 2))

  const summary = [
    `# Suggested word tags — ${allResults.length} target terms tested`,
    '',
    '**Not ground truth.** Every match below needs human review (Step 4) before it',
    'becomes a real tag on a word — WordNet sense mismatches and Datamuse loose',
    'associations both produce false positives. See build-plan.md Phase 10.5 §2.',
    '',
    ...allResults.map(describeSuggestion),
  ].join('\n\n')
  writeFileSync(join(OUTPUT_DIR, 'suggestedTags.md'), summary)

  console.log(`Written to ${join(OUTPUT_DIR, 'suggestedTags.json')} and suggestedTags.md`)
  const totalMatches = allResults.reduce((sum, r) => sum + r.matchedWords.length, 0)
  console.log(`Total suggested tag assignments: ${totalMatches}`)
}

main().catch((err) => {
  console.error('tagWords failed:', err)
  process.exit(1)
})
