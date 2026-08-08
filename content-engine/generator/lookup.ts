import type { Rule } from '../rules/types'
import type { Word } from '../words/types'

export function buildWordIndex(wordBank: Word[]): Map<string, Word> {
  return new Map(wordBank.map((w) => [w.id, w]))
}

export function buildRuleIndex(rules: Rule[]): Map<string, Rule> {
  return new Map(rules.map((r) => [r.id, r]))
}

export function mustFind<T>(index: Map<string, T>, id: string, kind: string): T {
  const found = index.get(id)
  if (!found) throw new Error(`Unknown ${kind} id: ${id}`)
  return found
}
