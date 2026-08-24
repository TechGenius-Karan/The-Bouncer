import { LEXICAL_RULES } from './lexicalRules'
import { SEMANTIC_RULES } from './semanticRules'
import type { Rule } from './types'

export type { Rule, RuleFamily, Subtlety } from './types'

/** The full rule taxonomy (planning.md §7.1): lexical/structural + semantic/knowledge. */
export const RULES: Rule[] = [...LEXICAL_RULES, ...SEMANTIC_RULES]
