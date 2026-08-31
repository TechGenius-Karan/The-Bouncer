/**
 * Thin wrappers around the two external data sources chosen for semantic
 * word tagging (build-plan.md Phase 10.5 §2, Step 2):
 *  - Datamuse (`ml`, `rel_trg`) for *property* associations ("things that
 *    are cold") — confirmed clean in Step 1's exploration script.
 *  - WordNet, via the `natural` package, for *category* membership
 *    ("is a fruit") — resolved through noun-sense hypernym pointers, since
 *    Step 1 found Datamuse's `rel_spc` blends in unrelated figurative
 *    senses for broad/polysemous category words (e.g. "fruit" pulling in
 *    "consequence", "tool" pulling in "agency").
 *
 * Both functions fail soft: a lookup problem for one word (network error,
 * word not found, malformed WordNet data) logs a warning and returns an
 * empty array rather than throwing, so a batch run over hundreds of words
 * (Step 3) doesn't die partway through on one bad entry.
 */
import naturalPkg from 'natural'
import type { PartOfSpeech } from './types'

// `natural` builds its CJS export map dynamically, so Node's ESM interop
// can't see named exports statically — import the default and destructure.
const { WordNet } = naturalPkg as typeof import('natural')

export type DatamuseRelation = 'ml' | 'rel_trg'

export interface DatamuseWord {
  word: string
  score?: number
}

/**
 * Property/association words for `word` via the given Datamuse relation.
 * `ml` (means-like) and `rel_trg` (triggers/co-occurrence) are the two
 * relations Step 1 confirmed give clean, usable output.
 */
export async function fetchDatamuseRelations(
  word: string,
  relation: DatamuseRelation,
  limit = 15
): Promise<DatamuseWord[]> {
  const qs = new URLSearchParams({ [relation]: word, max: String(limit) })
  try {
    const res = await fetch(`https://api.datamuse.com/words?${qs.toString()}`)
    if (!res.ok) {
      console.warn(`Datamuse ${relation}=${word} failed: HTTP ${res.status}`)
      return []
    }
    return (await res.json()) as DatamuseWord[]
  } catch (err) {
    console.warn(`Datamuse ${relation}=${word} failed:`, err)
    return []
  }
}

export interface WordnetRelatedWord {
  /** The related word itself, e.g. "fruit" (a hypernym of "mango") or "mango" (a hyponym of "fruit"). */
  word: string
  /** The gloss of the sense this relation came from, for human review context. */
  senseGloss: string
}

interface WordnetPtr {
  pointerSymbol: string
  synsetOffset: number
  pos: string
}

interface WordnetRecord {
  pos: string
  synonyms: string[]
  gloss: string
  ptrs: WordnetPtr[]
}

export interface WordnetProfile {
  /** WordNet has at least one entry for this spelling. False for corpus junk like "didn"/"isn". */
  known: boolean
  partOfSpeech: PartOfSpeech
  /** Every WordNet sense lists this spelling capitalized (e.g. "Margaret", "Paris"). */
  properNoun: boolean
}

type WordNetInstance = InstanceType<typeof WordNet>

// Sharing one instance avoids re-reading WordNet's index files from disk on
// every lookup.
let sharedWordNet: WordNetInstance | undefined
function getWordNet(): WordNetInstance {
  if (!sharedWordNet) sharedWordNet = new WordNet()
  return sharedWordNet
}

// WordNet pointer symbols for nouns: '@' = hypernym (more general term),
// '~' = hyponym (more specific term). Shared by both directions below.
async function fetchWordnetRelated(
  word: string,
  pointerSymbol: string
): Promise<WordnetRelatedWord[]> {
  const wn = getWordNet()

  let records: WordnetRecord[]
  try {
    records = await lookupWord(wn, word)
  } catch (err) {
    console.warn(`WordNet lookup for "${word}" failed:`, err)
    return []
  }

  const nounSenses = records.filter((r) => r.pos === 'n')
  const results: WordnetRelatedWord[] = []

  for (const sense of nounSenses) {
    const ptrs = sense.ptrs.filter((p) => p.pointerSymbol === pointerSymbol)
    for (const ptr of ptrs) {
      try {
        const relatedRecord = await getSynset(wn, ptr.synsetOffset, ptr.pos || sense.pos)
        for (const synonym of relatedRecord?.synonyms ?? []) {
          results.push({ word: synonym.replace(/_/g, ' '), senseGloss: sense.gloss.trim() })
        }
      } catch (err) {
        console.warn(`WordNet related-word resolution for "${word}" failed:`, err)
      }
    }
  }

  return results
}

