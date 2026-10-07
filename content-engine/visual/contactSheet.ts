/** Tray chip, clue chip, play card, and a large size for judging detail. */
export const SHEET_SIZES: readonly number[] = [26, 30, 36, 64]

export interface SheetEntry {
  id: string
  name: string
  svg: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The human recognizability check (planning-visual-pivot.md §5.2): every icon
 * at the sizes the game renders, rendered the way the game renders it — a
 * CSS mask over currentColor — in both themes.
 */
export function buildContactSheet(entries: SheetEntry[]): string {
  // A data URI rather than a file path: browsers refuse CSS masks from file://.
  const masks = entries
    .map((e, i) => {
      const mask = `url("data:image/svg+xml,${encodeURIComponent(e.svg)}") center / contain no-repeat`
      return `.i${i}{-webkit-mask:${mask};mask:${mask}}`
    })
    .join('\n')

  const tiles = entries
    .map((e, i) => {
      const icons = SHEET_SIZES.map(
        (s) => `<span class="icon i${i}" style="width:${s}px;height:${s}px"></span>`
      ).join('')
      return `<figure>${icons}<figcaption>${escapeHtml(e.name)}<small>${escapeHtml(e.id)}</small></figcaption></figure>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visual icon contact sheet (${entries.length})</title>
<style>
body{margin:0;font:14px system-ui,sans-serif}
section{display:flex;flex-wrap:wrap;gap:12px;padding:16px}
.light{background:#f1e7d5;color:#2b2622}
.dark{background:#1f1b18;color:#f1e7d5}
figure{margin:0;width:170px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
figure>span{display:inline-block;margin-right:6px}
.icon{background-color:currentColor;vertical-align:bottom}
figcaption{display:flex;flex-direction:column}
small{opacity:.6}
${masks}
</style>
</head>
<body>
<section class="light">
${tiles}
</section>
<section class="dark">
${tiles}
</section>
</body>
</html>
`
}
