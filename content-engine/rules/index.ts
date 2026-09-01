import { GENERATED_RULES } from './generatedRules'
import { LEXICAL_RULES } from './lexicalRules'
import { SEMANTIC_RULES } from './semanticRules'
import type { Rule } from './types'

export type { Rule, RuleFamily, Subtlety } from './types'

/**
 * The full rule taxonomy (planning.md §7.1).
 *
 * Three sources: hand-written lexical one-offs (palindrome, anagram — rules
 * with no natural parameter), hand-written semantic rules (currently none —
 * category rules are generated), and the parameterized families built from
 * generated, coverage-checked data (generatedRules.ts). The generated set is
 * where taxonomy growth happens — hand-writing rules one at a time is what
 * left the game repeating a rule every couple of weeks.
 */
export const RULES: Rule[] = [...LEXICAL_RULES, ...SEMANTIC_RULES, ...GENERATED_RULES]
