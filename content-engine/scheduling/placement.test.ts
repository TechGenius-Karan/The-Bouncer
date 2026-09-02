import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import {
  daysBetween,
  isFreshFor,
  isLexicalRule,
  lexicalCapAllows,
  MAX_LEXICAL_PER_WEEK,
  RULE_SPACING_DAYS,
  selectForDate,
  type Placement,
} from './placement'

const lexicalRule = RULES.find((r) => r.family === 'lexical-structural')!
const semanticRule = RULES.find((r) => r.family === 'semantic-knowledge')!

function lexicalOn(dates: string[]): Placement[] {
  return dates.map((date) => ({ date, ruleId: lexicalRule.id, isLexical: true }))
}

describe('isLexicalRule', () => {
  it('classifies known rules by family', () => {
    expect(isLexicalRule(lexicalRule.id)).toBe(true)
    expect(isLexicalRule(semanticRule.id)).toBe(false)
  })

  // An unknown id must not be assumed lexical — that would restrict the
  // calendar on no evidence and risk empty days for nothing.
  it('treats a rule missing from the taxonomy as non-lexical', () => {
    expect(isLexicalRule('rule-that-no-longer-exists')).toBe(false)
  })
})

describe('lexicalCapAllows', () => {
  it('never blocks a non-lexical puzzle, however crowded the week', () => {
    const placements = lexicalOn(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])
    expect(lexicalCapAllows('2026-09-05', { ruleId: semanticRule.id }, placements)).toBe(true)
  })

  it(`allows up to ${MAX_LEXICAL_PER_WEEK} lexical puzzles in a week and blocks the next`, () => {
    const puzzle = { ruleId: lexicalRule.id }
    expect(lexicalCapAllows('2026-09-04', puzzle, lexicalOn(['2026-09-01', '2026-09-02']))).toBe(
      true
    )
    expect(
      lexicalCapAllows('2026-09-04', puzzle, lexicalOn(['2026-09-01', '2026-09-02', '2026-09-03']))
    ).toBe(false)
  })

  // The reason the window is rolling rather than calendar-week: three on
  // Fri/Sat/Sun must still block Monday.
  it('blocks across a week boundary', () => {
    // 2026-09-04/05/06 are Fri/Sat/Sun; 2026-09-07 is the following Monday.
    const weekend = lexicalOn(['2026-09-04', '2026-09-05', '2026-09-06'])
    expect(lexicalCapAllows('2026-09-07', { ruleId: lexicalRule.id }, weekend)).toBe(false)
  })

  it('lets the window roll past — the cap frees up once the run is 7 days behind', () => {
    const early = lexicalOn(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(lexicalCapAllows('2026-09-08', { ruleId: lexicalRule.id }, early)).toBe(true)
  })

  it('ignores placements after the date being filled', () => {
    // Trailing window only: dates the scheduler has not reached yet must not
    // consume this date's budget.
    const future = lexicalOn(['2026-09-10', '2026-09-11', '2026-09-12'])
    expect(lexicalCapAllows('2026-09-05', { ruleId: lexicalRule.id }, future)).toBe(true)
  })

  it('does not count non-lexical placements toward the cap', () => {
    const semantic: Placement[] = ['2026-09-01', '2026-09-02', '2026-09-03'].map((date) => ({
      date,
      ruleId: semanticRule.id,
      isLexical: false,
    }))
    expect(lexicalCapAllows('2026-09-04', { ruleId: lexicalRule.id }, semantic)).toBe(true)
  })
})

describe('isFreshFor', () => {
  it('keeps the same rule apart by the full spacing window', () => {
    const placements: Placement[] = [{ date: '2026-09-01', ruleId: 'rule-a', isLexical: true }]
    expect(isFreshFor('2026-09-20', { ruleId: 'rule-a' }, placements)).toBe(false)
    const wellPast = `2026-${String(11).padStart(2, '0')}-15` // > 60 days later
    expect(daysBetween(wellPast, '2026-09-01')).toBeGreaterThan(RULE_SPACING_DAYS)
    expect(isFreshFor(wellPast, { ruleId: 'rule-a' }, placements)).toBe(true)
  })

  it('spaces template families more tightly than individual rules', () => {
    const placements: Placement[] = [
      { date: '2026-09-01', ruleId: 'ends-with-a', templateId: 'ends-with', isLexical: true },
    ]
    const sameFamily = { ruleId: 'ends-with-b', templateId: 'ends-with' }
    expect(isFreshFor('2026-09-04', sameFamily, placements)).toBe(false)
    expect(isFreshFor('2026-09-10', sameFamily, placements)).toBe(true)
  })

  it('lets an untemplated rule sit next to a templated one', () => {
    const placements: Placement[] = [
      { date: '2026-09-01', ruleId: 'ends-with-a', templateId: 'ends-with', isLexical: true },
    ]
    expect(isFreshFor('2026-09-02', { ruleId: 'palindrome' }, placements)).toBe(true)
  })
})

