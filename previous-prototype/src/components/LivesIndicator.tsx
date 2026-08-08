interface Props {
  lives: number
  max?: number
}

export function LivesIndicator({ lives, max = 3 }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-500 mr-1">Lives</span>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < lives
        return (
          <div
            key={i}
            className={[
              'w-4 h-4 rounded-full border-2 transition-all duration-300',
              filled
                ? 'bg-amber-400 border-amber-400'
                : 'bg-transparent border-slate-300',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}
