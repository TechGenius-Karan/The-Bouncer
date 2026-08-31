import { HIDDEN_WORD_TARGETS, SUBSEQUENCE_TARGETS, VOWELS } from './fixedLists'
import type { LetterFeatures } from './types'

export function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}

/** Does `letters` appear inside `word`, in order, not necessarily adjacent? */
export function isSubsequence(letters: string, word: string): boolean {
  let i = 0
  for (const ch of word) {
    if (ch === letters[i]) i++
    if (i === letters.length) return true
  }
  return false
}

// A word doesn't "hide" a target when it simply is that target ("green" for
// hides-a-colour), nor when it's just the target inflected ("cats" for "cat") —
// both read as a giveaway rather than a discovery. Only genuine coincidental
// containment ("credit" hiding "red") makes the rule fun.
const TRIVIAL_SUFFIXES = ['s', 'es', 'ed', 'ing', 'er', 'y', 'ly', 'less', 'ful']

export function isHiddenIn(spelling: string, target: string): boolean {
  if (!spelling.includes(target)) return false
  if (spelling === target) return false
  return !TRIVIAL_SUFFIXES.some((suffix) => spelling === target + suffix)
}

export function buildLetterFeatures(spelling: string): LetterFeatures {
  const chars = spelling.split('')
  const length = chars.length
  const firstLetter = chars[0]
  const lastLetter = chars[length - 1]

  let hasDoubledLetter = false
  for (let i = 0; i < length - 1; i++) {
    if (chars[i] === chars[i + 1]) {
      hasDoubledLetter = true
      break
    }
  }

  const vowelPositions: number[] = []
  let vcPattern = ''
  for (let i = 0; i < length; i++) {
    if (VOWELS.has(chars[i])) {
      vowelPositions.push(i)
      vcPattern += 'V'
    } else {
      vcPattern += 'C'
    }
  }

  let noAdjacentVowels = true
  for (let i = 0; i < vowelPositions.length - 1; i++) {
    if (vowelPositions[i + 1] === vowelPositions[i] + 1) {
      noAdjacentVowels = false
      break
    }
  }

  return {
    firstLetter,
    lastLetter,
    sameStartEnd: firstLetter === lastLetter,
    hasDoubledLetter,
    vowelCount: vowelPositions.length,
    consonantCount: length - vowelPositions.length,
    vowelPositions,
    vcPattern,
    noAdjacentVowels,
    startsWithVowel: VOWELS.has(firstLetter),
    isPrimeLength: isPrime(length),
    firstBeforeLastAlpha: firstLetter < lastLetter,
    hiddenWordHits: HIDDEN_WORD_TARGETS.filter((target) => isHiddenIn(spelling, target)),
    subsequenceHits: SUBSEQUENCE_TARGETS.filter((target) => isSubsequence(target, spelling)),
    anagramSignature: chars.slice().sort().join(''),
    isPalindrome: spelling === chars.slice().reverse().join(''),
  }
}