// Drives the real selectForDate across a realistic pool, rather than
// re-implementing the scheduler in the test. The pool mirrors what the
// generator actually produces: measured at 60% semantic on medium and 20% on
// spicy, with Saturdays drawing from the spicy queue.
describe('90-day schedule simulation', () => {
  function buildQueue(count: number, semanticShare: number, tier: string) {
    const mediumSemantic = RULES.filter(
      (r) => r.family === 'semantic-knowledge' && r.subtlety >= 2 && r.subtlety <= 3
    )
    const mediumLexical = RULES.filter(
      (r) => r.family === 'lexical-structural' && r.subtlety >= 2 && r.subtlety <= 3
    )
    return Array.from({ length: count }, (_, i) => {
      const wantSemantic = i % 100 < semanticShare * 100
      const pool = wantSemantic ? mediumSemantic : mediumLexical
      const rule = pool[Math.floor(i / 2) % pool.length]
      return { ruleId: rule.id, templateId: rule.templateId, tier }
    })
  }

  function run() {
    const medium = buildQueue(160, 0.6, 'medium')
    const spicy = buildQueue(40, 0.2, 'spicy')
    const placements: Placement[] = []
    let skipped = 0
    let overCap = 0

    const start = Date.UTC(2026, 8, 1) // 2026-09-01
    for (let day = 0; day < 90; day++) {
      const d = new Date(start + day * 86_400_000)
      const date = d.toISOString().slice(0, 10)
      const queue = d.getUTCDay() === 6 ? spicy : medium

      const choice = selectForDate(date, queue, placements)
      if (choice.index === -1) {
        skipped++
        continue
      }
      if (choice.overCap) overCap++
      const picked = queue.splice(choice.index, 1)[0]
      placements.push({
        date,
        ruleId: picked.ruleId,
        templateId: picked.templateId,
        isLexical: isLexicalRule(picked.ruleId),
      })
    }
    return { placements, skipped, overCap }
  }

  it('fills all 90 days with no gaps', () => {
    const { placements, skipped } = run()
    expect(skipped).toBe(0)
    expect(placements).toHaveLength(90)
  })

  // The cap is a soft target and currently runs slightly ahead of supply
  // (27 semantic rules / 60-day cooldown sustains ~3.2 semantic per week; a
  // 3/week lexical cap wants 4). So it overshoots rather than holding exactly,
  // and what matters is that the overshoot stays bounded instead of the cap
  // being ignored. Tighten these once the semantic taxonomy passes ~35 rules.
  it('keeps every rolling 7-day window near the cap', () => {
    const { placements } = run()
    for (const anchor of placements) {
      const inWindow = placements.filter(
        (p) => p.isLexical && daysBetween(anchor.date, p.date) < 7 && p.date >= anchor.date
      )
      expect(inWindow.length).toBeLessThanOrEqual(MAX_LEXICAL_PER_WEEK + 2)
    }
  })

  it('brings the lexical share down well below the taxonomy’s 79%', () => {
    const { placements } = run()
    const share = placements.filter((p) => p.isLexical).length / placements.length
    // 3 of 7 days would be 43%. Saturdays draw from a lexical-heavy spicy pool
    // and supply is tight, so the realistic landing zone is around 49% — but
    // it must stay far below the 79% an untouched taxonomy produces, and below
    // the 57% the same pool gives with no cap at all.
    expect(share).toBeGreaterThan(0.25)
    expect(share).toBeLessThan(0.55)
  })
})

// The cap is only meaningful if the taxonomy can actually feed it. Each rule is
// usable once per RULE_SPACING_DAYS, so a 60-day window needs roughly
// (medium days - lexical slots) distinct medium-eligible semantic rules. This
// fails loudly if someone lowers the cap past what supply supports, or if the
// semantic side of the taxonomy shrinks.
describe('supply supports the cap', () => {
  // Steady state, not a one-off window: each rule is usable once per
  // RULE_SPACING_DAYS, so the sustainable semantic rate is
  // (semantic rules / RULE_SPACING_DAYS) per day. The cap is deliberately set
  // a little ahead of that today, so this asserts the gap stays *small* — a
  // cap far beyond supply stops being a target and just means every day is
  // placed over it.
  it('is within reach of the semantic rules the taxonomy actually has', () => {
    const mediumSemantic = RULES.filter(
      (r) => r.subtlety >= 2 && r.subtlety <= 3 && r.family === 'semantic-knowledge'
    ).length

    const semanticNeededPerWeek = 7 - MAX_LEXICAL_PER_WEEK
    const sustainablePerWeek = (mediumSemantic / RULE_SPACING_DAYS) * 7
    const rulesForCleanCap = Math.ceil((semanticNeededPerWeek / 7) * RULE_SPACING_DAYS)

    expect(
      sustainablePerWeek,
      `MAX_LEXICAL_PER_WEEK=${MAX_LEXICAL_PER_WEEK} wants ${semanticNeededPerWeek} semantic puzzles a week; ` +
        `${mediumSemantic} medium-eligible semantic rules sustain ${sustainablePerWeek.toFixed(1)}. ` +
        `Either raise the cap or grow the taxonomy to ~${rulesForCleanCap} semantic rules.`
    ).toBeGreaterThan(semanticNeededPerWeek - 1)
  })
})
