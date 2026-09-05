// Server-rendered HTML for the puzzle archive.
//
// Deliberately NOT part of the React app. The SPA renders client-side, so a
// crawler asking for an archive page would receive an empty <div id="root">
// and index nothing — the same problem the static block in index.html exists
// to solve for the home page. These pages are plain HTML built here and served
// straight from a function, so what Google sees is what a reader sees.
//
// Pure string-building on purpose: no database, no Request/Response, so the
// escaping and the spoiler boundary are unit-testable. archive.ts is the thin
// Mongo/HTTP wrapper — the same split as repairWord/aiReviewDispatch.

export type Label = 'IN' | 'OUT'

export interface ArchiveEntry {
  date: string
  number: number | null
  ruleName: string
  ruleDescription: string
}

export interface ArchivePuzzle extends ArchiveEntry {
  clues: { word: string; label: Label }[]
  guests: { word: string; trueLabel: Label }[]
}

export const SITE_ORIGIN = 'https://the-bouncer.netlify.app'

/**
 * Every value rendered below comes from our own database, but it is still
 * escaped: word spellings and rule descriptions are content, and content that
 * reaches HTML unescaped is a habit that eventually meets a value you did not
 * write yourself.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "2026-09-03" -> "Thursday, 3 September 2026". Fixed to UTC so it matches the puzzle calendar. */
export function formatPuzzleDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const STYLES = `
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body {
    margin: 0;
    background: #f1e7d5;
    color: #2b2119;
    font-family: 'Instrument Sans', system-ui, -apple-system, sans-serif;
    line-height: 1.6;
  }
  .wrap { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem }
  h1, h2, h3 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; line-height: 1.2 }
  h1 { font-size: 2rem; margin: 0 0 .35rem }
  h2 { font-size: 1.3rem; margin: 2rem 0 .75rem }
  a { color: #1f6f60 }
  .lede { margin: 0 0 2rem; color: #5c5044 }
  .card {
    background: #fffdf7; border: 1px solid #e6dbc6; border-radius: 14px;
    padding: 1rem 1.25rem; margin: 0 0 .75rem;
  }
  .card h3 { margin: 0 0 .2rem; font-size: 1.05rem }
  .meta { font-size: .85rem; color: #7a6c5d; margin: 0 }
  .rule {
    background: #fffdf7; border: 1px solid #e6dbc6; border-radius: 14px;
    padding: 1rem 1.25rem; margin: 0 0 1.5rem; font-weight: 600;
  }
  ul.words { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .4rem }
  ul.words li { border-radius: 999px; padding: .25rem .7rem; font-size: .95rem; border: 1px solid }
  li.in { background: #e4f0e9; border-color: #b9d8c8; color: #1f5c46 }
  li.out { background: #f6e2dd; border-color: #e3c0b6; color: #8a3f2c }
  .nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2.5rem; font-size: .95rem }
  footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #e0d4bd; font-size: .9rem; color: #7a6c5d }
`

interface PageOptions {
  title: string
  description: string
  canonicalPath: string
  body: string
}

function page({ title, description, canonicalPath, body }: PageOptions): string {
  const url = `${SITE_ORIGIN}${canonicalPath}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta name="theme-color" content="#F1E7D5" />
<link rel="icon" type="image/png" sizes="192x192" href="/pwa-192x192.png" />
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="The Bouncer" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${SITE_ORIGIN}/pwa-512x512.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;600&display=swap" rel="stylesheet" />
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
${body}
<footer>
  <a href="/">Play today’s puzzle</a> · <a href="/archive">All past puzzles</a>
</footer>
</div>
</body>
</html>`
}

function wordList(items: { word: string; label: Label }[]): string {
  return `<ul class="words">${items
    .map(
      (i) =>
        `<li class="${i.label === 'IN' ? 'in' : 'out'}">${escapeHtml(i.word)}</li>`
    )
    .join('')}</ul>`
}

