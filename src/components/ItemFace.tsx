import { iconUrl } from '../game/icons'

interface Props {
  id: string
  name: string
  /** False (or absent) for word puzzles, which render exactly as before: the text alone. */
  visual?: boolean
  /** Icon box size in px. Fixed, so nothing shifts while the icon loads. */
  size: number
  /** Icon over a centred caption, for boxes too narrow to hold the two side by side. */
  stacked?: boolean
}

/**
 * One item, as players read it: for a visual puzzle the icon then its caption
 * (D2: the caption is always shown). The icon is a CSS mask over currentColor,
 * so it follows the text colour and theme with no inline SVG. It is decorative
 * to screen readers, which read the caption.
 */
export function ItemFace({ id, name, visual, size, stacked }: Props) {
  if (!visual) return <>{name}</>
  const mask = `url(${iconUrl(id)}) center / contain no-repeat`
  return (
    <span
      className={
        stacked
          ? 'flex flex-col items-center gap-0.5 text-center'
          : 'inline-flex items-center gap-1.5'
      }
    >
      <span
        aria-hidden
        className="flex-none bg-current"
        style={{ width: size, height: size, mask, WebkitMask: mask }}
      />
      <span>{name}</span>
    </span>
  )
}
