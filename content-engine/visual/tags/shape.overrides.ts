import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-has-a-hole': { unsure: 'electric-plug magnifying-glass motorcycle ruler wrench' },
  'visual-has-a-sharp-point': {
    unsure: 'carrot crown ice-cream-cone maple-leaf necktie pineapple',
  },
  'visual-has-straight-edges': { unsure: 'bread harp necktie skateboard' },
  'visual-long-and-thin': { unsure: 'fire-extinguisher giraffe mobile-phone socks violin' },
  'visual-round': { unsure: 'bell' },
}
