import type { Puzzle } from '../game/types'

// Phase 1 (build-plan.md): a couple of hardcoded, genuinely tricky puzzles
// baked directly into the frontend — no backend, no generator yet.

export const PUZZLES: Puzzle[] = [
  {
    id: 'body-parts',
    number: 214,
    dateLabel: 'Saturday, August 8',
    ruleText: 'Every IN word hides a body part inside it.',
    clues: {
      in: ['CHARMS', 'SHINE', 'FLIPPER'], // ARM, SHIN, LIP
      out: ['MARBLE', 'TANGO', 'PUDDLE'],
    },
    pool: [
      { word: 'BEARDS', isIn: true }, // EAR
      { word: 'PLANET', isIn: false },
      { word: 'TOENAIL', isIn: true }, // TOE
      { word: 'WALNUT', isIn: false },
      { word: 'CHINA', isIn: true }, // CHIN
      { word: 'MELODY', isIn: false },
    ],
  },
  {
    id: 'same-start-end',
    number: 215,
    dateLabel: 'Sunday, August 9',
    ruleText: 'The word starts and ends with the same letter.',
    clues: {
      in: ['LEVEL', 'STATS', 'ELUDE'],
      out: ['MARKET', 'TIGER', 'PLANET'],
    },
    pool: [
      { word: 'NOON', isIn: true },
      { word: 'GARDEN', isIn: false },
      { word: 'AROMA', isIn: true },
      { word: 'GADGET', isIn: false },
      { word: 'RADAR', isIn: true },
      { word: 'AWARD', isIn: false },
    ],
  },
]
