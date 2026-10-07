// Visual puzzle icons (planning-visual-pivot.md §5.5). An item id is also its
// icon's filename, normalized and served from public/icons/visual/.

export function iconUrl(itemId: string): string {
  return `/icons/visual/${itemId}.svg`
}

/** Starts loading a round's icons as soon as it arrives, so cards don't pop in one by one. */
export function warmIcons(itemIds: string[]): void {
  for (const id of itemIds) new Image().src = iconUrl(id)
}
