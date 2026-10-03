import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-needs-power': { unsure: 'rocket' },
  'visual-needs-two-hands': {
    no: 'umbrella',
    unsure:
      'backpack bandage bucket envelope gloves headphones ice-skate mirror ruler running-shoe socks teapot teddy-bear trophy',
  },
  'visual-used-every-day': { unsure: 'car socks' },
  'visual-used-in-one-hand': {
    unsure: 'battery electric-plug envelope feather ice-cube jar light-bulb seashell',
  },
  'visual-used-with-water': {
    no: 'crab duck fish four-leaf-clover frog octopus palm-tree pine-tree rose shark sunflower tree tulip turtle whale',
    unsure: 'steam-train',
  },
}
