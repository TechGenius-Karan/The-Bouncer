import type { Tri } from './types.js'

// The tagging matrix (planning-visual-pivot.md §4.2): for each rule, which
// items are yes / no / unsure. An item in none of the three is untagged.

export type Cell = 'yes' | 'no' | 'unsure'

export const CELLS: readonly Cell[] = ['yes', 'no', 'unsure']

/**
 * One rule's answers, as space-separated item ids. Strings rather than arrays
 * keep ~300k ids cheap for tsc and for the function bundles that import them.
 */
export type TagRow = Partial<Record<Cell, string>>

export type TagTable = Record<string, TagRow>

export interface Matrix {
  /** `unsure` and untagged both read as null: neither is a fact a board can rest on. */
  valueOf(itemId: string, ruleId: string): Tri
  /** Undefined means untagged, which reports keep apart from `unsure`. */
  cellOf(itemId: string, ruleId: string): Cell | undefined
}

export const idsOf = (list: string | undefined): string[] => (list ?? '').split(' ').filter(Boolean)

function cellsOf(row: TagRow): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  for (const cell of CELLS) for (const id of idsOf(row[cell])) cells.set(id, cell)
  return cells
}

/** Overrides win per cell: a human answer replaces the AI's, whatever list it was in. */
export function buildMatrix(ai: TagTable, overrides: TagTable): Matrix {
  const byRule = new Map<string, Map<string, Cell>>()
  for (const [ruleId, row] of Object.entries(ai)) byRule.set(ruleId, cellsOf(row))
  for (const [ruleId, row] of Object.entries(overrides)) {
    const cells = byRule.get(ruleId) ?? new Map<string, Cell>()
    for (const [itemId, cell] of cellsOf(row)) cells.set(itemId, cell)
    byRule.set(ruleId, cells)
  }

  const cellOf = (itemId: string, ruleId: string) => byRule.get(ruleId)?.get(itemId)
  return {
    cellOf,
    valueOf(itemId, ruleId) {
      const cell = cellOf(itemId, ruleId)
      return cell === 'yes' ? true : cell === 'no' ? false : null
    },
  }
}

/** Problems with one tag file. An empty array means it is sound. */
export function validateTagTable(
  table: TagTable,
  ruleIds: Set<string>,
  itemIds: Set<string>
): string[] {
  const problems: string[] = []
  for (const [ruleId, row] of Object.entries(table)) {
    if (!ruleIds.has(ruleId)) problems.push(`${ruleId}: no such rule in this family`)
    const seen = new Set<string>()
    for (const cell of CELLS) {
      for (const id of idsOf(row[cell])) {
        if (!itemIds.has(id)) problems.push(`${ruleId}: unknown item "${id}"`)
        if (seen.has(id)) problems.push(`${ruleId}: "${id}" is listed more than once`)
        seen.add(id)
      }
    }
  }
  return problems
}
