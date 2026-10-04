import { describe, expect, it } from 'vitest'
import {
  buildBoard,
  collides,
  eligibleRules,
  generateVisualCandidate,
  liveDecoys,
  rivalReadings,
} from './generator.js'
import { buildMatrix } from './matrix.js'
import { even, ITEMS, NULL_ON_T, RULES, rule, T, TABLE, tags, worldInput } from './testWorld.js'
import type { VisualCandidate } from './types.js'

const boardOf = (c: VisualCandidate) => [
  ...c.clues.map((x) => ({ itemId: x.wordId, label: x.label })),
  ...c.guests.map((g) => ({ itemId: g.wordId, label: g.trueLabel })),
]

const SEEDS = Array.from({ length: 200 }, (_, n) => n + 1)
const boards = SEEDS.map((seed) => buildBoard(T, worldInput(), seed)).filter(
  (c): c is VisualCandidate => c !== null
)

describe('collides (§4.4)', () => {
  const matrix = buildMatrix(
    { 'visual-r': { yes: 'a b', no: 'c', unsure: 'd' }, 'visual-blank': { unsure: 'a b c d' } },
    {}
  )
  const r = { rule: rule('visual-r'), negated: false }
  const board = [
    { itemId: 'a', label: 'IN' as const },
    { itemId: 'b', label: 'IN' as const },
    { itemId: 'c', label: 'OUT' as const },
  ]

  it('is a collision when the rival agrees everywhere it is definite, even with a null item', () => {
    expect(collides([...board, { itemId: 'd', label: 'OUT' }], r, matrix)).toBe(true)
  })

  it('is not a collision once one item definitely contradicts the rival', () => {
    expect(collides([...board, { itemId: 'b', label: 'OUT' }], r, matrix)).toBe(false)
  })

  it('catches a rival that matches the board inverted', () => {
    const inverted = board.map((b) => ({ ...b, label: b.label === 'IN' ? 'OUT' : 'IN' }) as const)
    expect(collides(inverted, r, matrix)).toBe(false)
    expect(collides(inverted, { ...r, negated: true }, matrix)).toBe(true)
  })

  it('counts a rival that is null on every item as a collision', () => {
    expect(collides(board, { rule: rule('visual-blank'), negated: false }, matrix)).toBe(true)
  })
})

describe('liveDecoys (§4.5 step 4)', () => {
  it('needs a definite agreeing answer on every clue, unlike collides', () => {
    const matrix = buildMatrix({ 'visual-r': { yes: 'a', no: 'c', unsure: 'b' } }, {})
    const r = { rule: rule('visual-r'), negated: false }
    const clues = [
      { itemId: 'a', label: 'IN' as const },
      { itemId: 'b', label: 'IN' as const },
      { itemId: 'c', label: 'OUT' as const },
    ]
    expect(liveDecoys(clues, [r], matrix)).toEqual([])
    expect(collides(clues, r, matrix)).toBe(true)
  })
})

describe('rivalReadings', () => {
  it('leaves out T itself and any rule nobody has tagged, and reads the rest both ways', () => {
    const ids = rivalReadings(T, worldInput()).map((r) => `${r.negated ? '!' : ''}${r.rule.id}`)
    expect(ids).not.toContain('visual-t')
    expect(ids).not.toContain('visual-untagged')
    expect(ids).toContain('visual-low')
    expect(ids).toContain('!visual-low')
  })

  it('skips a retired rule merged into T, but keeps one merged into another rule', () => {
    const merged = { ...rule('visual-merged'), retired: true, mergedInto: ['visual-t'] }
    const elsewhere = { ...rule('visual-elsewhere'), retired: true, mergedInto: ['visual-low'] }
    // Both are exact copies of T, so either one as a rival blocks every board.
    const matrix = buildMatrix(
      { ...TABLE, 'visual-merged': TABLE['visual-t'], 'visual-elsewhere': TABLE['visual-t'] },
      {}
    )
    const both = worldInput({ rules: [...RULES, merged, elsewhere], matrix })
    const ids = rivalReadings(T, both).map((r) => r.rule.id)
    expect(ids).not.toContain('visual-merged')
    expect(ids).toContain('visual-elsewhere')

    const mergedOnly = worldInput({ rules: [...RULES, merged], matrix })
    expect(SEEDS.slice(0, 20).some((s) => buildBoard(T, mergedOnly, s) !== null)).toBe(true)
  })
})

