import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-at-a-party': { unsure: 'bread chair mobile-phone spoon' },
  'visual-at-the-beach': { unsure: 'anchor apple backpack banana book camera dog pineapple' },
}
