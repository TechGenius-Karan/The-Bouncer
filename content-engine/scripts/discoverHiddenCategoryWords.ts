// Phase 10.6 brainstorm: the "hidden category word" rule idea — a lexical
// mechanism (substring, at a start/end position) searching for a
// semantically curated target list (e.g. an animal name hidden inside
// another word), rather than an arbitrary string list. Read-only discovery
// tool, not wired into any rule yet — writes candidates for a human to look
// through and decide which (if any) are worth turning into a real rule.
// Deliberately lightweight (no test file) — this is exploratory, lower
// priority than the main rule/word-bank pipeline.
// Run with: npm run content:discover-hidden-category-words

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildWordBank } from '../words/wordBank'

const OUTPUT_DIR = join(process.cwd(), 'content-engine', 'output')

// Trivial direct inflections of the target itself (dog->dogs, hand->handy)
// aren't a "hidden" coincidence, just grammar. Words that merely start/end
// with the same letters for an unrelated reason (car->carpet, crow->crowd,
// legacy->leg) are kept — that's the actual fun case this is looking for.
const TRIVIAL_SUFFIXES = ['s', 'es', 'ed', 'ing', 'er', 'y', 'ly', 'less', 'ful']
function isTrivialInflection(host: string, target: string): boolean {
  return TRIVIAL_SUFFIXES.some((suf) => host === target + suf)
}

interface Hit {
  host: string
  target: string
  pos: 'start' | 'end' | 'middle'
}

function findHits(bank: ReturnType<typeof buildWordBank>, members: string[]): Hit[] {
  const memberSet = new Set(members)
  const hits: Hit[] = []
  for (const host of bank) {
    if (memberSet.has(host.spelling)) continue
    for (const target of members) {
      const idx = host.spelling.indexOf(target)
      if (idx === -1) continue
      if (isTrivialInflection(host.spelling, target)) continue
      const pos =
        idx === 0 ? 'start' : idx + target.length === host.spelling.length ? 'end' : 'middle'
      hits.push({ host: host.spelling, target, pos })
    }
  }
  return hits
}

function main() {
  const bank = buildWordBank()
  const categoryTags = new Set<string>()
  for (const w of bank) for (const t of w.tags) if (t.startsWith('category:')) categoryTags.add(t)

  const lines = [
    '# Hidden-category-word discovery',
    '',
    `Word bank: ${bank.length} words. Categories checked: ${[...categoryTags].sort().join(', ')}.`,
    '',
    '**Not a rule yet.** Position (start/end) should be picked deliberately per',
    'category, not multiplied automatically — see build-plan.md Phase 10.6.',
    '',
  ]

  for (const tag of [...categoryTags].sort()) {
    const members = bank.filter((w) => w.tags.includes(tag)).map((w) => w.spelling)
    const hits = findHits(bank, members)
    const starts = hits.filter((h) => h.pos === 'start')
    const ends = hits.filter((h) => h.pos === 'end')
    lines.push(`## ${tag} (${hits.length} hits)`)
    lines.push(
      `- start (${starts.length}): ${starts.map((h) => `${h.host}(${h.target})`).join(', ') || '_none_'}`
    )
    lines.push(
      `- end (${ends.length}): ${ends.map((h) => `${h.host}(${h.target})`).join(', ') || '_none_'}`
    )
    lines.push('')
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(join(OUTPUT_DIR, 'hiddenCategoryWords.md'), lines.join('\n'))
  console.log(`Written to ${join(OUTPUT_DIR, 'hiddenCategoryWords.md')}`)
}

main()
