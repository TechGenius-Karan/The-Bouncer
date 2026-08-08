import { describe, expect, it } from 'vitest'
import { buildLetterFeatures, isPrime, isSubsequence } from './features'

describe('isPrime', () => {
  it.each([
    [2, true],
    [3, true],
    [4, false],
    [5, true],
    [6, false],
    [7, true],
    [9, false],
    [1, false],
    [0, false],
  ])('isPrime(%i) === %s', (n, expected) => {
    expect(isPrime(n)).toBe(expected)
  })
})

describe('isSubsequence', () => {
  it('finds letters in order, not necessarily adjacent', () => {
    expect(isSubsequence('ace', 'space')).toBe(true)
    expect(isSubsequence('ace', 'advice')).toBe(true)
    expect(isSubsequence('ace', 'distance')).toBe(true)
  })

  it('rejects words where the letters are out of order', () => {
    expect(isSubsequence('ace', 'cafe')).toBe(false)
    expect(isSubsequence('ace', 'ceramic')).toBe(false)
  })

  it('rejects words missing a letter entirely', () => {
    expect(isSubsequence('ace', 'cat')).toBe(false)
    expect(isSubsequence('ace', 'plan')).toBe(false)
  })
})

describe('buildLetterFeatures', () => {
  it('detects a doubled letter', () => {
    expect(buildLetterFeatures('bubble').hasDoubledLetter).toBe(true)
    expect(buildLetterFeatures('word').hasDoubledLetter).toBe(false)
  })

  it('detects matching first/last letters', () => {
    expect(buildLetterFeatures('level').sameStartEnd).toBe(true)
    expect(buildLetterFeatures('radar').sameStartEnd).toBe(true)
    expect(buildLetterFeatures('canoe').sameStartEnd).toBe(false)
  })

  it('flags prime word length', () => {
    expect(buildLetterFeatures('cat').isPrimeLength).toBe(true) // length 3
    expect(buildLetterFeatures('word').isPrimeLength).toBe(false) // length 4
  })

  it('counts vowels and flags vowel-start', () => {
    const apple = buildLetterFeatures('apple')
    expect(apple.vowelCount).toBe(2)
    expect(apple.startsWithVowel).toBe(true)

    const hello = buildLetterFeatures('hello')
    expect(hello.vowelCount).toBe(2)
    expect(hello.startsWithVowel).toBe(false)
  })

  it('flags adjacent vowels correctly', () => {
    expect(buildLetterFeatures('dog').noAdjacentVowels).toBe(true) // 1 vowel, vacuously true
    expect(buildLetterFeatures('cat').noAdjacentVowels).toBe(true)
    expect(buildLetterFeatures('quiet').noAdjacentVowels).toBe(false) // u-i-e run
    expect(buildLetterFeatures('ocean').noAdjacentVowels).toBe(false) // e-a run
  })

  it('finds hidden number-word substrings', () => {
    expect(buildLetterFeatures('money').hiddenWordHits).toContain('one')
    expect(buildLetterFeatures('network').hiddenWordHits).toContain('two')
    expect(buildLetterFeatures('canine').hiddenWordHits).toContain('nine')
    expect(buildLetterFeatures('bubble').hiddenWordHits).toEqual([])
  })

  it('finds the ACE subsequence where present', () => {
    expect(buildLetterFeatures('space').subsequenceHits).toContain('ace')
    expect(buildLetterFeatures('cafe').subsequenceHits).toEqual([])
    expect(buildLetterFeatures('ceramic').subsequenceHits).toEqual([])
  })

  it('treats y as a consonant', () => {
    const yellow = buildLetterFeatures('yellow')
    expect(yellow.startsWithVowel).toBe(false)
    expect(yellow.firstLetter).toBe('y')
  })
})
