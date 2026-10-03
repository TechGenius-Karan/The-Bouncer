import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-has-a-handle': {
    unsure: 'ambulance bell bus car fire-engine flashlight shield tractor truck',
  },
  'visual-has-a-lid': { unsure: 'laptop' },
  'visual-has-a-tail': { unsure: 'airplane bear helicopter teddy-bear' },
  'visual-has-legs': { yes: 'teddy-bear', unsure: 'octopus' },
}
