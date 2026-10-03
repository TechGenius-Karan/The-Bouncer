import type { TagTable } from '../matrix.js'

// Human tagging decisions for this family (planning-visual-pivot.md §4.2).
// Each listed item wins over the AI draft for that rule. Never generated.
// Format: 'visual-rule-id': { yes: 'item-id item-id', no: '…', unsure: '…' }

// Reviewed 2026-10-03 against the first Gemini draft.
export const TAGS: TagTable = {
  'visual-breaks-if-dropped': {
    unsure: 'bell candle guitar harp sunglasses syringe trophy violin',
  },
  'visual-burns-easily': {
    unsure:
      'backpack balloon bandage bed boomerang bread chair credit-card dice drum gloves guitar harp paintbrush ruler running-shoe soccer-ball sponge toothbrush treasure-chest umbrella violin',
  },
  'visual-conducts-electricity': {
    unsure:
      'camera headphones ice-skate laptop microphone microscope mobile-phone teapot television trophy',
  },
  'visual-floats': {
    unsure:
      'bear book camel cat chicken cookie cow dog elephant fish frog giraffe horse jar mouse newspaper owl penguin pig rabbit sheep skateboard snake turtle umbrella whale',
  },
  'visual-sticks-to-a-magnet': {
    unsure:
      'camera electric-plug headphones helicopter laptop light-bulb magnifying-glass microphone microscope mobile-phone rocket shield skateboard television treasure-chest umbrella',
  },
}
