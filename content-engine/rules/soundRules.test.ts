import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank.js'
import { RULES } from './index.js'
import type { Rule } from './types.js'

const bank = buildWordBank()
const byWord = new Map(bank.map((w) => [w.spelling, w]))
// Every sound template, so the two blanket guards below — unpronounceable words
// are never IN, and every rule clears the coverage floor — automatically cover
// anything added to the family.
const SOUND_TEMPLATES = [
  'syllable-count',
  'rhyme',
  'silent-letters',
  'homophone',
  'initial-sound',
  'silent-first-letter',
  'one-syllable-long',
]
const soundRules = RULES.filter((r) => SOUND_TEMPLATES.includes(r.templateId ?? ''))

function rule(id: string): Rule {
  const found = RULES.find((r) => r.id === id)
  if (!found) throw new Error(`no rule ${id}`)
  return found
}

function matches(r: Rule, spelling: string): boolean {
  const word = byWord.get(spelling)
  if (!word) throw new Error(`"${spelling}" is not in the word bank`)
  return r.evaluate(word)
}

describe('the sound family exists and is wired in', () => {
  it('contributes rules from every sound template', () => {
    for (const t of SOUND_TEMPLATES) {
      expect(soundRules.filter((r) => r.templateId === t).length).toBeGreaterThan(0)
    }
  })
})

// The single most important property. CMUdict has no pronunciation for ~2% of
// the bank, and a sound rule that quietly matched one of those words would make
// a puzzle mark an answer the player cannot possibly reason about.
describe('words with no pronunciation', () => {
  const silent = bank.filter((w) => w.phonetics === null)

  it('exist, so this test is actually exercising something', () => {
    expect(silent.length).toBeGreaterThan(0)
  })

  it('are OUT for every sound rule, never IN', () => {
    for (const r of soundRules) {
      const wrong = silent.filter((w) => r.evaluate(w)).map((w) => w.spelling)
      expect(wrong, `${r.id} matched unpronounceable words`).toEqual([])
    }
  })
})

describe('syllable count', () => {
  it('counts spoken syllables, not letters or vowels', () => {
    expect(matches(rule('syllables-1'), 'cat')).toBe(true)
    expect(matches(rule('syllables-1'), 'strength')).toBe(true) // 8 letters, one syllable
    expect(matches(rule('syllables-3'), 'banana')).toBe(true)
    expect(matches(rule('syllables-3'), 'cat')).toBe(false)
  })

  it('has no 2-syllable rule — it would cover 43% of the bank', () => {
    expect(RULES.find((r) => r.id === 'syllables-2')).toBeUndefined()
  })
})

describe('homophone', () => {
  it('matches words that sound like a different word', () => {
    const r = rule('has-homophone')
    for (const w of ['great', 'pear', 'throne']) expect(matches(r, w)).toBe(true)
  })

  it('does not match a word with no twin', () => {
    const r = rule('has-homophone')
    for (const w of ['banana', 'elephant']) expect(matches(r, w)).toBe(false)
  })
})

describe('more letters than sounds', () => {
  const r = RULES.find((x) => x.templateId === 'silent-letters')!

  it('matches words written longer than they are spoken', () => {
    for (const w of ['thought', 'daughter']) expect(matches(r, w)).toBe(true)
  })

  it('does not match a word spelled about as it sounds', () => {
    expect(matches(r, 'cat')).toBe(false)
  })

  it('is named for what it measures, not for silent letters', () => {
    // The count is letters minus phonemes, so digraphs land in it too —
    // "cheese" scores 3 without having three silent letters. The reveal text is
    // what a player checks their reasoning against, so it must not overclaim.
    expect(r.name).not.toMatch(/silent/i)
  })
})

describe('rhyme', () => {
  // The reason the sound family is worth having: these words rhyme and share
  // almost no spelling, so no ends-with rule could ever express the group.
  it('groups words by sound, not by spelling', () => {
    const r = rule('rhyme-eyt')
    for (const w of ['great', 'eight', 'straight', 'wait', 'late']) {
      expect(matches(r, w), `${w} should rhyme`).toBe(true)
    }
  })

  it('runs from the last STRESSED vowel, so unstressed endings do not collide', () => {
    // Taking the last vowel of any kind grouped "surface", "tennis" and "bus"
    // together on a shared schwa — technically a rhyme, audibly not one.
    const surface = byWord.get('surface')!
    const tennis = byWord.get('tennis')!
    expect(surface.phonetics!.rhyme).not.toBe(tennis.phonetics!.rhyme)
  })

  it('never merges two different phoneme sequences into one key', () => {
    // The key joins phonemes with no separator. buildPhonetics fails hard on a
    // collision; this is the standing guard in case the key format changes.
    const seen = new Map<string, string>()
    for (const w of bank) {
      const p = w.phonetics
      if (!p?.rhyme) continue
      const prior = seen.get(p.rhyme)
      if (prior === undefined) seen.set(p.rhyme, w.spelling)
    }
    expect(seen.size).toBeGreaterThan(100)
  })
})

