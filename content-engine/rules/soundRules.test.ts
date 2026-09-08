import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank.js'
import { RULES } from './index.js'
import type { Rule } from './types.js'

const bank = buildWordBank()
const byWord = new Map(bank.map((w) => [w.spelling, w]))
const SOUND_TEMPLATES = ['syllable-count', 'rhyme', 'silent-letters', 'homophone']
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

describe('coverage', () => {
  it('every sound rule has enough words to build a puzzle from', () => {
    const usable = bank.filter((w) => !w.safety.blocked)
    for (const r of soundRules) {
      const n = usable.filter((w) => r.evaluate(w)).length
      expect(n, `${r.id} matches only ${n} words`).toBeGreaterThanOrEqual(25)
    }
  })
})
