interface Props {
  lives: number
  total?: number
}

export function LivesDots({ lives, total = 3 }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="font-sans text-xs font-semibold tracking-wider text-ink-soft">
        CALLS LEFT
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, n) => (
          <div
            key={n}
            className={
              n < lives
                ? 'h-[15px] w-[15px] rounded-full bg-miss transition-all duration-300'
                : 'h-[15px] w-[15px] rounded-full border-2 border-dashed border-miss bg-transparent transition-all duration-300'
            }
          />
        ))}
      </div>
    </div>
  )
}
