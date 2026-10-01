// Vendors the raw OpenMoji file for every item that doesn't have one yet.
// Existing files are never re-fetched over: a committed raw file is the
// record of exactly what was normalized.
// Run with: npm run visual:fetch-icons

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { RAW_OPENMOJI_DIR, rawIconPath } from '../iconSources.js'
import { ITEMS } from '../items.js'
import { openMojiSvgUrl } from '../openmoji.js'

async function main() {
  mkdirSync(RAW_OPENMOJI_DIR, { recursive: true })
  let fetched = 0
  for (const item of ITEMS) {
    if (item.icon.set !== 'openmoji') continue
    const path = rawIconPath(item)
    if (existsSync(path)) continue

    const url = openMojiSvgUrl(item.icon.hex)
    const res = await fetch(url)
    const body = await res.text()
    if (!res.ok || !body.trimStart().startsWith('<svg')) {
      throw new Error(`${item.id}: ${res.status} from ${url}`)
    }
    writeFileSync(path, body)
    fetched++
  }
  console.log(`Fetched ${fetched} new OpenMoji file(s) into ${RAW_OPENMOJI_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
