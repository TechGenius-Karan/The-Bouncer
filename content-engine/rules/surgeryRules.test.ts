import { describe, expect, it } from 'vitest'
import { buildWordBank } from '../words/wordBank.js'
import { RULES } from './index.js'
import type { Rule } from './types.js'

const bank = buildWordBank()
const usable = bank.filter((w) => !w.safety.blocked)
const byWord = new Map(bank.map((w) => [w.spelling, w]))

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

describe('word surgery', () => {
  it('reverses into another word', () => {
    const r = rule('reverses-into-word')
    // wolf/flow, deer/reed, keep/peek, live/evil, part/trap
    for (const w of ['wolf', 'deer', 'keep', 'live', 'part']) expect(matches(r, w), w).toBe(true)
    for (const w of ['banana', 'elephant']) expect(matches(r, w), w).toBe(false)
  })

  it('does not count a palindrome as reversing into a *different* word', () => {
    expect(matches(rule('reverses-into-word'), 'level')).toBe(false)
  })

  it('beheads into another word', () => {
    const r = rule('behead-into-word')
    // (d)inner, (l)adder, (w)ant, (f)eel
    for (const w of ['dinner', 'ladder', 'want', 'feel']) expect(matches(r, w), w).toBe(true)
  })

  it('curtails into another word', () => {
    const r = rule('curtail-into-word')
    for (const w of ['rabbit', 'planet', 'shovel']) expect(matches(r, w), w).toBe(true)
  })

  // Without this the rule fills up with plurals and verb forms, and the player
  // learns to look for a grammar pattern instead of a word inside a word.
  it('does not treat a plural as a curtailment', () => {
    const r = rule('curtail-into-word')
    for (const w of ['hands', 'eyes', 'aches']) expect(matches(r, w), w).toBe(false)
  })

  it('finds compounds and not coincidental splits', () => {
    const r = rule('compound-word')
    for (const w of ['earthquake', 'lighthouse', 'strawberry']) expect(matches(r, w), w).toBe(true)
    // The reason MIN_COMPOUND_HALF is 5: at 3 these matched as kit+ten, mag+net.
    for (const w of ['kitten', 'magnet']) expect(matches(r, w), w).toBe(false)
  })
})

// The lexical-semantic hybrid. A lexical operation on a semantic target set —
// the shape Connections cannot express, because it can name the set but not the
// operation.
describe('surgery x category', () => {
  const crossed = RULES.filter((r) => (r.templateId ?? '').startsWith('surgery-'))

  it('ships the cells that cleared the coverage sweep', () => {
    expect(crossed.length).toBeGreaterThan(0)
    for (const r of crossed) {
      const n = usable.filter((w) => r.evaluate(w)).length
      expect(n, `${r.id} matches only ${n} words`).toBeGreaterThanOrEqual(25)
    }
  })

  it('beheads into an animal', () => {
    const r = rule('behead-into-animal')
    // ladder/adder, jowl/owl, want/ant, feel/eel
    for (const w of ['ladder', 'jowl', 'want', 'feel']) expect(matches(r, w), w).toBe(true)
  })

  it('rearranges into an animal', () => {
    const r = rule('anagram-into-animal')
    // item/mite, garden/gander, parrot/raptor, throne/hornet, love/vole
    for (const w of ['item', 'garden', 'parrot', 'throne', 'love']) {
      expect(matches(r, w), w).toBe(true)
    }
  })

  // "reverse it and you get an animal" is the cell everyone wants and the bank
  // cannot support: only 164 words reverse into anything at all.
  it('ships no reverse-into-category cell, because none clears the floor', () => {
    expect(crossed.filter((r) => r.id.startsWith('reverse-into-'))).toEqual([])
  })
})

describe('letter patterns', () => {
  it('alternates vowels and consonants', () => {
    const r = rule('alternating-vowel-consonant')
    for (const w of ['level', 'radar', 'banana', 'civic']) expect(matches(r, w), w).toBe(true)
    for (const w of ['cheese', 'strength']) expect(matches(r, w), w).toBe(false)
  })

  it('uses one vowel letter throughout', () => {
    const r = rule('same-vowel-throughout')
    for (const w of ['spoon', 'common', 'letter']) expect(matches(r, w), w).toBe(true)
    expect(matches(r, 'banana')).toBe(true) // a, a, a
    expect(matches(r, 'needle')).toBe(true) // e, e, e
    expect(matches(r, 'orange')).toBe(false)
  })

  it('repeats one letter three times', () => {
    const r = rule('letter-three-times')
    for (const w of ['banana', 'bubble', 'mirror']) expect(matches(r, w), w).toBe(true)
    expect(matches(r, 'cat')).toBe(false)
  })

  // vcPattern calls y a consonant, which made cyclone and mystery match on
  // "cycl" and "myst" — runs no player would count.
  it('does not count y as part of a consonant run', () => {
    const r = rule('consonant-run-4')
    for (const w of ['earthquake', 'lighthouse', 'cartwheel']) expect(matches(r, w), w).toBe(true)
    for (const w of ['cyclone', 'mystery', 'bicycle']) expect(matches(r, w), w).toBe(false)
  })

  it('runs letters in reverse alphabetical order', () => {
    const r = rule('reverse-alphabetical-order-run')
    for (const w of ['spoon', 'wolf', 'sled']) expect(matches(r, w), w).toBe(true)
    // The forward case must not also match here.
    expect(matches(r, 'almost')).toBe(false)
  })
})
