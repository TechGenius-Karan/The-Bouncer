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
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => (
          <div
            key={w}
            className={`rounded-[10px] px-2.5 py-1.5 font-display text-sm font-bold tracking-wide ${chipBg} ${chipText}`}
          >
            {w}
          </div>
        ))}
      </div>
    </div>
  )
}
