import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-hard': { unsure: 'lemon' },
  'visual-loud': { unsure: 'balloon harp laptop violin' },
  'visual-smells-strong': {
    unsure: 'apple banana bus candle car motorcycle steam-train strawberry tractor truck',
  },
  'visual-soft': { unsure: 'bear owl' },
}
