import { describe, expect, it } from 'vitest'
import { MAX_BYTES, normalizeSvg, STROKE_SCALE } from './normalize.js'

const OPENMOJI_BUTTER = `<svg id="emoji" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
  <g id="line">
    <path fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19,33a3.416,3.416,0,0,0-3.3141,2.9835l-1.3718,13.033A2.65,2.65,0,0,0,17,52H55a2.65,2.65,0,0,0,2.6859-2.9835l-1.3718-13.033A3.416,3.416,0,0,0,53,33Z"/>
  </g>
</svg>`

function rejectReasons(raw: string): string[] {
  const result = normalizeSvg(raw)
  if (result.ok) throw new Error(`expected a rejection, got ${result.svg}`)
  return result.reasons
}

describe('normalizeSvg on OpenMoji stroke art', () => {
  const result = normalizeSvg(OPENMOJI_BUTTER, STROKE_SCALE)
  const svg = result.ok ? result.svg : ''

  it('accepts it', () => {
    expect(result.ok).toBe(true)
  })

  it('recolours the stroke to currentColor', () => {
    expect(svg).toContain('stroke="currentColor"')
    expect(svg).not.toContain('#000')
  })

  // Dropping fill="none" would paint every outline as a solid shape.
  it('keeps fill="none"', () => {
    expect(svg).toContain('fill="none"')
  })

  it('multiplies the stroke width by the scale', () => {
    expect(svg).toContain(`stroke-width="${2 * STROKE_SCALE}"`)
  })

  it('gives strokes with no width of their own the scaled default', () => {
    const stroked = normalizeSvg(
      '<svg viewBox="0 0 10 10"><path stroke="#000" d="M0 0h5"/></svg>',
      STROKE_SCALE
    )
    expect(stroked.ok && stroked.svg).toContain(`<svg stroke-width="${STROKE_SCALE}"`)
  })

  it('keeps the viewBox and drops the ids', () => {
    expect(svg).toContain('viewBox="0 0 72 72"')
    expect(svg).not.toContain('id=')
  })
})

describe('normalizeSvg on filled-path art', () => {
  it('drops fixed dimensions and lets unfilled shapes inherit currentColor', () => {
    const result = normalizeSvg(
      '<svg viewBox="0 0 10 10" width="10" height="10"><path d="M0 0h9v9H0z"/></svg>'
    )
    expect(result.ok && result.svg).toBe(
      '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M0 0h9v9H0z"/></svg>'
    )
  })

  it('treats #000 and black as one colour', () => {
    const result = normalizeSvg(
      '<svg viewBox="0 0 10 10"><path fill="#000" stroke="black" d="M0 0h5"/></svg>'
    )
    expect(result.ok).toBe(true)
  })

  it('accepts a leading XML declaration', () => {
    const result = normalizeSvg(
      '<?xml version="1.0" encoding="UTF-8"?><svg viewBox="0 0 10 10"><path d="M0 0h5"/></svg>'
    )
    expect(result.ok).toBe(true)
  })
})

describe('normalizeSvg rejections', () => {
  it('rejects a script', () => {
    expect(
      rejectReasons('<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0h5"/></svg>')
    ).toContain('element <script> is not allowed')
  })

  it('rejects an embedded attribution line', () => {
    expect(
      rejectReasons(
        '<svg viewBox="0 0 10 12"><path d="M0 0h5"/><text y="11">Created by X from the Noun Project</text></svg>'
      )
    ).toContain('element <text> is not allowed')
  })

  it('rejects event handlers and hrefs', () => {
    expect(
      rejectReasons('<svg viewBox="0 0 10 10" onload="alert(1)"><path d="M0 0h5"/></svg>')
    ).toContain('attribute "onload" is not allowed')
    expect(rejectReasons('<svg viewBox="0 0 10 10"><path href="#x" d="M0 0h5"/></svg>')).toContain(
      'attribute "href" is not allowed'
    )
  })

  it('rejects url() references', () => {
    expect(
      rejectReasons('<svg viewBox="0 0 10 10"><path fill="url(#g)" d="M0 0h5"/></svg>')
    ).toContain('attribute "fill" references url()')
  })

  it('rejects processing instructions other than the XML declaration', () => {
    expect(
      rejectReasons(
        '<?xml-stylesheet type="text/css" href="x.css"?><svg viewBox="0 0 10 10"><path d="M0 0h5"/></svg>'
      )
    ).toEqual(['processing instruction <?xml-stylesheet?> is not allowed'])
  })

  it('rejects character data inside the drawing', () => {
    expect(
      rejectReasons('<svg viewBox="0 0 10 10"><g><![CDATA[<script>alert(1)</script>]]></g></svg>')
    ).toEqual(['CDATA sections are not allowed'])
  })

  it('rejects stray text content', () => {
    expect(rejectReasons('<svg viewBox="0 0 10 10">hello<path d="M0 0h5"/></svg>')).toEqual([
      'text content is not allowed',
    ])
  })

  // Recolouring both shapes to currentColor would fill the hole in.
  it('rejects a white-on-black cutout', () => {
    expect(
      rejectReasons(
        '<svg viewBox="0 0 10 10"><path fill="#000" d="M0 0h9v9H0z"/><path fill="#FFF" d="M3 3h3v3H3z"/></svg>'
      )
    ).toEqual([
      'uses 2 colours (#000000, #ffffff); a white-on-black cutout would fill in once recoloured',
    ])
  })

  it('rejects a missing viewBox', () => {
    expect(rejectReasons('<svg width="10" height="10"><path d="M0 0h5"/></svg>')).toEqual([
      'missing viewBox on the root <svg>',
    ])
  })

  it('rejects a stroke width it cannot scale', () => {
    const result = normalizeSvg(
      '<svg viewBox="0 0 10 10"><path stroke="#000" stroke-width="2px" d="M0 0h5"/></svg>',
      STROKE_SCALE
    )
    expect(result.ok ? [] : result.reasons).toEqual(['stroke-width "2px" is not a plain number'])
  })

  it('rejects input that is not SVG', () => {
    expect(rejectReasons('not an svg <<<')[0]).toMatch(/^not parseable as SVG: /)
  })

  // Points chosen so svgo cannot merge or shorten them back under the limit.
  it('rejects output over the size limit', () => {
    const d = Array.from(
      { length: 4000 },
      (_, i) => `L${(i * 7919) % 10007} ${(i * 104729) % 10007}`
    ).join('')
    const reasons = rejectReasons(`<svg viewBox="0 0 10007 10007"><path d="M0 0${d}"/></svg>`)
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toMatch(new RegExp(`over the ${MAX_BYTES} limit$`))
  })
})
