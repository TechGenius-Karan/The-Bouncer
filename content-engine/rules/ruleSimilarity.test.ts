import { describe, expect, it } from 'vitest'
import { makeWord } from '../generator/testUtils'
import { buildWordBank } from '../words/wordBank'
import { RULES } from './index'
import { classifyCollision, pickRevealRule } from './ruleSimilarity'
import type { Rule } from './types'

const bank = buildWordBank()

function ruleById(id: string): Rule {
  const rule = RULES.find((r) => r.id === id)
  if (!rule) throw new Error(`Unknown rule id: ${id}`)
  return rule
}

// Every pair below was observed colliding on a real generated board during the
// audit that produced this module — these are the actual cases the classifier
// has to get right, not invented ones.
describe('classifyCollision', () => {
  it.each([
    ['ends-with-ng', 'ends-with-g'], // J=0.933
    ['ends-with-ion', 'ends-with-tion'], // J=0.775
    ['ends-with-ed', 'ends-with-d'], // J=0.659
  ])('treats %s ~ %s as the same idea', (a, b) => {
    expect(classifyCollision(ruleById(a), ruleById(b), bank)).toBe('equivalent')
  })

  // These score low on Jaccard (0.01-0.06) purely because the set sizes are
  // lopsided, but each is a strict logical subset: "ness" ends with s, "ful"
  // contains f, and English "qu" is always followed by a vowel. Overlap alone
  // reads them as coincidence; they plainly aren't, which is why containment
  // is checked separately.
  it.each([
    ['starts-with-q', 'third-letter-vowel'],
    ['ends-with-ful', 'contains-f'],
    ['ends-with-ness', 'ends-with-s'],
    // The case that motivated the containment check: 43 words against 712.
    ['palindrome', 'same-start-end'],
  ])('treats %s ~ %s as a special case, not a coincidence', (a, b) => {
    expect(classifyCollision(ruleById(a), ruleById(b), bank)).toBe('subsumption')
  })

  // The reject path. No natural divergent pair survives to a real board at the
  // current taxonomy size (measured: 0 of 57 collisions across 252 boards), so
  // this is synthetic — but it is the safety mechanism the whole relaxation
  // rests on, and it must keep working as the taxonomy grows.
  it('still calls partial overlap with no containment a coincidence', () => {
    const tinyBank = ['aa', 'ab', 'ac', 'ba', 'bb', 'bc', 'ca', 'cb', 'cc'].map((s) => makeWord(s))
    const startsA: Rule = {
      id: 'starts-a',
      name: 'a',
      descriptionTemplate: 'a',
      family: 'lexical-structural',
      subtlety: 3,
      evaluate: (w) => w.spelling.startsWith('a'),
    }
    const endsA: Rule = { ...startsA, id: 'ends-a', evaluate: (w) => w.spelling.endsWith('a') }
    // Overlap is exactly {aa}: 1/5 by Jaccard, 1/3 containment. Neither clears.
    expect(classifyCollision(startsA, endsA, tinyBank)).toBe('divergent')
  })

  it('is symmetric', () => {
    for (const [a, b] of [
      ['ends-with-ng', 'ends-with-g'],
      ['palindrome', 'same-start-end'],
      ['starts-with-q', 'third-letter-vowel'],
    ]) {
      expect(classifyCollision(ruleById(a), ruleById(b), bank)).toBe(
        classifyCollision(ruleById(b), ruleById(a), bank)
      )
    }
  })

  it('calls a rule that matches nothing divergent rather than dividing by zero', () => {
    const never: Rule = {
      id: 'never-matches',
      name: 'Never matches',
      descriptionTemplate: 'Matches nothing',
      family: 'lexical-structural',
      subtlety: 3,
      evaluate: () => false,
    }
    expect(classifyCollision(never, ruleById('palindrome'), bank)).toBe('divergent')
  })

  it('ignores blocked words when comparing IN-sets', () => {
    // 'aaa' is IN for both rules but blocked; without the blocked filter the
    // two rules would look identical instead of sharing nothing.
    const blocked = makeWord('aaa')
    blocked.safety.blocked = true
    const tinyBank = [blocked, makeWord('xyz'), makeWord('pqr')]
    const onlyBlocked: Rule = {
      id: 'only-blocked',
      name: 'a',
      descriptionTemplate: 'a',
      family: 'lexical-structural',
      subtlety: 3,
      evaluate: (w) => w.spelling === 'aaa',
    }
    const alsoOnlyBlocked: Rule = { ...onlyBlocked, id: 'also-only-blocked' }
    expect(classifyCollision(onlyBlocked, alsoOnlyBlocked, tinyBank)).toBe('divergent')
  })
})

describe('pickRevealRule', () => {
  const base: Omit<Rule, 'id' | 'evaluate'> = {
    name: 'x',
    descriptionTemplate: 'x',
    family: 'lexical-structural',
    subtlety: 3,
  }
  const dull: Rule = { ...base, id: 'a-dull', aha: 1, evaluate: () => true }
  const fun: Rule = { ...base, id: 'z-fun', aha: 5, evaluate: () => true }

  it('names the more satisfying rule when the two are equivalent', () => {
    expect(pickRevealRule(dull, fun, 'equivalent', bank).id).toBe('z-fun')
    expect(pickRevealRule(fun, dull, 'equivalent', bank).id).toBe('z-fun')
  })

  it('treats an unrated rule as neutral rather than undefined', () => {
    const unrated: Rule = { ...base, id: 'unrated', evaluate: () => true }
    expect(pickRevealRule(unrated, dull, 'equivalent', bank).id).toBe('unrated') // 3 > 1
    expect(pickRevealRule(unrated, fun, 'equivalent', bank).id).toBe('z-fun') // 5 > 3
  })

  it('breaks ties deterministically so a regenerated puzzle cannot flip its reveal', () => {
    const a: Rule = { ...base, id: 'aaa', aha: 3, evaluate: () => true }
    const b: Rule = { ...base, id: 'bbb', aha: 3, evaluate: () => true }
    expect(pickRevealRule(a, b, 'equivalent', bank).id).toBe('aaa')
    expect(pickRevealRule(b, a, 'equivalent', bank).id).toBe('aaa')
  })

  // Accuracy of description beats satisfaction: "same first and last letter"
  // on a board of five palindromes describes it less well than "palindrome".
  it('names the specific rule for a subsumption, overriding aha', () => {
    const palindrome = ruleById('palindrome')
    const sameStartEnd = ruleById('same-start-end')
    const picked = pickRevealRule(palindrome, sameStartEnd, 'subsumption', bank)
    expect(picked.id).toBe('palindrome')
    expect(pickRevealRule(sameStartEnd, palindrome, 'subsumption', bank).id).toBe('palindrome')
  })
})
