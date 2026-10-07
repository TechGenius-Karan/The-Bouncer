import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-found-in-a-bathroom': { unsure: 'bandage' },
  'visual-found-in-a-classroom': {
    unsure: 'electric-plug envelope fire-extinguisher light-bulb magnet sponge',
  },
  'visual-found-in-a-garden': { unsure: 'chair ladder soccer-ball' },
  'visual-found-in-a-kitchen': {
    unsure: 'chocolate-bar doughnut hamburger ice-cream-cone pizza popcorn',
  },
  'visual-found-in-most-homes': { unsure: 'bathtub spider' },
  'visual-found-in-the-sea': { unsure: 'fishing-rod sponge' },
  'visual-found-on-a-farm': {
    unsure:
      'bandage battery bell broom car cardboard-box chair electric-plug fire-extinguisher flashlight key kitchen-knife light-bulb padlock screwdriver spider syringe wrench',
  },
  'visual-found-outdoors': { unsure: 'sunglasses' },
}
