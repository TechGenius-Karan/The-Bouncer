import { describe, expect, it } from 'vitest'
import { parseAiReviewAction } from './aiReviewAction'

const context = { wordIds: new Set(['quiet', 'unique', 'cat', 'plan', 'mosque', 'dog']) }

describe('parseAiReviewAction', () => {
  it('accepts a well-formed swap-word action', () => {
    const result = parseAiReviewAction(
      { action: 'swap-word', badWordId: 'mosque', rationale: 'proper-noun adjacent, reads oddly' },
      context
    )
    expect(result).toEqual({
      action: 'swap-word',
      badWordId: 'mosque',
      rationale: 'proper-noun adjacent, reads oddly',
    })
  })

  it('accepts a well-formed rewrite-puzzle action', () => {
    const result = parseAiReviewAction(
      {
        action: 'rewrite-puzzle',
        rationale: 'varied the hidden numbers',
        clues: [{ word: 'sixteen', label: 'IN' }],
        guests: [{ word: 'nine', label: 'IN' }],
      },
      context
    )
    expect(result).toEqual({
      action: 'rewrite-puzzle',
      rationale: 'varied the hidden numbers',
      clues: [{ word: 'sixteen', label: 'IN' }],
      guests: [{ word: 'nine', label: 'IN' }],
    })
  })

  it('falls back to agree-reject when rewrite-puzzle has malformed or empty word lists', () => {
    expect(parseAiReviewAction({ action: 'rewrite-puzzle', rationale: 'x', clues: [], guests: [{ word: 'a', label: 'IN' }] }, context).action).toBe('agree-reject')
    expect(parseAiReviewAction({ action: 'rewrite-puzzle', rationale: 'x', clues: [{ word: 'a', label: 'IN' }] }, context).action).toBe('agree-reject')
    expect(parseAiReviewAction({ action: 'rewrite-puzzle', rationale: 'x', clues: [{ word: 'a', label: 'MAYBE' }], guests: [{ word: 'b', label: 'OUT' }] }, context).action).toBe('agree-reject')
    expect(parseAiReviewAction({ action: 'rewrite-puzzle', rationale: 'x', clues: [{ label: 'IN' }], guests: [{ word: 'b', label: 'OUT' }] }, context).action).toBe('agree-reject')
  })

  it('accepts a well-formed adjust-difficulty action', () => {
    const result = parseAiReviewAction(
      { action: 'adjust-difficulty', newSubtlety: 4, rationale: 'too easy to guess by elimination' },
      context
    )
    expect(result).toEqual({ action: 'adjust-difficulty', newSubtlety: 4, rationale: 'too easy to guess by elimination' })
  })

  it('accepts a well-formed retire-rule action', () => {
    const result = parseAiReviewAction({ action: 'retire-rule', rationale: 'ambiguous by nature' }, context)
    expect(result).toEqual({ action: 'retire-rule', rationale: 'ambiguous by nature' })
  })

  it('accepts a well-formed agree-reject action', () => {
    const result = parseAiReviewAction({ action: 'agree-reject', rationale: 'no usable reasoning given' }, context)
    expect(result).toEqual({ action: 'agree-reject', rationale: 'no usable reasoning given' })
  })

  it('falls back to agree-reject when the response is not an object', () => {
    expect(parseAiReviewAction('just a string', context).action).toBe('agree-reject')
    expect(parseAiReviewAction(null, context).action).toBe('agree-reject')
    expect(parseAiReviewAction(undefined, context).action).toBe('agree-reject')
  })

  it('falls back to agree-reject on an unrecognized action', () => {
    const result = parseAiReviewAction({ action: 'delete-everything', rationale: 'x' }, context)
    expect(result.action).toBe('agree-reject')
  })

  it('falls back to agree-reject when rationale is missing or empty', () => {
    expect(parseAiReviewAction({ action: 'retire-rule' }, context).action).toBe('agree-reject')
    expect(parseAiReviewAction({ action: 'retire-rule', rationale: '   ' }, context).action).toBe('agree-reject')
  })

  it('falls back to agree-reject when swap-word references a word not in the puzzle', () => {
    const result = parseAiReviewAction(
      { action: 'swap-word', badWordId: 'nonexistent', rationale: 'x' },
      context
    )
    expect(result.action).toBe('agree-reject')
  })

  it('falls back to agree-reject when swap-word is missing badWordId', () => {
    const result = parseAiReviewAction({ action: 'swap-word', rationale: 'x' }, context)
    expect(result.action).toBe('agree-reject')
  })

  it('falls back to agree-reject when adjust-difficulty has an out-of-range or non-integer newSubtlety', () => {
    expect(parseAiReviewAction({ action: 'adjust-difficulty', newSubtlety: 0, rationale: 'x' }, context).action).toBe(
      'agree-reject'
    )
    expect(parseAiReviewAction({ action: 'adjust-difficulty', newSubtlety: 6, rationale: 'x' }, context).action).toBe(
      'agree-reject'
    )
    expect(
      parseAiReviewAction({ action: 'adjust-difficulty', newSubtlety: 2.5, rationale: 'x' }, context).action
    ).toBe('agree-reject')
    expect(
      parseAiReviewAction({ action: 'adjust-difficulty', newSubtlety: '4', rationale: 'x' }, context).action
    ).toBe('agree-reject')
  })
})