/**
 * Category words "above" `word` in WordNet's noun hierarchy (e.g. "fruit"
 * and "produce" for "mango"). Restricted to noun senses only — category-
 * membership rules ("is a fruit") are a noun relationship, and including
 * verb/adjective senses pulled in unrelated hypernyms during Step 1's probe
 * (e.g. "hammer" the verb outranking "hammer" the tool).
 */
export async function fetchWordnetHypernyms(word: string): Promise<WordnetRelatedWord[]> {
  return fetchWordnetRelated(word, '@')
}

/**
 * Category *members* "below" `word` in WordNet's noun hierarchy — the
 * reverse of {@link fetchWordnetHypernyms}. E.g. `fetchWordnetHyponyms('fruit')`
 * surfaces specific fruits like "mango" and "apple". Used (Step 3) to test
 * word-bank membership against a curated target category list, rather than
 * the noisier Datamuse `rel_spc` relation — see Step 1's findings.
 *
 * Only walks one hyponym level. For broad top-level categories that's not
 * enough — see {@link fetchWordnetHyponymsDeep}.
 */
export async function fetchWordnetHyponyms(word: string): Promise<WordnetRelatedWord[]> {
  return fetchWordnetRelated(word, '~')
}

/**
 * Like {@link fetchWordnetHyponyms}, but walks the hyponym tree recursively
 * up to `maxDepth` levels rather than just one. Necessary for broad
 * top-level categories: "animal"'s *direct* WordNet hyponyms are
 * intermediate abstractions like "invertebrate"/"vertebrate", not specific
 * animals like "dog" or "eagle" — those sit several levels further down
 * (animal → chordate → vertebrate → mammal → ...). A single-level lookup
 * for a category like this returns effectively nothing useful, which is
 * exactly what Step 3's first real run against the word bank surfaced.
 * Depth-capped (not unbounded) so a very broad root doesn't pull in
 * thousands of unrelated leaves.
 */
export async function fetchWordnetHyponymsDeep(
  word: string,
  maxDepth = 4
): Promise<WordnetRelatedWord[]> {
  const wn = getWordNet()

  let records: WordnetRecord[]
  try {
    records = await lookupWord(wn, word)
  } catch (err) {
    console.warn(`WordNet lookup for "${word}" failed:`, err)
    return []
  }

  const nounSenses = records.filter((r) => r.pos === 'n')
  const results: WordnetRelatedWord[] = []
  const visited = new Set<string>()

  interface QueueItem {
    synsetOffset: number
    pos: string
    depth: number
    // The *originating* top-level sense's gloss, carried through every
    // descendant so a reviewer sees why a deep result was proposed in
    // terms of the category they searched for, not some intermediate node.
    rootGloss: string
  }
  const queue: QueueItem[] = []

  for (const sense of nounSenses) {
    for (const ptr of sense.ptrs.filter((p) => p.pointerSymbol === '~')) {
      queue.push({
        synsetOffset: ptr.synsetOffset,
        pos: ptr.pos || 'n',
        depth: 1,
        rootGloss: sense.gloss.trim(),
      })
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()!
    const key = `${item.pos}:${item.synsetOffset}`
    if (visited.has(key)) continue
    visited.add(key)

    let record: WordnetRecord
    try {
      record = await getSynset(wn, item.synsetOffset, item.pos)
    } catch (err) {
      console.warn(`WordNet deep-hyponym resolution for "${word}" failed:`, err)
      continue
    }
    if (!record) continue

    for (const synonym of record.synonyms ?? []) {
      results.push({ word: synonym.replace(/_/g, ' '), senseGloss: item.rootGloss })
    }

    if (item.depth < maxDepth) {
      for (const ptr of (record.ptrs ?? []).filter((p) => p.pointerSymbol === '~')) {
        queue.push({
          synsetOffset: ptr.synsetOffset,
          pos: ptr.pos || item.pos,
          depth: item.depth + 1,
          rootGloss: item.rootGloss,
        })
      }
    }
  }

  return results
}

const WORDNET_POS_MAP: Record<string, PartOfSpeech> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  s: 'adjective', // WordNet's "adjective satellite" — grouped with plain adjectives here
  r: 'adverb',
}

