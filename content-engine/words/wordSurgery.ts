import type { Word } from './types.js'

// Bank-wide lexical facts: the ones whose answer is "yes, and what's left is
// also a word". buildLetterFeatures works from one spelling and cannot see the
// rest of the bank, so these are tagged in a post-pass over the built words —
// the pattern `lexical:has-anagram` already established.
//
// This is the data behind a whole mechanic the game did not previously have.
// Every other lexical rule asks the player to look at a word; these ask them to
// change it and see what comes out.

/**
 * Shortest result worth calling a word.
 *
 * 3, not 4, and the difference is most of the value here. At 4 the cross-product
 * collapsed to four viable cells, all anagrams, because the best beheadings and
 * curtailments land on three-letter words: want -> ant, pear -> ear, ship -> hip,
 * boat -> boa, beer -> bee. Those are exactly the results a player enjoys
 * finding, and exactly the ones that belong to a category.
 *
 * The floor exists at all to stop results that are not really words to a
 * player — and the bank already carries that weight, since a result has to be a
 * bank word to count and the bank has no stopwords or fragments in it.
 *
 * A few matches do land on words a player would not accept: lamp -> lam,
 * milk -> mil. There is deliberately no filter for them, because nothing in the
 * data separates them from the good ones. `frequencyScore` was the obvious
 * candidate and it is actively misleading here — `lam` scores 0.58 and `mil`
 * 0.54, against `adder` 0.32 and `boa` 0.28, so a frequency floor would cut the
 * results worth having and keep the junk. Length does not separate them either:
 * `lam` and `ant` are both three letters. This is what the human approval step
 * in the pipeline is for.
 */
const MIN_RESULT_LENGTH = 3

/**
 * Both halves of a compound must be at least this long.
 *
 * Measured against the real bank, not guessed. At 3 the split finds kit+ten,
 * mag+net, poe+tic and hit+ting — 1,794 matches, mostly coincidence. At 4 it is
 * 876 and still admits basic+ally and opera+ting. At 5 it is 120 and they are
 * almost all real: earthquake, spacecraft, strawberry, motorcycle, lighthouse,
 * grandmother, wristwatch. 120 clears the coverage floor of 25 with room to
 * spare, so there is no reason to accept the noisier threshold.
 */
const MIN_COMPOUND_HALF = 5

export const SURGERY_OPERATIONS = ['reverse', 'behead', 'curtail', 'anagram'] as const
export type SurgeryOperation = (typeof SURGERY_OPERATIONS)[number]

export const SURGERY_TAG: Record<SurgeryOperation, string> = {
  reverse: 'lexical:reverses-into-word',
  behead: 'lexical:behead-into-word',
  curtail: 'lexical:curtail-into-word',
  // Deliberately unchanged from the original post-pass: the `has-anagram` rule
  // and every puzzle already approved against it read this exact string.
  anagram: 'lexical:has-anagram',
}

export const COMPOUND_TAG = 'lexical:compound'

/** "lexical:behead-animal" — beheading this word leaves something in that category. */
export function surgeryCategoryTag(op: SurgeryOperation, categoryId: string): string {
  return `lexical:${op}-${categoryId}`
}

const CATEGORY_PREFIX = 'category:'

/**
 * The words a given operation turns this word into, where the result is itself
 * in the bank. Empty when the operation produces nothing usable.
 */
function resultsOf(
  word: Word,
  op: SurgeryOperation,
  bySpelling: Map<string, Word>,
  bySignature: Map<string, Word[]>
): Word[] {
  const s = word.spelling
  const lookup = (candidate: string): Word[] => {
    if (candidate.length < MIN_RESULT_LENGTH || candidate === s) return []
    const hit = bySpelling.get(candidate)
    return hit ? [hit] : []
  }

  switch (op) {
    case 'reverse':
      return lookup([...s].reverse().join(''))
    case 'behead':
      return lookup(s.slice(1))
    case 'curtail':
      // A final -s is a plural or a verb form, not wordplay: "hands" -> "hand"
      // and "eyes" -> "eye" would otherwise flood this with inflections and
      // teach the player to look for a grammar pattern. Same judgement
      // TRIVIAL_SUFFIXES makes for hidden words.
      return s.endsWith('s') ? [] : lookup(s.slice(0, -1))
    case 'anagram':
      return (bySignature.get(word.features.anagramSignature) ?? []).filter(
        (other) => other.spelling !== s
      )
  }
}

function isCompound(word: Word, bySpelling: Map<string, Word>): boolean {
  const s = word.spelling
  for (let i = MIN_COMPOUND_HALF; i <= s.length - MIN_COMPOUND_HALF; i++) {
    if (bySpelling.has(s.slice(0, i)) && bySpelling.has(s.slice(i))) return true
  }
  return false
}

/**
 * Adds the bank-wide `lexical:*` tags in place.
 *
 * Two kinds at once. The plain ones ("reversing this gives a word") carry the
 * word-surgery rules; the crossed ones ("beheading this gives an animal") carry
 * the lexical-semantic hybrids, which are the thing Connections structurally
 * cannot express — it can name the target set but not the operation.
 */
export function tagWordSurgery(words: Word[]): void {
  const bySpelling = new Map(words.map((w) => [w.spelling, w]))
  const bySignature = new Map<string, Word[]>()
  for (const w of words) {
    const group = bySignature.get(w.features.anagramSignature)
    if (group) group.push(w)
    else bySignature.set(w.features.anagramSignature, [w])
  }

  // Snapshotted before anything is written, so a tag this pass adds can never
  // be read as input to another one.
  const categoriesOf = new Map(
    words.map((w) => [
      w.spelling,
      w.tags.filter((t) => t.startsWith(CATEGORY_PREFIX)).map((t) => t.slice(CATEGORY_PREFIX.length)),
    ])
  )

  for (const word of words) {
    for (const op of SURGERY_OPERATIONS) {
      const results = resultsOf(word, op, bySpelling, bySignature)
      if (results.length === 0) continue
      word.tags.push(SURGERY_TAG[op])
      const categories = new Set(results.flatMap((r) => categoriesOf.get(r.spelling) ?? []))
      for (const categoryId of categories) word.tags.push(surgeryCategoryTag(op, categoryId))
    }
    if (isCompound(word, bySpelling)) word.tags.push(COMPOUND_TAG)
  }
}
