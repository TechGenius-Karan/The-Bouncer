import type { Puzzle } from '../game/types'

// Puzzle 1: "The word contains a doubled letter"
// Rule: two identical letters adjacent (e.g., "ll", "ff", "ss")
// Trap guest: BEAUTIFUL — long/fancy, but no doubled letter; targets players anchoring on
//   word length or prestige as a proxy for "IN".
// T-but-looks-wrong: GROSS — the "ss" is easy to scan past when skimming.
const puzzleDoubledLetter: Puzzle = {
  id: 'doubled-letter',
  ruleText: 'The word contains a doubled letter (two identical letters in a row).',
  clues: [
    { id: 'c1', word: 'BUBBLE', label: 'IN' },   // bb
    { id: 'c2', word: 'LETTER', label: 'IN' },   // tt
    { id: 'c3', word: 'SPOON', label: 'IN' },    // oo
    { id: 'c4', word: 'STONE', label: 'OUT' },
    { id: 'c5', word: 'BRAVE', label: 'OUT' },
    { id: 'c6', word: 'PLANT', label: 'OUT' },
  ],
  guests: [
    { id: 'g1', word: 'COFFEE', trueLabel: 'IN' },    // ff
    { id: 'g2', word: 'ARROW', trueLabel: 'IN' },     // rr
    { id: 'g3', word: 'GROSS', trueLabel: 'IN' },     // ss — T-but-looks-wrong
    { id: 'g4', word: 'BEAUTIFUL', trueLabel: 'OUT' }, // decoy trap: looks "fancy/IN" but no double
    { id: 'g5', word: 'BRIDGE', trueLabel: 'OUT' },
    { id: 'g6', word: 'MOTION', trueLabel: 'OUT' },
  ],
}

// Puzzle 2: "The first letter and the last letter are the same"
// Clues are all palindromes (LEVEL, KAYAK, DEED) — this seeds the decoy hypothesis
// "all IN words are palindromes." The guest pool then breaks that decoy:
//   CIVIC (C=C, not a palindrome) and ARENA (A=A, not a palindrome) are IN
//   but violate the palindrome decoy → forces players to find the real rule.
// NOON and RADAR are IN and are also palindromes → satisfy decoy, don't discriminate.
// OUT guests CRISP (C≠P) and URBAN (U≠N) are clean OUT.
const puzzleSameStartEnd: Puzzle = {
  id: 'same-start-end',
  ruleText: 'The first letter and the last letter of the word are the same.',
  clues: [
    { id: 'c1', word: 'LEVEL', label: 'IN' },   // L=L, also palindrome
    { id: 'c2', word: 'KAYAK', label: 'IN' },   // K=K, also palindrome
    { id: 'c3', word: 'DEED', label: 'IN' },    // D=D, also palindrome
    { id: 'c4', word: 'STORM', label: 'OUT' },  // S≠M
    { id: 'c5', word: 'BLEND', label: 'OUT' },  // B≠D
    { id: 'c6', word: 'CLOUD', label: 'OUT' },  // C≠D
  ],
  guests: [
    { id: 'g1', word: 'NOON', trueLabel: 'IN' },   // N=N, palindrome — satisfies decoy too
    { id: 'g2', word: 'CIVIC', trueLabel: 'IN' },  // C=C, NOT palindrome — breaks decoy
    { id: 'g3', word: 'ARENA', trueLabel: 'IN' },  // A=A, NOT palindrome — breaks decoy
    { id: 'g4', word: 'CHAIR', trueLabel: 'OUT' }, // C≠R — clean OUT (3-3 balance)
    { id: 'g5', word: 'CRISP', trueLabel: 'OUT' }, // C≠P
    { id: 'g6', word: 'URBAN', trueLabel: 'OUT' }, // U≠N
  ],
}

export const HARDCODED_PUZZLES: Puzzle[] = [puzzleDoubledLetter, puzzleSameStartEnd]
