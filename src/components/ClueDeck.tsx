interface Props {
  clueIn: string[]
  clueOut: string[]
}

export function ClueDeck({ clueIn, clueOut }: Props) {
  return (
    <div className="mx-5 flex flex-col gap-3 rounded-bin border border-line bg-slip p-4">
      <div className="font-sans text-[11px] font-semibold tracking-wider text-ink-soft">
        THE LIST SO FAR
      </div>
      <ClueRow label="● IN" labelColor="text-bin-in" words={clueIn} chipBg="bg-bin-in-chip" chipText="text-bin-in-text" />
      <div className="h-px bg-skip-chip" />
      <ClueRow label="▲ OUT" labelColor="text-bin-out-label" words={clueOut} chipBg="bg-bin-out-chip" chipText="text-bin-out-text" />
    </div>
  )
}

function ClueRow({
  label,
  labelColor,
  words,
  chipBg,
  chipText,
}: {
  label: string
  labelColor: string
  words: string[]
  chipBg: string
  chipText: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-[58px] flex-none whitespace-nowrap font-display text-sm font-extrabold tracking-wider ${labelColor}`}>
        {label}
      </div>
      {/* flex-nowrap keeps clues on one line even on a narrow phone — never
          wrapping to a second row, which would grow this box and eat into
          the card queue's space below it. Chips size down in two steps
          rather than wrapping or scrolling: COMPACT_LENGTH first shrinks
          padding/tracking, then a longer word drops font-size too — so a
          single long clue word never derails the whole row.
          overflow-x-auto stays only as a last-resort safety net for a case
          these two steps can't fit; it should never engage in practice. */}
      <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto">
        {words.map((w) => {
          const compact = w.length > 7
          const small = w.length > 10
          return (
            <div
              key={w}
              className={`flex-none whitespace-nowrap rounded-[10px] font-display font-bold ${chipBg} ${chipText} ${
                small
                  ? 'px-1.5 py-1 text-xs tracking-normal'
                  : compact
                    ? 'px-2 py-1 text-sm tracking-normal'
                    : 'px-2.5 py-1.5 text-sm tracking-wide'
              }`}
            >
              {w}
            </div>
          )
        })}
      </div>
    </div>
  )
}
