import { describe, expect, it } from 'vitest'
import type { Rule } from '../rules/types'
import { buildReviewMenus, extractNamedWords } from './aiReviewMenu'
import { makeWord } from './testUtils'

// A rule with a wide IN set, so a plain shuffle-and-slice would routinely miss
// any particular word — the situation that made the model report real bank
// words as missing.
const endsWithG: Rule = {
  id: 'ends-with-g',
  name: 'Ends with G',
  descriptionTemplate: 'Ends with the letter G',
  family: 'lexical-structural',
  subtlety: 2,
  evaluate: (w) => w.spelling.endsWith('g'),
}

const inWords = Array.from({ length: 300 }, (_, i) => makeWord(`w${i}strong`.replace(/$/, 'g')))
const outWords = Array.from({ length: 300 }, (_, i) => makeWord(`v${i}plain`))
const bank = [...inWords, ...outWords, makeWord('rotatorg'), makeWord('mango'), makeWord('sting')]

const sizes = { in: 20, out: 10 }

describe('extractNamedWords', () => {
  it('separates quoted requests from surrounding prose', () => {
    const { quoted, bare } = extractNamedWords('please use "rotator" instead of mango')
    expect(quoted).toEqual(['rotator'])
    expect(bare).toContain('mango')
    expect(bare).not.toContain('rotator')
  })

  it('handles single and curly quotes', () => {
    expect(extractNamedWords("swap in 'sting'").quoted).toEqual(['sting'])
    expect(extractNamedWords('swap in “sting”').quoted).toEqual(['sting'])
  })

  it('ignores very short tokens', () => {
    expect(extractNamedWords('do it a bit').bare).not.toContain('a')
    expect(extractNamedWords('do it a bit').bare).toContain('bit')
  })

  it('de-duplicates', () => {
    expect(extractNamedWords('mango mango mango').bare).toEqual(['mango'])
  })
})

describe('buildReviewMenus', () => {
  it('always includes the puzzle’s own words, however large the bank', () => {
    // The prompt tells the model it may reuse the puzzle's current words; a
    // plain slice of a 300-word match list could silently drop them, making
    // "keep everything else the same" impossible to comply with.
    const board = [inWords[250].id, inWords[299].id, outWords[280].id]
    for (let i = 0; i < 20; i++) {
      const menus = buildReviewMenus(endsWithG, bank, 'too obscure', board, sizes)
      const offered = new Set([...menus.inWordMenu.map((m) => m.word), ...menus.outWordMenu])
      for (const id of board) expect(offered.has(id)).toBe(true)
    }
  })

  it('pins a bank word the reviewer named so it can actually be used', () => {
    for (let i = 0; i < 20; i++) {
      const menus = buildReviewMenus(endsWithG, bank, 'use "sting" as a clue', [], sizes)
      expect(menus.inWordMenu.map((m) => m.word)).toContain('sting')
      expect(menus.pinnedNamed).toContain('sting')
      expect(menus.requestedMissing).toEqual([])
    }
  })

  it('puts a named word on the side the rule actually says it belongs', () => {
    const menus = buildReviewMenus(endsWithG, bank, 'try "mango" here', [], sizes)
    expect(menus.outWordMenu).toContain('mango') // does not end with g
    expect(menus.inWordMenu.map((m) => m.word)).not.toContain('mango')
  })

  it('reports a quoted word that genuinely is not in the bank', () => {
    const menus = buildReviewMenus(endsWithG, bank, 'use "zzzznotaword" please', [], sizes)
    expect(menus.requestedMissing).toEqual(['zzzznotaword'])
  })

  // Both lists are read back to the model as things the reviewer said. Prose
  // in either one invents instructions: reporting "obscure" as missing, or
  // announcing "please" and "instead" as requested words.
  it('never reports unquoted prose as missing or as a named request', () => {
    const menus = buildReviewMenus(
      endsWithG,
      bank,
      'these words are far too obscure, please use mango instead',
      [],
      sizes
    )
    expect(menus.requestedMissing).toEqual([])
    expect(menus.pinnedNamed).toEqual([])
  })

  it('still pins an unquoted bank word into the menu, just without announcing it', () => {
    const menus = buildReviewMenus(endsWithG, bank, 'swap in sting somewhere', [], sizes)
    expect(menus.inWordMenu.map((m) => m.word)).toContain('sting')
    expect(menus.pinnedNamed).toEqual([])
  })

  it('keeps pinned words even when they exceed the requested size', () => {
    const board = inWords.slice(0, 25).map((w) => w.id)
    const menus = buildReviewMenus(endsWithG, bank, '', board, { in: 5, out: 5 })
    // Size is a budget for filler, never a reason to drop a word the request
    // depends on.
    expect(menus.inWordMenu.length).toBeGreaterThanOrEqual(25)
  })

  it('excludes blocked words from both menus', () => {
    const blocked = makeWord('badwordg')
    blocked.safety.blocked = true
    const menus = buildReviewMenus(
      endsWithG,
      [...bank, blocked],
      'use "badwordg"',
      [blocked.id],
      sizes
    )
    expect(menus.inWordMenu.map((m) => m.word)).not.toContain('badwordg')
    // Blocked is not the same as absent, but from the model's side it is
    // unusable either way, so reporting it as missing is the honest answer.
    expect(menus.requestedMissing).toContain('badwordg')
  })

  it('annotates variants when the rule has them', () => {
    const withVariant: Rule = {
      ...endsWithG,
      variantOf: (w) => (w.spelling.endsWith('ng') ? 'ng' : 'g'),
    }
    const menus = buildReviewMenus(withVariant, bank, 'use "sting"', [], sizes)
    expect(menus.inWordMenu.find((m) => m.word === 'sting')?.variant).toBe('ng')
  })

  it('fills up to the requested size when nothing is pinned', () => {
    const menus = buildReviewMenus(endsWithG, bank, '', [], sizes)
    expect(menus.inWordMenu).toHaveLength(sizes.in)
    expect(menus.outWordMenu).toHaveLength(sizes.out)
  })
})