describe('buildBoard', () => {
  it('builds boards for most seeds', () => {
    expect(boards.length).toBeGreaterThan(SEEDS.length / 2)
  })

  it('never puts an item that is null or untagged on T on the board', () => {
    for (const c of boards) for (const b of boardOf(c)) expect(NULL_ON_T.has(b.itemId)).toBe(false)
  })

  it('labels every item by T and repeats none', () => {
    for (const c of boards) {
      const board = boardOf(c)
      expect(new Set(board.map((b) => b.itemId)).size).toBe(12)
      for (const b of board) expect(even(Number(b.itemId.slice(1)))).toBe(b.label === 'IN')
    }
  })

  it('leaves no rival reading that fits the whole board', () => {
    const rivals = rivalReadings(T, worldInput())
    const matrix = worldInput().matrix
    for (const c of boards) {
      expect(rivals.filter((r) => collides(boardOf(c), r, matrix))).toEqual([])
    }
  })

  it('has at least one live decoy, and traps that are definite on a decoy', () => {
    const matrix = worldInput().matrix
    const placeOn = (itemId: string, d: VisualCandidate['liveDecoys'][number]) => {
      const v = matrix.valueOf(itemId, d.ruleId)
      return v === null ? null : v !== (d.negated === true)
    }
    for (const c of boards) {
      expect(c.liveDecoys.length).toBeGreaterThanOrEqual(1)
      const decoyTraps = c.guests.filter((g) => g.trapType === 'decoy')
      const looksWrong = c.guests.find((g) => g.trapType === 't-but-looks-wrong')
      for (const g of decoyTraps) expect(g.trueLabel).toBe('OUT')
      if (looksWrong) {
        expect(decoyTraps).toHaveLength(1)
        expect(looksWrong.trueLabel).toBe('IN')
        expect(
          c.liveDecoys.some(
            (d) =>
              placeOn(decoyTraps[0].wordId, d) === true && placeOn(looksWrong.wordId, d) === false
          )
        ).toBe(true)
        continue
      }
      // A second decoy trap only when no decoy could have had both traps.
      expect(decoyTraps).toHaveLength(2)
      expect(c.liveDecoys.some((d) => decoyTraps.every((g) => placeOn(g.wordId, d) === true))).toBe(
        true
      )
      const free = ITEMS.filter((i) => !c.clues.some((x) => x.wordId === i.id))
      const onT = (i: (typeof ITEMS)[number]) => matrix.valueOf(i.id, T.id)
      for (const d of c.liveDecoys) {
        const looksWrongExists = free.some((i) => onT(i) === true && placeOn(i.id, d) === false)
        const decoyTrapExists = free.some((i) => onT(i) === false && placeOn(i.id, d) === true)
        expect(looksWrongExists && decoyTrapExists).toBe(false)
      }
    }
    const onTarget = boards.filter((c) => c.liveDecoys.length >= 2 && c.liveDecoys.length <= 3)
    expect(onTarget.length).toBeGreaterThan(boards.length / 2)
  })

  it('varies the number of IN guests, with 3 the most common', () => {
    const tally = new Map<number, number>()
    for (const c of boards) {
      const n = c.guests.filter((g) => g.trueLabel === 'IN').length
      tally.set(n, (tally.get(n) ?? 0) + 1)
    }
    expect(tally.size).toBeGreaterThanOrEqual(3)
    expect([...tally].sort((a, b) => b[1] - a[1])[0][0]).toBe(3)
  })

  it('takes two decoy traps when the only decoy is a superset of T', () => {
    // Every even item is IN on it too, so no guest can fit T and look wrong to it.
    const superset = worldInput({
      rules: [T, rule('visual-super')],
      matrix: buildMatrix(
        { 'visual-t': TABLE['visual-t'], 'visual-super': tags((n) => even(n) || n % 5 === 1) },
        {}
      ),
    })
    const built = SEEDS.slice(0, 50)
      .map((s) => buildBoard(T, superset, s))
      .filter((c): c is VisualCandidate => c !== null)
    expect(built.length).toBeGreaterThan(25)
    for (const c of built) {
      expect(c.guests.filter((g) => g.isTrap).map((g) => g.trapType)).toEqual(['decoy', 'decoy'])
      expect(c.guests).toHaveLength(6)
    }
  })

  it('spreads the IN clues over at least two groups', () => {
    for (const c of boards) {
      const groups = c.clues
        .filter((x) => x.label === 'IN')
        .map((x) => ITEMS.find((i) => i.id === x.wordId)!.group)
      expect(new Set(groups).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('emits the stored shape: 3 + 3 clues, 6 guests, kind, tier and seed', () => {
    const c = boards[0]
    expect(c.kind).toBe('visual')
    expect(c.difficultyTier).toBe('medium')
    expect(c.status).toBe('pending_approval')
    expect(c.clues.map((x) => x.label)).toEqual(['IN', 'IN', 'IN', 'OUT', 'OUT', 'OUT'])
    expect(c.guests.map((g) => g.displayOrder)).toEqual([0, 1, 2, 3, 4, 5])
    expect(c.guests.filter((g) => g.isTrap)).toHaveLength(2)
    expect(buildBoard(T, worldInput(), c.generatorSeed)).toEqual(c)
  })

  it('returns null when no rival fits the clues', () => {
    // Yes on everything: it can never agree with an OUT clue, nor inverted with an IN one.
    const lonely = worldInput({
      rules: [T, rule('visual-all')],
      matrix: buildMatrix({ ...TABLE, 'visual-all': tags(() => true) }, {}),
    })
    expect(SEEDS.slice(0, 20).map((s) => buildBoard(T, lonely, s))).toEqual(Array(20).fill(null))
  })
})

describe('generateVisualCandidate', () => {
  it('is deterministic per seed', () => {
    expect(generateVisualCandidate(worldInput(), 7)).toEqual(
      generateVisualCandidate(worldInput(), 7)
    )
    expect(generateVisualCandidate(worldInput(), 7)).not.toEqual(
      generateVisualCandidate(worldInput(), 8)
    )
  })

  it('never drafts a used or pending rule', () => {
    const blocked = worldInput({
      usedRuleIds: new Set(['visual-t']),
      pendingRuleIds: new Set(['visual-t2']),
    })
    expect(eligibleRules(blocked).map((r) => r.id)).not.toContain('visual-t')
    expect(eligibleRules(blocked).map((r) => r.id)).not.toContain('visual-t2')
    for (const seed of SEEDS.slice(0, 50)) {
      const c = generateVisualCandidate(blocked, seed)
      if (c) expect(['visual-t', 'visual-t2']).not.toContain(c.ruleId)
    }
  })

  it('returns null when every rule is spent', () => {
    const spent = worldInput({ usedRuleIds: new Set(RULES.map((r) => r.id)) })
    expect(generateVisualCandidate(spent, 1)).toBeNull()
  })
})
