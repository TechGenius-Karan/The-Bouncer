import type { Item } from './types.js'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const OPENMOJI_HEX = /^[0-9A-F]{4,5}(?:-[0-9A-F]{4,5})*$/

export function validateItems(items: Item[]): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  const icons = new Set<string>()

  for (const item of items) {
    if (!SLUG.test(item.id)) problems.push(`${item.id}: id must be a kebab-case slug`)
    if (ids.has(item.id)) problems.push(`${item.id}: duplicate id`)
    ids.add(item.id)

    const tidy = item.name.trim().toLowerCase().replace(/\s+/g, ' ')
    if (item.name === '' || item.name !== tidy) {
      problems.push(`${item.id}: name must be non-empty, lowercase, trimmed and single-spaced`)
    }
    if (names.has(item.name)) problems.push(`${item.id}: duplicate name "${item.name}"`)
    names.add(item.name)

    let iconKey: string
    if (item.icon.set === 'openmoji') {
      if (!OPENMOJI_HEX.test(item.icon.hex)) {
        problems.push(`${item.id}: "${item.icon.hex}" is not an OpenMoji hexcode`)
      }
      iconKey = `openmoji:${item.icon.hex}`
    } else {
      if (item.icon.creator.trim() === '') {
        problems.push(`${item.id}: a Noun Project icon needs its creator for the credits screen`)
      }
      if (!item.icon.url.startsWith('https://thenounproject.com/')) {
        problems.push(`${item.id}: a Noun Project icon needs its https://thenounproject.com/ page`)
      }
      iconKey = `noun:${item.id}`
    }
    if (icons.has(iconKey)) problems.push(`${item.id}: icon is already used by another item`)
    icons.add(iconKey)
  }

  return problems
}
