interface Props {
  onRefresh: () => void
}

/** Purely presentational — App.tsx owns the useRegisterSW() hook itself so
 * `needRefresh` keeps tracking correctly even while this banner is hidden
 * mid-round (see App.tsx for why it's never shown then). */
export function UpdateBanner({ onRefresh }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-ink px-5 py-3 font-sans text-sm text-screen sm:mx-auto sm:max-w-[440px] sm:rounded-t-bin">
      <span>A new version is ready.</span>
      <button
        onClick={onRefresh}
        className="flex-none rounded-full bg-screen px-3 py-1.5 font-display text-xs font-bold text-ink"
      >
        Refresh
      </button>
    </div>
  )
}
