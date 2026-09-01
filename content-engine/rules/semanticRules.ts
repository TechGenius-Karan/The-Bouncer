import type { Rule } from './types'

// Category-membership rules used to be hand-written here, one per category,
// covering the 7 categories that 227 hand-reviewed words supported. They're now
// generated from tag coverage instead (rules/generatedRules.ts::categoryRule,
// driven by rules/ruleParams.ts), which scales with the AI tagger rather than
// with review effort — and keeps the same `category-<id>` rule ids, so puzzles
// already approved against them still resolve.
//
// Kept as an empty export rather than deleted: RULES composes three named
// sources and losing the semantic slot would make that seam less obvious the
// next time a non-category semantic rule (a property rule, say) needs a home.
export const SEMANTIC_RULES: Rule[] = []