export function renderArchiveIndex(entries: ArchiveEntry[]): string {
  const body =
    entries.length === 0
      ? `<h1>Puzzle archive</h1>
<p class="lede">No puzzles have finished yet — the archive fills up as the game is played.</p>`
      : `<h1>Puzzle archive</h1>
<p class="lede">Every past puzzle from The Bouncer, with the hidden rule revealed. ${entries.length} ${entries.length === 1 ? 'puzzle' : 'puzzles'} so far.</p>
${entries
  .map(
    (e) => `<article class="card">
  <h3><a href="/archive/${escapeHtml(e.date)}">${e.number !== null ? `No. ${e.number} — ` : ''}${escapeHtml(e.ruleName)}</a></h3>
  <p class="meta">${escapeHtml(formatPuzzleDate(e.date))}</p>
</article>`
  )
  .join('\n')}`

  return page({
    title: 'Puzzle Archive — The Bouncer',
    description:
      'Browse every past puzzle from The Bouncer daily word game, with the hidden rule and the full guest list revealed.',
    canonicalPath: '/archive',
    body,
  })
}

export function renderArchivePuzzle(
  puzzle: ArchivePuzzle,
  neighbours: { previous?: string; next?: string } = {}
): string {
  const inClues = puzzle.clues.filter((c) => c.label === 'IN')
  const outClues = puzzle.clues.filter((c) => c.label === 'OUT')
  const heading = puzzle.number !== null ? `Puzzle No. ${puzzle.number}` : 'Puzzle'

  const body = `<h1>${escapeHtml(heading)}</h1>
<p class="lede">${escapeHtml(formatPuzzleDate(puzzle.date))}</p>

<h2>The rule</h2>
<p class="rule">${escapeHtml(puzzle.ruleDescription)}</p>

<h2>The clues</h2>
<p class="meta">Shown to players before they sorted anything.</p>
${wordList([...inClues, ...outClues])}

<h2>The guest list</h2>
<p class="meta">The words players had to sort, with the answers.</p>
${wordList(puzzle.guests.map((g) => ({ word: g.word, label: g.trueLabel })))}

<div class="nav">
  <span>${neighbours.previous ? `<a href="/archive/${escapeHtml(neighbours.previous)}">← Previous puzzle</a>` : ''}</span>
  <span>${neighbours.next ? `<a href="/archive/${escapeHtml(neighbours.next)}">Next puzzle →</a>` : ''}</span>
</div>`

  const words = puzzle.clues
    .filter((c) => c.label === 'IN')
    .map((c) => c.word)
    .slice(0, 3)
    .join(', ')

  return page({
    title: `${heading}: ${puzzle.ruleName} — The Bouncer`,
    description: `The Bouncer puzzle for ${formatPuzzleDate(puzzle.date)}. The hidden rule was "${puzzle.ruleName}"${words ? `, with clues like ${words}` : ''}.`,
    canonicalPath: `/archive/${puzzle.date}`,
    body,
  })
}

export function renderNotFound(): string {
  return page({
    title: 'Puzzle not found — The Bouncer',
    description: 'That puzzle is not in the archive.',
    canonicalPath: '/archive',
    body: `<h1>Not in the archive</h1>
<p class="lede">There is no past puzzle for that date. Puzzles appear here the day after they run.</p>`,
  })
}

/** Sitemap covering the home page, the archive index, and every past puzzle. */
export function renderSitemap(dates: string[]): string {
  const urls = [
    `  <url>\n    <loc>${SITE_ORIGIN}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE_ORIGIN}/archive</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    // A past puzzle never changes again, so it is both never-stale and low
    // priority relative to the pages that do change.
    ...dates.map(
      (d) =>
        `  <url>\n    <loc>${SITE_ORIGIN}/archive/${escapeHtml(d)}</loc>\n    <lastmod>${escapeHtml(d)}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.6</priority>\n  </url>`
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
}
