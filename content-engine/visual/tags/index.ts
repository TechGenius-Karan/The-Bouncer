import { buildMatrix, type TagTable } from '../matrix.js'
import type { Family } from '../types.js'
import { TAGS as contextAi } from './context.ai.js'
import { TAGS as contextOverrides } from './context.overrides.js'
import { TAGS as hasPartAi } from './has-part.ai.js'
import { TAGS as hasPartOverrides } from './has-part.overrides.js'
import { TAGS as howUsedAi } from './how-used.ai.js'
import { TAGS as howUsedOverrides } from './how-used.overrides.js'
import { TAGS as livingAi } from './living.ai.js'
import { TAGS as livingOverrides } from './living.overrides.js'
import { TAGS as madeOfAi } from './made-of.ai.js'
import { TAGS as madeOfOverrides } from './made-of.overrides.js'
import { TAGS as physicalAi } from './physical.ai.js'
import { TAGS as physicalOverrides } from './physical.overrides.js'
import { TAGS as sensesAi } from './senses.ai.js'
import { TAGS as sensesOverrides } from './senses.overrides.js'
import { TAGS as shapeAi } from './shape.ai.js'
import { TAGS as shapeOverrides } from './shape.overrides.js'
import { TAGS as sizeWeightAi } from './size-weight.ai.js'
import { TAGS as sizeWeightOverrides } from './size-weight.overrides.js'
import { TAGS as whatItDoesAi } from './what-it-does.ai.js'
import { TAGS as whatItDoesOverrides } from './what-it-does.overrides.js'
import { TAGS as whereFoundAi } from './where-found.ai.js'
import { TAGS as whereFoundOverrides } from './where-found.overrides.js'

/** One AI file and one override file per family, so each stays a reviewable size (§4.2). */
export const TAG_FILES: Record<Family, { ai: TagTable; overrides: TagTable }> = {
  'has-part': { ai: hasPartAi, overrides: hasPartOverrides },
  'made-of': { ai: madeOfAi, overrides: madeOfOverrides },
  'where-found': { ai: whereFoundAi, overrides: whereFoundOverrides },
  'what-it-does': { ai: whatItDoesAi, overrides: whatItDoesOverrides },
  physical: { ai: physicalAi, overrides: physicalOverrides },
  'how-used': { ai: howUsedAi, overrides: howUsedOverrides },
  'size-weight': { ai: sizeWeightAi, overrides: sizeWeightOverrides },
  senses: { ai: sensesAi, overrides: sensesOverrides },
  living: { ai: livingAi, overrides: livingOverrides },
  shape: { ai: shapeAi, overrides: shapeOverrides },
  context: { ai: contextAi, overrides: contextOverrides },
}

const files = Object.values(TAG_FILES)

export const MATRIX = buildMatrix(
  Object.assign({}, ...files.map((f) => f.ai)),
  Object.assign({}, ...files.map((f) => f.overrides))
)
