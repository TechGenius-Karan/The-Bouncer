import type { Rule } from '../rules/types'
import type { Word } from '../words/types'
import { shuffle } from './random'

// ai-feedback-plan.md Phase 3: the pure, Mongo-free core of the word menus
// admin-ai-review.ts hands the model. Same testable-core / thin-wrapper split
// as repairWord and aiReviewDispatch.
//
// The menus are the model's entire vocabulary — the prompt tells it that
// anything outside them "is not in the game's word bank." That claim has to be
// true, and with a plain shuffle-and-slice it often wasn't: a rule like
// ends-with-g matches 1,172 words, so a 100-word sample gave a reviewer who
// named a specific word roughly 8% odds it was offered. The model then
// correctly followed its instructions and told the reviewer their word didn't
// exist. It was in the bank the whole time — the sample just missed it.
//
// So the sample is no longer purely random: anything the request actually
// depends on is pinned first, and the shuffle only fills what's left.

/** A menu word plus, where the rule has variants, why it matches ("listening" -> "ten"). */
export interface MenuWord {
  word: string
  variant?: string
}

export interface ReviewMenus {
  inWordMenu: MenuWord[]
  outWordMenu: string[]
  /**
   * Bank words the reviewer *quoted* that are now guaranteed present in a menu.
   *
   * Quoted only, like requestedMissing, because this is told to the model as
   * "words the reviewer mentioned". Bare prose tokens are still pinned into
   * the menus — a few extra valid words cost nothing — but announcing
   * "please", "use" and "instead" as requests would invent instructions the
   * reviewer never gave.
   */
  pinnedNamed: string[]
  /**
   * Words the reviewer *quoted* that genuinely aren't in the bank.
   *
   * Quoted only, deliberately. Unquoted prose can't be told apart from a word
   * request, so reporting every unmatched token would hand the model a list of
   * dozens of "missing words" that the reviewer never asked for.
   */
  requestedMissing: string[]
}

/**
 * Cap on reviewer-named words pinned into a menu. Feedback is prose, so
 * ordinary words in it ("change", "word") are often real bank entries too;
 * without a cap a long note could crowd out the sampled words entirely.
 */
const MAX_PINNED = 12

/** Ignore very short tokens — "a", "is", "to" carry no request and are rarely bank words anyway. */
const MIN_TOKEN_LENGTH = 3

/**
 * Splits feedback into words the reviewer clearly named versus ones that might
 * just be prose.
 *
 * A quoted token is an explicit request — `use "rotator"` names a word. A bare
 * token might be a request or might be the sentence around it, so bare tokens
 * are still pinned when they turn out to be bank words (harmless, and reviewers
 * don't reliably quote) but are never reported back as missing.
 */
export function extractNamedWords(reason: string): { quoted: string[]; bare: string[] } {
  const lower = reason.toLowerCase()
  const quoted = [...lower.matchAll(/["'“”‘’]\s*([a-z]{2,})\s*["'“”‘’]/g)].map((m) => m[1])
  const quotedSet = new Set(quoted)
  const bare = (lower.match(/[a-z]+/g) ?? []).filter(
    (t) => t.length >= MIN_TOKEN_LENGTH && !quotedSet.has(t)
  )
  return { quoted: [...quotedSet], bare: [...new Set(bare)] }
}

/**
 * Builds the IN/OUT menus for a rewrite, guaranteeing that everything the
 * request depends on is actually present:
 *
 * - the puzzle's own current words, so "keep the rest as they are" is possible
 *   at all (the prompt already claims they're included; a plain slice could
 *   silently drop them);
 * - any bank word the reviewer named, so a direct instruction can be followed
 *   rather than refused with a false "not in the word bank".
 *
 * Everything else is a shuffled sample, as before, so skewed rules still
 * surface their rarer words across repeated refines.
 */
export function buildReviewMenus(
  rule: Rule,
  wordBank: Word[],
  reason: string,
  boardWordIds: string[],
  sizes: { in: number; out: number }
): ReviewMenus {
  const available = wordBank.filter((w) => !w.safety.blocked)
  const byId = new Map(available.map((w) => [w.id, w]))

  const { quoted, bare } = extractNamedWords(reason)
  // Quoted first: an explicit request outranks a word that might just be prose,
  // and only quoted words are allowed to consume the whole pin budget.
  const namedInBank: Word[] = []
  for (const token of [...quoted, ...bare]) {
    const word = byId.get(token)
    if (word && namedInBank.length < MAX_PINNED) namedInBank.push(word)
  }
  const requestedMissing = quoted.filter((t) => !byId.has(t))

  const onBoard = boardWordIds.map((id) => byId.get(id)).filter((w): w is Word => Boolean(w))
  const pinned = [...onBoard, ...namedInBank]

  const build = <T>(wantIn: boolean, size: number, render: (w: Word) => T): T[] => {
    const side = (w: Word) => rule.evaluate(w) === wantIn
    const kept = pinned.filter(side)
    const keptIds = new Set(kept.map((w) => w.id))
    const filler = shuffle(available.filter((w) => side(w) && !keptIds.has(w.id)))
    // Pinned words are never dropped to honour `size` — a menu one word over
    // budget is harmless, a menu missing the word the reviewer asked for is
    // the bug this function exists to fix.
    return [...kept, ...filler.slice(0, Math.max(0, size - kept.length))].map(render)
  }

  return {
    inWordMenu: build(true, sizes.in, (w) => {
      const variant = rule.variantOf?.(w)
      return variant ? { word: w.spelling, variant } : { word: w.spelling }
    }),
    outWordMenu: build(false, sizes.out, (w) => w.spelling),
    pinnedNamed: quoted.filter((t) => byId.has(t)),
    requestedMissing,
  }
}
