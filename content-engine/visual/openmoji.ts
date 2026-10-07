/** Pinned so a re-fetch can never silently swap in an upstream redraw. */
export const OPENMOJI_VERSION = '17.0.0'

const CDN = `https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}`

export const OPENMOJI_DATA_URL = `${CDN}/data/openmoji.json`

export function openMojiSvgUrl(hex: string): string {
  return `${CDN}/black/svg/${hex}.svg`
}

/** The fields of OpenMoji's data/openmoji.json this pipeline reads. */
export interface OpenMojiEntry {
  hexcode: string
  annotation: string
  group: string
  subgroups: string
  skintone: string
}

// Item scope is things, food, vehicles, animals and plants
// (planning-visual-pivot.md D5). Mixed groups contribute only the subgroups
// that hold such things; a human still picks from the candidate list.
const WHOLE_GROUPS = new Set(['objects', 'food-drink', 'animals-nature'])
const PICKED_SUBGROUPS = new Set([
  'transport-ground',
  'transport-air',
  'transport-water',
  'sky-weather',
  'sport',
  'game',
  'arts-crafts',
  'event',
  'award-medal',
])

export function isCandidate(entry: OpenMojiEntry): boolean {
  if (entry.skintone !== '') return false
  // Multi-codepoint sequences are overwhelmingly people and flag variants.
  if (entry.hexcode.includes('-')) return false
  return WHOLE_GROUPS.has(entry.group) || PICKED_SUBGROUPS.has(entry.subgroups)
}
