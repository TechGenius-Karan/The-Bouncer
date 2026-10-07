import type { GeneratorInput } from './generator.js'
import { buildMatrix, type TagTable } from './matrix.js'
import type { Item, ItemGroup, VisualRule } from './types.js'

// A synthetic world for the generator and batch tests: 60 items, i0 … i59,
// with rules defined by index so the expected answers are easy to reason about.
const GROUPS: ItemGroup[] = ['thing', 'food', 'vehicle', 'animal', 'plant']
export const ITEMS: Item[] = Array.from({ length: 60 }, (_, n) => ({
  id: `i${n}`,
  name: `item ${n}`,
  group: GROUPS[n % 5],
  icon: { set: 'openmoji', hex: '2693' },
}))

export const rule = (id: string): VisualRule => ({
  id,
  family: 'physical',
  reveal: 'It is a thing.',
})

/** Tags every item by `test`, except the listed ones: unsure, or left untagged. */
export function tags(
  test: (n: number) => boolean,
  { unsure = [] as number[], untagged = [] as number[] } = {}
) {
  const row = { yes: [] as string[], no: [] as string[], unsure: [] as string[] }
  ITEMS.forEach((_, n) => {
    if (untagged.includes(n)) return
    if (unsure.includes(n)) row.unsure.push(`i${n}`)
    else (test(n) ? row.yes : row.no).push(`i${n}`)
  })
  return { yes: row.yes.join(' '), no: row.no.join(' '), unsure: row.unsure.join(' ') }
}

export const even = (n: number) => n % 2 === 0
// T: even numbers. i0, i1 are unsure and i2, i3 untagged, so none of them may ever appear.
export const NULL_ON_T = new Set(['i0', 'i1', 'i2', 'i3'])
export const TABLE: TagTable = {
  'visual-t': tags(even, { unsure: [0, 1], untagged: [2, 3] }),
  // Near-copies of T and of its inverse: these are what fit the clues as decoys.
  'visual-near-7': tags((n) => even(n) !== (n % 7 === 0)),
  'visual-near-11': tags((n) => even(n) !== (n % 11 === 0)),
  'visual-inverse-13': tags((n) => !even(n) !== (n % 13 === 0)),
  // Unrelated rivals the board still has to rule out.
  'visual-thirds': tags((n) => n % 3 === 0),
  'visual-low': tags((n) => n < 30),
  // Same split as T, used only by the rule-exclusion tests.
  'visual-t2': tags((n) => n % 4 < 2),
}
export const RULES = [...Object.keys(TABLE), 'visual-untagged'].map(rule)
export const T = RULES[0]

export const worldInput = (extra: Partial<GeneratorInput> = {}): GeneratorInput => ({
  items: ITEMS,
  rules: RULES,
  matrix: buildMatrix(TABLE, {}),
  usedRuleIds: new Set(),
  pendingRuleIds: new Set(),
  rejectCounts: new Map(),
  ...extra,
})