describe('initial sound', () => {
  it('groups words by the sound they start with, not the letter', () => {
    const k = rule('initial-sound-k')
    for (const w of ['coffee', 'kitten', 'quiet']) expect(matches(k, w), w).toBe(true)
    const j = rule('initial-sound-jh')
    for (const w of ['jacket', 'gentle', 'giraffe']) expect(matches(j, w), w).toBe(true)
    const y = rule('initial-sound-y')
    for (const w of ['yellow', 'unique', 'europe']) expect(matches(y, w), w).toBe(true)
  })

  it('does not match a word that merely starts with the letter', () => {
    // "ceiling" starts with C and sounds like S — the whole point of the rule.
    expect(matches(rule('initial-sound-k'), 'ceiling')).toBe(false)
  })

  // Without this the clue set could be three c-words, teaching the player
  // "starts with C" and making the pool look arbitrary when "quiet" turns up IN.
  it('reports the spelling as its variant, so clue sets span spellings', () => {
    const k = rule('initial-sound-k')
    expect(k.variantOf).toBeDefined()
    expect(k.variantOf!(byWord.get('coffee')!)).toBe('c')
    expect(k.variantOf!(byWord.get('quiet')!)).toBe('q')
    expect(k.variantOf!(byWord.get('banana')!)).toBe(null)
  })

  // The gate that keeps the family honest: a sound spelled only one way is the
  // letter rule in disguise, and would be a guaranteed live decoy on every
  // puzzle the letter rule produced.
  it('exists only for sounds with more than one spelling', () => {
    const oneWay = ['b', 'p', 'd', 'm', 't', 'l', 'g', 'v']
    for (const letter of oneWay) {
      expect(
        RULES.find((r) => r.id === `initial-sound-${letter}`),
        `initial-sound-${letter} should not exist — that sound is only ever spelled "${letter}"`
      ).toBeUndefined()
    }
  })
})

describe('silent first letter', () => {
  const r = rule('silent-first-letter')

  it('matches the silent initial digraphs and silent H', () => {
    for (const w of ['knee', 'wrist', 'write', 'wrong', 'honest', 'hour']) {
      expect(matches(r, w), w).toBe(true)
    }
  })

  it('does not match a word whose first letter is pronounced', () => {
    for (const w of ['kitten', 'window', 'happy', 'pillow']) expect(matches(r, w), w).toBe(false)
  })

  // The first batch generated without this drew wrestling/knowing/wrong, whose
  // shared -ng ending produced three decoys about the END of the word.
  it('reports the silent letter as its variant, so clue sets span kn-/wr-/ps-/h-', () => {
    expect(r.variantOf).toBeDefined()
    expect(r.variantOf!(byWord.get('knee')!)).toBe('k')
    expect(r.variantOf!(byWord.get('wrist')!)).toBe('w')
    expect(r.variantOf!(byWord.get('honest')!)).toBe('h')
    expect(r.variantOf!(byWord.get('kitten')!)).toBe(null)
  })
})

describe('long but one syllable', () => {
  const r = RULES.find((x) => x.templateId === 'one-syllable-long')!

  it('matches long words spoken in one beat', () => {
    for (const w of ['cheese', 'square', 'spring', 'wrench']) expect(matches(r, w), w).toBe(true)
  })

  it('does not match a short one-syllable word', () => {
    expect(matches(r, 'cat')).toBe(false)
  })

  it('does not match a long word with several syllables', () => {
    expect(matches(r, 'banana')).toBe(false)
  })
})

describe('coverage', () => {
  it('every sound rule has enough words to build a puzzle from', () => {
    const usable = bank.filter((w) => !w.safety.blocked)
    for (const r of soundRules) {
      const n = usable.filter((w) => r.evaluate(w)).length
      expect(n, `${r.id} matches only ${n} words`).toBeGreaterThanOrEqual(25)
    }
  })
})
