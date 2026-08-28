import type { AdminPuzzleDetail } from './types'

// The reviewer-detail body shared by every "here's a whole puzzle" admin
// card (pending review, approved-unscheduled, upcoming schedule) — only the
// header/footer controls differ between those three.

interface Props {
  puzzle: AdminPuzzleDetail
}

export function PuzzleCardBody({ puzzle }: Props) {
  const clueIn = puzzle.clues.filter((c) => c.label === 'IN').map((c) => c.word)
  const clueOut = puzzle.clues.filter((c) => c.label === 'OUT').map((c) => c.word)

  return (
    <>
      <div className="font-sans text-sm">{puzzle.ruleDescription}</div>

      <div className="grid grid-cols-2 gap-4 font-sans text-sm">
        <div>
          <div className="mb-1 font-semibold text-bin-in-text">IN clues</div>
          <div>{clueIn.join(', ')}</div>
        </div>
        <div>
          <div className="mb-1 font-semibold text-bin-out-label">OUT clues</div>
          <div>{clueOut.join(', ')}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {puzzle.guests.map((g) => (
          <div
            key={g.wordId}
            className={`rounded-card border px-2 py-1 font-sans text-xs ${
              g.trueLabel === 'IN'
                ? 'border-bin-in bg-bin-in-chip text-bin-in-text'
                : 'border-bin-out bg-bin-out-chip text-bin-out-text'
            }`}
          >
            {g.word}
            {g.isTrap && <span className="ml-1 opacity-70">({g.trapType})</span>}
          </div>
        ))}
      </div>

      <div className="font-sans text-xs text-ink-soft">
        Live decoys:{' '}
        {puzzle.liveDecoys.length > 0
          ? puzzle.liveDecoys.map((d) => `${d.ruleName} (subtlety ${d.subtlety})`).join(', ')
          : 'none'}
      </div>
    </>
  )
}
