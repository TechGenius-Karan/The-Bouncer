export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

/** Rule #8 (hidden-number): fixed substrings to search for — no external dictionary needed. */
export const HIDDEN_WORD_TARGETS = ['one', 'two', 'six', 'ten', 'nine'] as const

/** Rule #10 (subsequence): fixed in-order-letter targets — no external dictionary needed. */
export const SUBSEQUENCE_TARGETS = ['ace'] as const
