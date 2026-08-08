import { LEXICAL_RULES } from './lexicalRules'
import type { Rule } from './types'

export type { Rule, RuleFamily, Subtlety } from './types'

/**
 * The full rule taxonomy (planning.md §7.1). Only the lexical/structural
 * family is implemented so far — semantic/knowledge rules are deferred
 * (see build-plan.md Phase 2) and would be merged into this array later.
 */
export const RULES: Rule[] = [...LEXICAL_RULES]
