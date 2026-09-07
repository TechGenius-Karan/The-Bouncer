import { describe, expect, it } from 'vitest'
import { RULES } from '../rules'
import {
  daysBetween,
  isFreshFor,
  isFillerRule,
  fillerCapAllows,
  MAX_FILLER_PER_WEEK,
  RULE_SPACING_DAYS,
  selectForDate,
  type Placement,
} from './placement'

// Chosen by rating, not family — that is the whole point of the filler cap.
// `hidden-word` is lexical AND high-aha, and it must NOT be treated as filler;
// picking fixtures by family would hide exactly the bug this cap was changed
// to fix.
const fillerRule = RULES.find((r) => (r.aha ?? 3) <= 2)!
const qualityRule = RULES.find((r) => (r.aha ?? 3) >= 3)!
const lexicalButGood = RULES.find((r) => r.family === 'lexical-structural' && (r.aha ?? 3) >= 3)!

/** A fixed anchor so every cap assertion talks about the same week. */
const TARGET = '2026-09-20'

/** `count` consecutive dates ending `gap` days before TARGET, oldest first. */
function daysBefore(count: number, gap = 1): string[] {
  const end = Date.parse(`${TARGET}T00:00:00Z`) - gap * 86_400_000
  return Array.from({ length: count }, (_, i) =>
    new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10)
  )
}

function fillerOn(dates: string[]): Placement[] {
  return dates.map((date) => ({ date, ruleId: fillerRule.id, isFiller: true }))
}

describe('isFillerRule', () => {
  it('classifies by rating, not by family', () => {
    expect(isFillerRule(fillerRule.id)).toBe(true)
    expect(isFillerRule(qualityRule.id)).toBe(false)
  })

  // The regression this cap exists to prevent: hidden-word is lexical and is
  // the best-reviewed template in the taxonomy. Capping it alongside
  // starts-with is what kept the good material off weekdays.
  it('does not treat a high-aha lexical rule as filler', () => {
    expect(lexicalButGood.family).toBe('lexical-structural')
    expect(isFillerRule(lexicalButGood.id)).toBe(false)
  })

  // An unknown id must not be assumed filler — that would restrict the
  // calendar on no evidence and risk empty days for nothing.
  it('treats a rule missing from the taxonomy as non-filler', () => {
    expect(isFillerRule('rule-that-no-longer-exists')).toBe(false)
  })
})

describe('fillerCapAllows', () => {
  it('never blocks a quality puzzle, however crowded the week', () => {
    const placements = fillerOn(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])
    expect(fillerCapAllows('2026-09-05', { ruleId: qualityRule.id }, placements)).toBe(true)
  })

  it(`allows up to ${MAX_FILLER_PER_WEEK} filler puzzles in a week and blocks the next`, () => {
    const puzzle = { ruleId: fillerRule.id }
    // Derived from the constant rather than hardcoded: these assertions were
    // written when the cap was 3 and silently became wrong when it moved to 2.
    expect(fillerCapAllows(TARGET, puzzle, fillerOn(daysBefore(MAX_FILLER_PER_WEEK - 1)))).toBe(
      true
    )
    expect(fillerCapAllows(TARGET, puzzle, fillerOn(daysBefore(MAX_FILLER_PER_WEEK)))).toBe(false)
  })

  // The reason the window is rolling rather than calendar-week: three on
  // Fri/Sat/Sun must still block Monday.
  it('blocks across a week boundary', () => {
    // 2026-09-04/05/06 are Fri/Sat/Sun; 2026-09-07 is the following Monday.
    const weekend = fillerOn(['2026-09-05', '2026-09-06'].slice(0, MAX_FILLER_PER_WEEK))
    expect(fillerCapAllows('2026-09-07', { ruleId: fillerRule.id }, weekend)).toBe(false)
  })

  it('lets the window roll past — the cap frees up once the run is 7 days behind', () => {
    // A full cap's worth, all of it more than FILLER_WINDOW_DAYS before the
    // target, so none of it should still be counted.
    const early = fillerOn(daysBefore(MAX_FILLER_PER_WEEK, 14))
    expect(fillerCapAllows(TARGET, { ruleId: fillerRule.id }, early)).toBe(true)
  })

  it('ignores placements after the date being filled', () => {
    // Trailing window only: dates the scheduler has not reached yet must not
    // consume this date's budget.
    const future = fillerOn(['2026-09-10', '2026-09-11', '2026-09-12'])
    expect(fillerCapAllows('2026-09-05', { ruleId: fillerRule.id }, future)).toBe(true)
  })

  it('does not count quality placements toward the cap', () => {
    const semantic: Placement[] = ['2026-09-01', '2026-09-02', '2026-09-03'].map((date) => ({
      date,
      ruleId: qualityRule.id,
      isFiller: false,
    }))
    expect(fillerCapAllows('2026-09-04', { ruleId: fillerRule.id }, semantic)).toBe(true)
  })
})

