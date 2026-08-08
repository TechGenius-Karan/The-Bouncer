// Phase 2 review checkpoint (build-plan.md): run each rule evaluator against
// the seed word list and print the IN/OUT split so we can eyeball it before
// building the generator on top. Run with: npm run content:print-rules

import { RULES } from '../rules'
import { buildWordBank } from '../words/wordBank'

const bank = buildWordBank()

for (const rule of RULES) {
  const inWords = bank.filter((w) => rule.evaluate(w)).map((w) => w.spelling)
  const outWords = bank.filter((w) => !rule.evaluate(w)).map((w) => w.spelling)

  console.log(`\n=== ${rule.name} (${rule.id}, subtlety ${rule.subtlety}) ===`)
  console.log(rule.descriptionTemplate)
  console.log(`IN  (${inWords.length}): ${inWords.join(', ')}`)
  console.log(`OUT (${outWords.length}): ${outWords.slice(0, 15).join(', ')}${outWords.length > 15 ? ', ...' : ''}`)
}
