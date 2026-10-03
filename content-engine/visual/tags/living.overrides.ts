import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-grows-on-a-plant': { unsure: 'carrot four-leaf-clover onion peanuts popcorn potato' },
  'visual-is-a-plant': { no: 'popcorn' },
  'visual-made-by-people': { unsure: 'glass-of-milk honey-pot' },
}