describe('isFreshFor', () => {
  it('keeps the same rule apart by the full spacing window', () => {
    const placements: Placement[] = [{ date: '2026-09-01', ruleId: 'rule-a', isFiller: true }]
    expect(isFreshFor('2026-09-20', { ruleId: 'rule-a' }, placements)).toBe(false)
    const wellPast = `2026-${String(11).padStart(2, '0')}-15` // > 60 days later
    expect(daysBetween(wellPast, '2026-09-01')).toBeGreaterThan(RULE_SPACING_DAYS)
    expect(isFreshFor(wellPast, { ruleId: 'rule-a' }, placements)).toBe(true)
  })

  it('spaces template families more tightly than individual rules', () => {
    const placements: Placement[] = [
      { date: '2026-09-01', ruleId: 'ends-with-a', templateId: 'ends-with', isFiller: true },
    ]
    const sameFamily = { ruleId: 'ends-with-b', templateId: 'ends-with' }
    expect(isFreshFor('2026-09-04', sameFamily, placements)).toBe(false)
    expect(isFreshFor('2026-09-10', sameFamily, placements)).toBe(true)
  })

  it('lets an untemplated rule sit next to a templated one', () => {
    const placements: Placement[] = [
      { date: '2026-09-01', ruleId: 'ends-with-a', templateId: 'ends-with', isFiller: true },
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
        isFiller: isFillerRule(picked.ruleId),
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
        (p) => p.isFiller && daysBetween(anchor.date, p.date) < 7 && p.date >= anchor.date
      )
      expect(inWindow.length).toBeLessThanOrEqual(MAX_FILLER_PER_WEEK + 2)
    }
  })

  it('brings the filler share down well below the taxonomy’s 79%', () => {
    const { placements } = run()
    const share = placements.filter((p) => p.isFiller).length / placements.length
    // No lower bound on purpose. Quality supply now covers all six medium days
    // (~7.4/week against 6 needed), so a schedule with zero filler is a valid
    // and desirable outcome — an earlier floor of 25% started failing the
    // moment the re-rating worked, which is the wrong way round for a test.
    // Measured after Phases 1-2: ~21%, against 79% for the raw taxonomy.
    expect(share).toBeLessThan(0.35)
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

    const semanticNeededPerWeek = 7 - MAX_FILLER_PER_WEEK
    const sustainablePerWeek = (mediumSemantic / RULE_SPACING_DAYS) * 7
    const rulesForCleanCap = Math.ceil((semanticNeededPerWeek / 7) * RULE_SPACING_DAYS)

    expect(
      sustainablePerWeek,
      `MAX_FILLER_PER_WEEK=${MAX_FILLER_PER_WEEK} wants ${semanticNeededPerWeek} semantic puzzles a week; ` +
        `${mediumSemantic} medium-eligible semantic rules sustain ${sustainablePerWeek.toFixed(1)}. ` +
        `Either raise the cap or grow the taxonomy to ~${rulesForCleanCap} semantic rules.`
    ).toBeGreaterThan(semanticNeededPerWeek - 1)
  })
})
