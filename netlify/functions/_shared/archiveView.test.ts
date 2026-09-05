import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  formatPuzzleDate,
  renderArchiveIndex,
  renderArchivePuzzle,
  renderNotFound,
  renderSitemap,
  type ArchivePuzzle,
} from './archiveView'

const puzzle: ArchivePuzzle = {
  date: '2026-09-03',
  number: 1,
  ruleName: 'Is a vehicle',
  ruleDescription: 'The word is a kind of vehicle',
  clues: [
    { word: 'train', label: 'IN' },
    { word: 'rocket', label: 'IN' },
    { word: 'chair', label: 'OUT' },
  ],
  guests: [
    { word: 'bicycle', trueLabel: 'IN' },
    { word: 'hammer', trueLabel: 'OUT' },
  ],
}

describe('escapeHtml', () => {
  it('escapes every character that could break out of markup', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
    )
  })

  it('escapes ampersands before the entities it introduces', () => {
    // Getting this order wrong yields &amp;lt; — a classic double-escape bug.
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('formatPuzzleDate', () => {
  it('reads the date in UTC, matching the puzzle calendar', () => {
    expect(formatPuzzleDate('2026-09-03')).toBe('Thursday, 3 September 2026')
    expect(formatPuzzleDate('2026-01-01')).toBe('Thursday, 1 January 2026')
  })

  it('falls back to the raw value rather than printing "Invalid Date"', () => {
    expect(formatPuzzleDate('not-a-date')).toBe('not-a-date')
  })
})

describe('renderArchivePuzzle', () => {
  const html = renderArchivePuzzle(puzzle, { previous: '2026-09-02', next: '2026-09-04' })

  it('renders the rule, every clue and every guest as real text', () => {
    // The whole point of server-rendering these: a crawler that runs no
    // JavaScript must still see the words.
    for (const word of ['train', 'rocket', 'chair', 'bicycle', 'hammer']) {
      expect(html).toContain(word)
    }
    expect(html).toContain('The word is a kind of vehicle')
  })

  it('carries its own canonical, title and description', () => {
    expect(html).toContain('<link rel="canonical" href="https://the-bouncer.netlify.app/archive/2026-09-03" />')
    expect(html).toContain('<title>Puzzle No. 1: Is a vehicle — The Bouncer</title>')
    expect(html).toContain('name="description"')
  })

  it('links to neighbouring puzzles when they exist, and omits them when they do not', () => {
    expect(html).toContain('/archive/2026-09-02')
    expect(html).toContain('/archive/2026-09-04')
    const alone = renderArchivePuzzle(puzzle)
    expect(alone).not.toContain('Previous puzzle')
    expect(alone).not.toContain('Next puzzle')
  })

  it('marks IN and OUT words differently so the answers are readable', () => {
    expect(html).toContain('<li class="in">bicycle</li>')
    expect(html).toContain('<li class="out">hammer</li>')
  })

  it('escapes puzzle content rather than trusting it', () => {
    const nasty = renderArchivePuzzle({
      ...puzzle,
      ruleName: '<img src=x onerror=alert(1)>',
      clues: [{ word: '<b>bold</b>', label: 'IN' }],
    })
    expect(nasty).not.toContain('<img src=x')
    expect(nasty).not.toContain('<b>bold</b>')
    expect(nasty).toContain('&lt;img src=x')
  })

  it('handles an unnumbered puzzle without printing "No. null"', () => {
    const html = renderArchivePuzzle({ ...puzzle, number: null })
    expect(html).not.toContain('null')
  })
})

describe('renderArchiveIndex', () => {
  it('lists each puzzle with a link to its own page', () => {
    const html = renderArchiveIndex([
      { date: '2026-09-03', number: 1, ruleName: 'Is a vehicle', ruleDescription: 'x' },
      { date: '2026-09-04', number: 2, ruleName: 'Is a fruit', ruleDescription: 'y' },
    ])
    expect(html).toContain('href="/archive/2026-09-03"')
    expect(html).toContain('href="/archive/2026-09-04"')
    expect(html).toContain('Is a vehicle')
    expect(html).toContain('2 puzzles so far')
  })

  it('says something sensible when nothing has finished yet', () => {
    const html = renderArchiveIndex([])
    expect(html).toContain('No puzzles have finished yet')
    expect(html).not.toContain('0 puzzles')
  })

  it('uses the singular for one puzzle', () => {
    const html = renderArchiveIndex([
      { date: '2026-09-03', number: 1, ruleName: 'Is a vehicle', ruleDescription: 'x' },
    ])
    expect(html).toContain('1 puzzle so far')
  })
})

describe('renderSitemap', () => {
  it('always includes the home page and the archive index', () => {
    const xml = renderSitemap([])
    expect(xml).toContain('<loc>https://the-bouncer.netlify.app/</loc>')
    expect(xml).toContain('<loc>https://the-bouncer.netlify.app/archive</loc>')
  })

  it('adds one entry per past puzzle', () => {
    const xml = renderSitemap(['2026-09-04', '2026-09-03'])
    expect(xml).toContain('<loc>https://the-bouncer.netlify.app/archive/2026-09-04</loc>')
    expect(xml).toContain('<lastmod>2026-09-03</lastmod>')
    expect((xml.match(/<url>/g) ?? []).length).toBe(4)
  })

  it('declares the namespace sitemaps.org validators expect', () => {
    // A typo here (sitemap.org, singular) makes the whole file invalid, which
    // is exactly how the first hand-written version shipped.
    expect(renderSitemap([])).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  })
})

describe('renderNotFound', () => {
  it('explains why a date might be missing instead of showing a bare error', () => {
    expect(renderNotFound()).toContain('the day after they run')
  })
})
