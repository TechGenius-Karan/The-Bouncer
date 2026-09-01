import { CATEGORY_DEFINITIONS, CATEGORY_IDS, categoryTag } from './categories'

// Pure prompt-building and response validation for the AI category tagger.
// Kept separate from the script that calls the API so the part that decides
// what the model is ALLOWED to assert is unit-testable without a network call
// — the same testable-core / thin-wrapper split as repairWord and
// aiReviewAction.

export interface TaggedWord {
  word: string
  /** Category ids (not full tags) — validated against CATEGORY_IDS. */
  categories: string[]
}

export function buildTaggingPrompt(words: string[]): string {
  const categoryLines = CATEGORY_DEFINITIONS.map((c) => `- ${c.id}: ${c.definition}`).join('\n')
  return `You are tagging words for a word puzzle. For each word below, list which of these
categories it belongs to. Most words belong to NONE — that is the normal answer.

CATEGORIES:
${categoryLines}

RULES:
1. Tag only the word's DOMINANT, everyday sense — the meaning an ordinary person
   reaches for first. A technically-correct secondary sense is NOT enough.
   - "screwdriver" is a tool, NOT a drink (the cocktail is a secondary sense).
   - "temple" is a building, NOT a body part.
   - "coffee" is a drink, NOT a fruit.
   - "crane" is a bird AND a vehicle only if both readings are genuinely common.
2. Tag the thing itself, not things associated with it. "medical" is not an
   illness; "cooking" is not a food; "musical" is not an instrument.
3. NEVER tag the general concept word itself — only specific examples of it.
   - "time" is NOT a period of time; "hour" and "week" are.
   - "job" is NOT a profession; "doctor" and "farmer" are.
   - "body" is NOT a body part; "elbow" and "liver" are.
   - "game" is NOT a toy or game; "chess" and "checkers" are.
   - "animal", "plant", "food", "colour", "shape" are likewise NOT members of
     their own categories.
4. An event, collection or state is not the thing itself.
   - "banquet" is a meal event, NOT a food.
   - "bouquet" is an arrangement, NOT a flower.
   - "acorn" is a seed, NOT a plant.
   - "sick" is a state, NOT an illness. "ill", "healthy" likewise.
5. Only the word exactly as given. Do not tag a different form of it.
6. If you are unsure, leave it untagged. A missing tag costs far less than a
   wrong one — a wrong tag makes a puzzle mark a correct answer wrong.
7. Return every word from the list, using an empty array for untagged ones.

WORDS:
${words.join(', ')}`
}

/**
 * Validates an untrusted parsed-JSON tagging response.
 *
 * Never throws. Anything the model returns that isn't a word we actually asked
 * about, or a category from the fixed list, is dropped rather than trusted —
 * hallucinated words and invented categories are the two failure modes that
 * would otherwise flow straight into the word bank.
 */
/**
 * Words that name a category rather than belonging to one. Tagging these makes
 * a puzzle trivially guessable at best and wrong at worst — an "is a
 * profession" puzzle with "job" as an IN word teaches the player nothing and
 * marks a reasonable OUT answer wrong. The prompt forbids it too; this is the
 * belt-and-braces half, because it's a systematic model failure rather than a
 * one-off, and it's cheap to make impossible instead of merely discouraged.
 */
const GENERIC_TERMS = new Set([
  'time',
  'job',
  'work',
  'body',
  'game',
  'thing',
  'stuff',
  'item',
  'object',
  'person',
  'people',
  'place',
  'area',
  'part',
  'type',
  'kind',
  'sort',
  'form',
  'group',
  'unit',
  'piece',
  'material',
  'substance',
  'creature',
  'species',
])

export function parseTaggingResponse(raw: unknown, requested: string[]): TaggedWord[] {
  if (!Array.isArray(raw)) return []
  const askedFor = new Set(requested)
  const validCategories = new Set(CATEGORY_IDS)
  const seen = new Set<string>()
  const out: TaggedWord[] = []

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const obj = entry as Record<string, unknown>
    const word = typeof obj.word === 'string' ? obj.word.trim().toLowerCase() : ''
    if (!askedFor.has(word) || seen.has(word)) continue
    if (!Array.isArray(obj.categories)) continue
    // A generic term names categories rather than belonging to any.
    if (GENERIC_TERMS.has(word)) {
      seen.add(word)
      continue
    }

    const categories = [
      ...new Set(
        obj.categories.filter(
          (c): c is string =>
            typeof c === 'string' &&
            validCategories.has(c) &&
            // Self-reference: "plant" is not an example of a plant, "room" is
            // not a room. Always a giveaway, never informative.
            c !== word
        )
      ),
    ]
    seen.add(word)
    if (categories.length > 0) out.push({ word, categories })
  }
  return out
}

/** Converts validated category ids into the `category:x` tags the word bank stores. */
export function toTagRecord(tagged: TaggedWord[]): Record<string, string[]> {
  const record: Record<string, string[]> = {}
  for (const { word, categories } of tagged) record[word] = categories.map(categoryTag)
  return record
}
