// Filed words cascade downward, each new one drawn in front — but the step
// between cards is deliberately close to the full card height (only a
// small overlap for the fanned-stack look) so every word's text clears the
// one above it instead of being hidden behind it. The pool is always
// exactly 6 words (content-engine/generator/difficulty.ts), so a tray can
// never hold more than 6 — this never needs to scroll or cap out.
export const CARD_HEIGHT = 40
export const CARD_STEP = 32
export const TOP_BASE = 6
export const MIN_STACK_HEIGHT = 68

export function stackHeightFor(count: number): number {
  if (count === 0) return MIN_STACK_HEIGHT
  return Math.max(MIN_STACK_HEIGHT, TOP_BASE + CARD_HEIGHT + (count - 1) * CARD_STEP)
}
