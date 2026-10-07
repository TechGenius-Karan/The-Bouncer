import { describe, expect, it } from 'vitest'
import { buildContactSheet, SHEET_SIZES } from './contactSheet.js'

const SVG = '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M0 0h9v9H0z"/></svg>'

describe('buildContactSheet', () => {
  const html = buildContactSheet([
    { id: 'ice-cube', name: 'ice cube', svg: SVG },
    { id: 'odd', name: 'a <b> & c', svg: SVG },
  ])

  it('shows one tile per entry, captioned with its name and id', () => {
    expect(html.match(/<figure>/g)).toHaveLength(4) // 2 entries x light + dark
    expect(html).toContain('ice cube')
    expect(html).toContain('<small>ice-cube</small>')
  })

  it('escapes captions', () => {
    expect(html).toContain('a &lt;b&gt; &amp; c')
    expect(html).not.toContain('a <b> & c')
  })

  it('renders every size the UI uses', () => {
    for (const size of SHEET_SIZES) expect(html).toContain(`width:${size}px;height:${size}px`)
  })

  // Browsers refuse CSS masks loaded from file://, so the icon travels inline.
  it('inlines each icon as an encoded data URI', () => {
    expect(html).toContain(`data:image/svg+xml,${encodeURIComponent(SVG)}`)
    expect(html).not.toContain('<svg viewBox')
  })

  it('has a light and a dark panel', () => {
    expect(html).toContain('<section class="light">')
    expect(html).toContain('<section class="dark">')
  })
})
