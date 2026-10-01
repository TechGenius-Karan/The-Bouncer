import { join } from 'node:path'
import type { Item } from './types.js'

const VISUAL_DIR = join(process.cwd(), 'content-engine', 'visual')

export const RAW_OPENMOJI_DIR = join(VISUAL_DIR, 'icons', 'openmoji')
export const RAW_NOUN_DIR = join(VISUAL_DIR, 'icons', 'noun')
export const ICON_OUTPUT_DIR = join(process.cwd(), 'public', 'icons', 'visual')

export function rawIconPath(item: Item): string {
  return item.icon.set === 'openmoji'
    ? join(RAW_OPENMOJI_DIR, `${item.icon.hex}.svg`)
    : join(RAW_NOUN_DIR, `${item.id}.svg`)
}