/**
 * `word`'s most common part of speech across all its WordNet senses (a
 * majority vote, not just the first sense — sense order isn't reliable,
 * per Step 1's findings). Falls back to `'other'` if WordNet has no entry
 * or the lookup fails; used by `expandWordBank.ts` to bulk-tag words
 * pulled from a frequency corpus that carries no part-of-speech data.
 */
export async function fetchWordnetPartOfSpeech(word: string): Promise<PartOfSpeech> {
  return (await fetchWordnetProfile(word)).partOfSpeech
}

/**
 * One WordNet lookup answering the three things bulk word-bank building
 * needs: does the word exist at all, what is it, and is it a proper noun.
 *
 * `known` matters because `partOfSpeech` alone can't distinguish "WordNet
 * has no entry" from "WordNet has entries this map doesn't cover" — both
 * previously returned 'other'. The SUBTLEXus subtitle corpus is full of
 * apostrophe-split fragments (`didn`, `doesn`, `isn`, `couldn`, `ain`) that
 * pass every mechanical filter (alphabetic, not a stopword, not profane) and
 * were landing in real puzzles at maximum frequency. WordNet doesn't know
 * them, so `known` is the filter that removes them.
 */
export async function fetchWordnetProfile(word: string): Promise<WordnetProfile> {
  const wn = getWordNet()
  let records: WordnetRecord[]
  try {
    records = await lookupWord(wn, word)
  } catch (err) {
    console.warn(`WordNet lookup for "${word}" failed:`, err)
    return { known: false, partOfSpeech: 'other', properNoun: false }
  }
  if (records.length === 0) return { known: false, partOfSpeech: 'other', properNoun: false }

  const counts = new Map<PartOfSpeech, number>()
  for (const record of records) {
    const mapped = WORDNET_POS_MAP[record.pos]
    if (!mapped) continue
    counts.set(mapped, (counts.get(mapped) ?? 0) + 1)
  }

  let best: PartOfSpeech = 'other'
  let bestCount = 0
  for (const [pos, count] of counts) {
    if (count > bestCount) {
      best = pos
      bestCount = count
    }
  }

  // WordNet stores proper nouns capitalized. If every synset listing this
  // spelling lists it with a capital, the word only exists as a name.
  const lemmas = records.flatMap((r) => r.synonyms).filter((s) => s.toLowerCase() === word)
  const properNoun = lemmas.length > 0 && lemmas.every((s) => s[0] === s[0].toUpperCase())

  return { known: true, partOfSpeech: best, properNoun }
}

// natural's WordNet API is callback-based; promisify the two calls used above.

function lookupWord(wn: WordNetInstance, word: string): Promise<WordnetRecord[]> {
  return new Promise((resolve, reject) => {
    try {
      wn.lookup(word, (results) => resolve(results as unknown as WordnetRecord[]))
    } catch (err) {
      reject(err)
    }
  })
}

function getSynset(wn: WordNetInstance, synsetOffset: number, pos: string): Promise<WordnetRecord> {
  return new Promise((resolve, reject) => {
    try {
      wn.get(synsetOffset, pos, (result) => resolve(result as unknown as WordnetRecord))
    } catch (err) {
      reject(err)
    }
  })
}
