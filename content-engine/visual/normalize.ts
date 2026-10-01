import { optimize, type CustomPlugin } from 'svgo'

/**
 * OpenMoji draws at stroke-width 2 on a 72-unit grid, which lands at about
 * 1px on a 36px card. Tuned by eye on the contact sheet, not derived.
 */
export const STROKE_SCALE = 1.5

export const WARN_BYTES = 6_000
export const MAX_BYTES = 20_000

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'rect',
])

// Anything else is rejected rather than stripped, which also rejects every
// on* handler and every href: these files are served same-origin with /admin.
const ALLOWED_ATTRIBUTES = new Set([
  'id',
  'd',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'transform',
  'viewBox',
  'xmlns',
  'version',
  'xml:space',
  'fill',
  'fill-rule',
  'clip-rule',
  'fill-opacity',
  'opacity',
  'paint-order',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
])

export type NormalizeResult =
  { ok: true; svg: string; warnings: string[] } | { ok: false; reasons: string[] }

function canonicalColor(value: string): string {
  const v = value.trim().toLowerCase()
  if (v === 'black') return '#000000'
  if (v === 'white') return '#ffffff'
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v)
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : v
}

export function normalizeSvg(raw: string, strokeScale = 1): NormalizeResult {
  const reasons: string[] = []
  const colors = new Set<string>()
  let hasViewBox = false

  // Runs first, on the raw input: svgo's preset keeps <script> and <text>,
  // and would fold a white cutout into currentColor before anything saw it.
  const gate: CustomPlugin = {
    name: 'gate',
    fn: () => ({
      // The XML declaration is the only processing instruction an icon file needs;
      // any other (xml-stylesheet especially) would sit outside the element allowlist.
      instruction: {
        enter: (node) => {
          if (node.name !== 'xml') {
            reasons.push(`processing instruction <?${node.name}?> is not allowed`)
          }
        },
      },
      element: {
        enter: (node, parentNode) => {
          if (!ALLOWED_ELEMENTS.has(node.name)) {
            reasons.push(`element <${node.name}> is not allowed`)
          }
          for (const [name, value] of Object.entries(node.attributes)) {
            if (!ALLOWED_ATTRIBUTES.has(name)) reasons.push(`attribute "${name}" is not allowed`)
            if (value.includes('url(')) reasons.push(`attribute "${name}" references url()`)
            if ((name === 'fill' || name === 'stroke') && value !== 'none') {
              colors.add(canonicalColor(value))
            }
          }
          if (parentNode.type === 'root' && node.attributes.viewBox) hasViewBox = true
        },
      },
    }),
  }

  const scaleStrokes: CustomPlugin = {
    name: 'scaleStrokes',
    fn: () => ({
      element: {
        enter: (node, parentNode) => {
          const width = node.attributes['stroke-width']
          if (width === undefined) {
            // Elements with no width of their own inherit this one.
            if (parentNode.type === 'root') node.attributes['stroke-width'] = String(strokeScale)
            return
          }
          const n = Number(width)
          if (Number.isNaN(n)) reasons.push(`stroke-width "${width}" is not a plain number`)
          else node.attributes['stroke-width'] = String(n * strokeScale)
        },
      },
    }),
  }

  // Lets shapes with no fill of their own (filled-path icons) inherit the
  // theme colour; shapes that say fill="none" keep saying it.
  const rootFill: CustomPlugin = {
    name: 'rootFill',
    fn: () => ({
      element: {
        enter: (node, parentNode) => {
          if (parentNode.type === 'root' && node.attributes.fill === undefined) {
            node.attributes.fill = 'currentColor'
          }
        },
      },
    }),
  }

  let svg: string
  try {
    svg = optimize(raw, {
      plugins: [
        gate,
        ...(strokeScale === 1 ? [] : [scaleStrokes]),
        'preset-default',
        'removeDimensions',
        // Leaves fill="none" alone: dropping it would paint every outline solid.
        { name: 'convertColors', params: { currentColor: true } },
        rootFill,
      ],
    }).data
  } catch (err) {
    return { ok: false, reasons: [`not parseable as SVG: ${(err as Error).message}`] }
  }

  if (!hasViewBox) reasons.push('missing viewBox on the root <svg>')
  if (colors.size > 1) {
    reasons.push(
      `uses ${colors.size} colours (${[...colors].join(', ')}); a white-on-black cutout would fill in once recoloured`
    )
  }
  if (svg.length > MAX_BYTES) {
    reasons.push(`${svg.length} bytes after optimizing, over the ${MAX_BYTES} limit`)
  }
  if (reasons.length > 0) return { ok: false, reasons }

  const warnings = svg.length > WARN_BYTES ? [`${svg.length} bytes after optimizing`] : []
  return { ok: true, svg, warnings }
}
