# Visual Pivot — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 165-item pilot bank of everyday things, each with a safe, normalized monochrome line-art icon served from `public/icons/visual/`, plus a contact sheet for checking by eye that each icon is recognizable.

**Architecture:**
- **New code:** everything lives in a new `content-engine/visual/` tree. Pure modules hold the logic: item validation, OpenMoji helpers, the SVG normalizer and the contact-sheet builder. Thin `tsx` scripts wrap them for the I/O parts.
- **Vendored icons:** raw OpenMoji files are fetched from one pinned release into the repo, rather than installing the 43 MB `openmoji` package on every Netlify and Vercel build.
- **Normalizer:** runs svgo with a custom first-pass gate that rejects anything unsafe or unsuitable. The output is committed, and a test keeps that output byte-identical to what the pipeline produces.

**Tech Stack:** TypeScript (strict, ESM, `.js` import extensions), svgo 4.1, Vitest 4 (node environment), tsx for scripts, Node global `fetch`.

**Spec:** [`planning-visual-pivot.md`](planning-visual-pivot.md). Phase 1 is §6, implementing §5.1 (item bank) and §5.2 (icon pipeline). Decisions D2 (captions), D4 (OpenMoji + Noun Project) and D5 (item scope) apply.

## Global Constraints

- **Nothing existing is deleted, overwritten or renamed.** The word engine (`content-engine/words/`, `rules/`, `generator/`) is not touched in this phase at all.
- **Code style** (`.prettierrc`): no semicolons, single quotes, 2-space indent, trailing commas `es5`, 100-character lines. `npm run format` only covers `src/`. The code in this plan has already been run through the repo's Prettier config. For anything you change, run `npx prettier --write content-engine/visual` before committing.
- **Node ESM:** every relative import in `content-engine/` ends in `.js` (e.g. `from './types.js'`). `content-engine/` is imported by the Vercel cron, and an extensionless import breaks at runtime there (CLAUDE.md).
- **TypeScript config** (`tsconfig.content-engine.json`): target/lib ES2020. Don't use `Array.prototype.at`, `String.prototype.replaceAll` or other ES2021+ APIs. Unused locals and parameters are errors.
- **ESLint** runs with `--max-warnings 0`. `content-engine/**` is linted as Node.
- **Comments:** few, and only to record *why*. Match the surrounding code.
- **Commits:** a short one-line message, with **no** `Co-Authored-By` or `Claude-Session` trailer (CLAUDE.md). Commit at the end of each task only if the user has okayed committing for this execution run.
- **Branch:** work on a branch, e.g. `git switch -c visual-pivot-phase1`. Never commit to `main` directly.
- **Ids are permanent:** an item id is the icon filename, and from Phase 2 onward it's the key every tag and stored puzzle refers to. Never rename one.
- **OpenMoji is pinned to `17.0.0`.** Vendored raw files are never re-fetched over, so an upstream redraw can't silently change a committed icon.
- **Limits** (spec §5.2): warn above 6,000 bytes, reject above 20,000 bytes. Allowed elements are exactly `svg, g, path, circle, ellipse, line, polyline, polygon, rect`.

## File structure

| File | Responsibility |
|---|---|
| `content-engine/visual/types.ts` | `Item`, `ItemGroup`, `IconSource` types |
| `content-engine/visual/validateItems.ts` | Pure invariant check over the item bank (ids, names, icons, credits) |
| `content-engine/visual/items.ts` | The item bank: data only |
| `content-engine/visual/openmoji.ts` | Pinned version, CDN URLs, the candidate scope filter |
| `content-engine/visual/normalize.ts` | `normalizeSvg`: the gate plus the svgo pipeline. `STROKE_SCALE` and size limits |
| `content-engine/visual/iconSources.ts` | Where an item's raw file lives, which stroke scale applies, and the output directory |
| `content-engine/visual/contactSheet.ts` | Builds the review HTML |
| `content-engine/visual/scripts/listOpenMojiCandidates.ts` | Writes `content-engine/output/openmoji-candidates.tsv` |
| `content-engine/visual/scripts/fetchOpenMojiIcons.ts` | Vendors raw OpenMoji files for items that don't have one yet |
| `content-engine/visual/scripts/normalizeIcons.ts` | raw → `public/icons/visual/<id>.svg` + contact sheet; exits non-zero on any failure or orphan |
| `content-engine/visual/icons/openmoji/<HEX>.svg` | Vendored raw files (committed) |
| `content-engine/visual/icons/README.md` | Provenance and licenses of the raw and normalized icons |
| `public/icons/visual/<id>.svg` | Normalized output (committed, served by Netlify) |
| Tests: `validateItems.test.ts`, `openmoji.test.ts`, `normalize.test.ts`, `contactSheet.test.ts`, `iconFiles.test.ts` | Next to their modules in `content-engine/visual/` |

`package.json` gains one devDependency (`svgo`) and three scripts. Vitest already picks up `content-engine/**/*.test.ts`, and `tsconfig.content-engine.json` already includes `content-engine`, so no config changes are needed.

---

### Task 1: Item types and the item-bank validator

**Files:**
- Create: `content-engine/visual/types.ts`
- Create: `content-engine/visual/validateItems.ts`
- Create: `content-engine/visual/items.ts`
- Test: `content-engine/visual/validateItems.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ItemGroup = 'thing' | 'food' | 'vehicle' | 'animal' | 'plant'`
  - `type IconSource = { set: 'openmoji'; hex: string } | { set: 'noun'; creator: string; url: string }`
  - `interface Item { id: string; name: string; group: ItemGroup; icon: IconSource; blocked?: boolean }`
  - `validateItems(items: Item[]): string[]` (an empty array means valid)
  - `ITEMS: Item[]`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/validateItems.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ITEMS } from './items.js'
import type { Item } from './types.js'
import { validateItems } from './validateItems.js'

const om = (id: string, name: string, hex: string): Item => ({
  id,
  name,
  group: 'thing',
  icon: { set: 'openmoji', hex },
})

describe('validateItems', () => {
  it('accepts a well-formed bank', () => {
    expect(
      validateItems([om('ice-cube', 'ice cube', '1F9CA'), om('anchor', 'anchor', '2693')])
    ).toEqual([])
  })

  it('rejects an id that is not a kebab-case slug', () => {
    expect(validateItems([om('Ice_Cube', 'ice cube', '1F9CA')])).toEqual([
      'Ice_Cube: id must be a kebab-case slug',
    ])
  })

  it('rejects duplicate ids and duplicate names', () => {
    const problems = validateItems([
      om('anchor', 'anchor', '2693'),
      om('anchor', 'boat anchor', '1F9CA'),
      om('ship-anchor', 'anchor', '26F5'),
    ])
    expect(problems).toContain('anchor: duplicate id')
    expect(problems).toContain('ship-anchor: duplicate name "anchor"')
  })

  it('rejects a caption that is not lowercase, trimmed and single-spaced', () => {
    expect(validateItems([om('ice-cube', 'Ice  cube ', '1F9CA')])).toEqual([
      'ice-cube: name must be non-empty, lowercase, trimmed and single-spaced',
    ])
  })

  it('rejects a malformed OpenMoji hexcode', () => {
    expect(validateItems([om('anchor', 'anchor', '2693.svg')])).toEqual([
      'anchor: "2693.svg" is not an OpenMoji hexcode',
    ])
  })

  // Two items on one icon can't be told apart on a card.
  it('rejects two items sharing one icon', () => {
    const items = [om('ice', 'ice', '1F9CA'), om('ice-cube', 'ice cube', '1F9CA')]
    expect(validateItems(items)).toEqual(['ice-cube: icon is already used by another item'])
  })

  it('requires a creator and a Noun Project page for the credits screen', () => {
    const noun: Item = {
      id: 'kettle',
      name: 'kettle',
      group: 'thing',
      icon: { set: 'noun', creator: ' ', url: 'https://example.com/kettle' },
    }
    expect(validateItems([noun])).toEqual([
      'kettle: a Noun Project icon needs its creator for the credits screen',
      'kettle: a Noun Project icon needs its https://thenounproject.com/ page',
    ])
  })

  it('passes for the real item bank', () => {
    expect(validateItems(ITEMS)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run content-engine/visual/validateItems.test.ts`
Expected: FAIL, because the imports `./items.js` / `./validateItems.js` / `./types.js` can't be resolved.

- [ ] **Step 3: Write the implementation**

`content-engine/visual/types.ts`:
```ts
export type ItemGroup = 'thing' | 'food' | 'vehicle' | 'animal' | 'plant'

export type IconSource =
  { set: 'openmoji'; hex: string } | { set: 'noun'; creator: string; url: string }

export interface Item {
  /**
   * Permanent. It is the icon's filename, and from Phase 2 the key every tag
   * and every stored puzzle refers to — renaming one orphans both.
   */
  id: string
  /** The caption players read (planning-visual-pivot.md D2). Lowercase; the UI owns capitalisation. */
  name: string
  group: ItemGroup
  icon: IconSource
  blocked?: boolean
}
```

`content-engine/visual/validateItems.ts`:
```ts
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
```

`content-engine/visual/items.ts` (empty for now; Task 5 fills it):
```ts
import type { Item } from './types.js'

// The visual item bank (planning-visual-pivot.md §5.1). Ids are permanent —
// see Item.id.
export const ITEMS: Item[] = []
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/validateItems.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck:content-engine && npx eslint content-engine/visual --max-warnings 0`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add content-engine/visual/types.ts content-engine/visual/validateItems.ts content-engine/visual/items.ts content-engine/visual/validateItems.test.ts
git commit -m "Add the visual item bank types and validator"
```

---

### Task 2: OpenMoji source helpers, candidate list and fetch scripts

**Files:**
- Create: `content-engine/visual/openmoji.ts`
- Create: `content-engine/visual/iconSources.ts`
- Create: `content-engine/visual/scripts/listOpenMojiCandidates.ts`
- Create: `content-engine/visual/scripts/fetchOpenMojiIcons.ts`
- Modify: `package.json` (`scripts`)
- Test: `content-engine/visual/openmoji.test.ts`

**Interfaces:**
- Consumes: `Item`, `ITEMS` (Task 1).
- Produces:
  - `OPENMOJI_VERSION = '17.0.0'`, `OPENMOJI_DATA_URL: string`, `openMojiSvgUrl(hex: string): string`
  - `interface OpenMojiEntry { hexcode: string; annotation: string; group: string; subgroups: string; skintone: string }`
  - `isCandidate(entry: OpenMojiEntry): boolean`
  - `RAW_OPENMOJI_DIR`, `RAW_NOUN_DIR`, `ICON_OUTPUT_DIR` (absolute paths)
  - `rawIconPath(item: Item): string`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/openmoji.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isCandidate, openMojiSvgUrl, type OpenMojiEntry } from './openmoji.js'

const entry = (overrides: Partial<OpenMojiEntry>): OpenMojiEntry => ({
  hexcode: '1F9C8',
  annotation: 'butter',
  group: 'food-drink',
  subgroups: 'food-prepared',
  skintone: '',
  ...overrides,
})

describe('openMojiSvgUrl', () => {
  it('points at the black line set of the pinned release', () => {
    expect(openMojiSvgUrl('1F9C8')).toBe(
      'https://cdn.jsdelivr.net/npm/openmoji@17.0.0/black/svg/1F9C8.svg'
    )
  })
})

describe('isCandidate', () => {
  it('keeps every subgroup of the whole-group scopes', () => {
    expect(isCandidate(entry({}))).toBe(true)
    expect(isCandidate(entry({ group: 'objects', subgroups: 'tool' }))).toBe(true)
    expect(isCandidate(entry({ group: 'animals-nature', subgroups: 'animal-marine' }))).toBe(true)
  })

  it('keeps only the picked subgroups of mixed groups', () => {
    expect(isCandidate(entry({ group: 'travel-places', subgroups: 'transport-ground' }))).toBe(true)
    // The umbrella lives here; the suns and clouds are dropped by hand.
    expect(isCandidate(entry({ group: 'travel-places', subgroups: 'sky-weather' }))).toBe(true)
    expect(isCandidate(entry({ group: 'travel-places', subgroups: 'place-building' }))).toBe(false)
    expect(isCandidate(entry({ group: 'activities', subgroups: 'sport' }))).toBe(true)
  })

  it('drops people, symbols and flags', () => {
    expect(isCandidate(entry({ group: 'people-body', subgroups: 'person' }))).toBe(false)
    expect(isCandidate(entry({ group: 'symbols', subgroups: 'arrow' }))).toBe(false)
    expect(isCandidate(entry({ group: 'flags', subgroups: 'country-flag' }))).toBe(false)
  })

  it('drops skin-tone variants and multi-codepoint sequences', () => {
    expect(isCandidate(entry({ skintone: '1F3FB' }))).toBe(false)
    expect(isCandidate(entry({ hexcode: '1F43B-200D-2744-FE0F' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run content-engine/visual/openmoji.test.ts`
Expected: FAIL, because `./openmoji.js` can't be resolved.

- [ ] **Step 3: Write the implementation**

`content-engine/visual/openmoji.ts`:
```ts
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
```

`content-engine/visual/iconSources.ts`:
```ts
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
```

`content-engine/visual/scripts/listOpenMojiCandidates.ts`:
```ts
// Lists every OpenMoji entry inside the item scope, for a human to pick items
// from. Writes content-engine/output/openmoji-candidates.tsv (gitignored).
// Run with: npm run visual:candidates

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ITEMS } from '../items.js'
import { isCandidate, OPENMOJI_DATA_URL, type OpenMojiEntry } from '../openmoji.js'

const OUTPUT = join(process.cwd(), 'content-engine', 'output', 'openmoji-candidates.tsv')

async function main() {
  const res = await fetch(OPENMOJI_DATA_URL)
  if (!res.ok) throw new Error(`OpenMoji data fetch failed: ${res.status} ${OPENMOJI_DATA_URL}`)
  const entries = (await res.json()) as OpenMojiEntry[]

  const taken = new Set(ITEMS.flatMap((i) => (i.icon.set === 'openmoji' ? [i.icon.hex] : [])))
  const rows = entries.filter(isCandidate).map((e) => {
    const status = taken.has(e.hexcode) ? 'taken' : ''
    return [status, e.hexcode, e.group, e.subgroups, e.annotation].join('\t')
  })

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, ['status\thex\tgroup\tsubgroup\tannotation', ...rows].join('\n') + '\n')
  console.log(`${rows.length} candidates (${taken.size} already in items.ts) -> ${OUTPUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

`content-engine/visual/scripts/fetchOpenMojiIcons.ts`:
```ts
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
```

Add to `package.json` `"scripts"` (after `"content:build-phonetics"`):
```json
    "visual:candidates": "tsx content-engine/visual/scripts/listOpenMojiCandidates.ts",
    "visual:fetch-icons": "tsx content-engine/visual/scripts/fetchOpenMojiIcons.ts",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/openmoji.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Smoke-run the candidate script**

Run: `npm run visual:candidates`
Expected: `753 candidates (0 already in items.ts) -> …openmoji-candidates.tsv` (measured against OpenMoji 17.0.0 on 2026-10-01).

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npm run typecheck:content-engine && npx eslint content-engine/visual --max-warnings 0`
Expected: exit 0.
```bash
git add content-engine/visual/openmoji.ts content-engine/visual/openmoji.test.ts content-engine/visual/iconSources.ts content-engine/visual/scripts/listOpenMojiCandidates.ts content-engine/visual/scripts/fetchOpenMojiIcons.ts package.json
git commit -m "Add OpenMoji candidate listing and icon vendoring scripts"
```

---

### Task 3: The SVG normalizer

**Files:**
- Modify: `package.json` / `package-lock.json` (devDependency `svgo`)
- Create: `content-engine/visual/normalize.ts`
- Test: `content-engine/visual/normalize.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `STROKE_SCALE = 1.5`, `WARN_BYTES = 6_000`, `MAX_BYTES = 20_000`
  - `type NormalizeResult = { ok: true; svg: string; warnings: string[] } | { ok: false; reasons: string[] }`
  - `normalizeSvg(raw: string, strokeScale?: number): NormalizeResult` (`strokeScale` defaults to 1, meaning no scaling)

- [ ] **Step 1: Install svgo**

Run: `npm install --save-dev svgo@^4.1.0`
Expected: `package.json` devDependencies gains `"svgo": "^4.1.0"`.

- [ ] **Step 2: Write the failing test**

`content-engine/visual/normalize.test.ts`. The OpenMoji fixture is the real butter icon (`1F9C8`), trimmed to its first element.
```ts
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
    expect(svg).toContain('stroke-width="3"')
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run content-engine/visual/normalize.test.ts`
Expected: FAIL, because `./normalize.js` can't be resolved.

- [ ] **Step 4: Write the implementation**

`content-engine/visual/normalize.ts`. This exact code was prototyped against svgo 4.1.0: it normalizes all 165 pilot icons and rejects every case above.
```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/normalize.test.ts`
Expected: PASS (18 tests). If the filled-path test's exact-string assertion fails *only* on attribute order, svgo has changed its output order since 4.1.0. Check the difference is order alone, update the expected string to match, and note the svgo version in the commit message.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npm run typecheck:content-engine && npx eslint content-engine/visual --max-warnings 0`
Expected: exit 0.
```bash
git add package.json package-lock.json content-engine/visual/normalize.ts content-engine/visual/normalize.test.ts
git commit -m "Add the SVG icon normalizer and safety gate"
```

---

### Task 4: Contact sheet and the normalize script

**Files:**
- Create: `content-engine/visual/contactSheet.ts`
- Create: `content-engine/visual/scripts/normalizeIcons.ts`
- Modify: `package.json` (`scripts`)
- Test: `content-engine/visual/contactSheet.test.ts`

**Interfaces:**
- Consumes: `normalizeSvg`, `STROKE_SCALE` (Task 3); `ITEMS` (Task 1); `rawIconPath`, `ICON_OUTPUT_DIR` (Task 2).
- Produces:
  - `SHEET_SIZES: readonly number[]`
  - `interface SheetEntry { id: string; name: string; svg: string }`
  - `buildContactSheet(entries: SheetEntry[]): string`
  - `strokeScaleFor(item: Item): number`, added to `iconSources.ts`
  - the npm script `visual:icons`

- [ ] **Step 1: Write the failing test**

`content-engine/visual/contactSheet.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run content-engine/visual/contactSheet.test.ts`
Expected: FAIL, because `./contactSheet.js` can't be resolved.

- [ ] **Step 3: Write the implementation**

`content-engine/visual/contactSheet.ts`:
```ts
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
```

Add to `content-engine/visual/iconSources.ts`. These are the new imports plus a function appended to the end of the file:
```ts
import { STROKE_SCALE } from './normalize.js'
```
```ts
/** Only OpenMoji's stroke art is rescaled; Noun Project icons are judged as drawn. */
export function strokeScaleFor(item: Item): number {
  return item.icon.set === 'openmoji' ? STROKE_SCALE : 1
}
```

`content-engine/visual/scripts/normalizeIcons.ts`:
```ts
// Normalizes every item's raw icon into public/icons/visual/<id>.svg and
// writes the review contact sheet. Never deletes anything: an orphaned output
// file is reported and fails the run, and removing it is a human decision.
// Run with: npm run visual:icons

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildContactSheet, type SheetEntry } from '../contactSheet.js'
import { ICON_OUTPUT_DIR, rawIconPath, strokeScaleFor } from '../iconSources.js'
import { ITEMS } from '../items.js'
import { normalizeSvg } from '../normalize.js'

const SHEET_PATH = join(process.cwd(), 'content-engine', 'output', 'icon-sheet.html')

const failures: string[] = []
const warnings: string[] = []
const changed: string[] = []
const entries: SheetEntry[] = []

mkdirSync(ICON_OUTPUT_DIR, { recursive: true })

for (const item of ITEMS) {
  const source = rawIconPath(item)
  if (!existsSync(source)) {
    failures.push(`${item.id}: no raw file at ${source} (run npm run visual:fetch-icons)`)
    continue
  }
  const result = normalizeSvg(readFileSync(source, 'utf8'), strokeScaleFor(item))
  if (!result.ok) {
    for (const reason of result.reasons) failures.push(`${item.id}: ${reason}`)
    continue
  }
  for (const warning of result.warnings) warnings.push(`${item.id}: ${warning}`)

  const out = join(ICON_OUTPUT_DIR, `${item.id}.svg`)
  if (!existsSync(out) || readFileSync(out, 'utf8') !== result.svg) changed.push(item.id)
  writeFileSync(out, result.svg)
  entries.push({ id: item.id, name: item.name, svg: result.svg })
}

const expected = new Set(ITEMS.map((i) => `${i.id}.svg`))
const orphans = readdirSync(ICON_OUTPUT_DIR).filter((f) => !expected.has(f))

mkdirSync(join(process.cwd(), 'content-engine', 'output'), { recursive: true })
writeFileSync(SHEET_PATH, buildContactSheet(entries))

console.log(`Normalized ${entries.length}/${ITEMS.length} icons -> ${ICON_OUTPUT_DIR}`)
console.log(`Contact sheet -> ${SHEET_PATH}`)
// Phase 2 extends this line with the shape-family tags to re-check, since
// those are judged on the icon as drawn (planning-visual-pivot.md §4.1).
if (changed.length > 0) console.log(`Changed (${changed.length}): ${changed.join(', ')}`)
for (const w of warnings) console.warn(`warn  ${w}`)
for (const f of failures) console.error(`FAIL  ${f}`)
for (const o of orphans) {
  console.error(`ORPHAN  ${o} has no item; delete it by hand if that is intended`)
}
if (failures.length > 0 || orphans.length > 0) process.exit(1)
```

Add to `package.json` `"scripts"`:
```json
    "visual:icons": "tsx content-engine/visual/scripts/normalizeIcons.ts",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run content-engine/visual/contactSheet.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Smoke-run the script on the still-empty bank**

Run: `npm run visual:icons`
Expected: `Normalized 0/0 icons -> …public\icons\visual`, `Contact sheet -> …icon-sheet.html`, exit 0. The empty `public/icons/visual/` directory is created and stays untracked until Task 5 puts files in it.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `npm run typecheck:content-engine && npx eslint content-engine/visual --max-warnings 0`
Expected: exit 0.
```bash
git add content-engine/visual/contactSheet.ts content-engine/visual/contactSheet.test.ts content-engine/visual/iconSources.ts content-engine/visual/scripts/normalizeIcons.ts package.json
git commit -m "Add the icon contact sheet and normalize script"
```

---

### Task 5: The 165-item pilot bank and its icons

**Files:**
- Modify: `content-engine/visual/items.ts`
- Create: `content-engine/visual/iconFiles.test.ts`
- Create: `content-engine/visual/icons/openmoji/*.svg` (165 vendored raw files, via script)
- Create: `public/icons/visual/*.svg` (165 normalized files, via script)
- Create: `content-engine/visual/icons/README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: the pilot `ITEMS` (165 entries: 84 things, 28 food, 28 animals, 15 vehicles, 10 plants), committed raw and normalized icons, and the invariant test that keeps them in sync.

- [ ] **Step 1: Write the failing test**

`content-engine/visual/iconFiles.test.ts`:
```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICON_OUTPUT_DIR, rawIconPath, strokeScaleFor } from './iconSources.js'
import { ITEMS } from './items.js'
import { normalizeSvg } from './normalize.js'

// Ties the committed icons to the pipeline: an item without an icon, an icon
// without an item, or an output that no longer matches what the normalizer
// produces (STROKE_SCALE changed, a raw file edited) all fail here.
describe('committed icons', () => {
  it('the pilot bank is loaded', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(150)
  })

  it('every item has its raw source file', () => {
    expect(ITEMS.filter((item) => !existsSync(rawIconPath(item))).map((i) => i.id)).toEqual([])
  })

  it('every item has an output identical to what the normalizer produces now', () => {
    const stale = ITEMS.filter((item) => {
      const out = join(ICON_OUTPUT_DIR, `${item.id}.svg`)
      if (!existsSync(out)) return true
      const result = normalizeSvg(readFileSync(rawIconPath(item), 'utf8'), strokeScaleFor(item))
      return !result.ok || readFileSync(out, 'utf8') !== result.svg
    })
    expect(stale.map((i) => i.id)).toEqual([])
  })

  it('there is no output file without an item', () => {
    const expected = new Set(ITEMS.map((i) => `${i.id}.svg`))
    const files = existsSync(ICON_OUTPUT_DIR) ? readdirSync(ICON_OUTPUT_DIR) : []
    expect(files.filter((f) => !expected.has(f))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run content-engine/visual/iconFiles.test.ts`
Expected: FAIL on `the pilot bank is loaded` (0 ≥ 150 is false). The other three pass trivially on an empty bank.

- [ ] **Step 3: Fill the pilot bank**

Replace the body of `content-engine/visual/items.ts`. Every hexcode below was checked against OpenMoji 17.0.0's `data/openmoji.json`, and all 165 black SVGs were fetched from the pinned CDN path successfully on 2026-09-30.
```ts
import type { Item, ItemGroup } from './types.js'

// The visual item bank (planning-visual-pivot.md §5.1). Ids are permanent —
// see Item.id. Picked from `npm run visual:candidates`: globally familiar,
// one clear name each, nothing two players would name differently on sight.

const om = (id: string, name: string, group: ItemGroup, hex: string): Item => ({
  id,
  name,
  group,
  icon: { set: 'openmoji', hex },
})

export const ITEMS: Item[] = [
  // thing
  om('anchor', 'anchor', 'thing', '2693'),
  om('guitar', 'guitar', 'thing', '1F3B8'),
  om('violin', 'violin', 'thing', '1F3BB'),
  om('trumpet', 'trumpet', 'thing', '1F3BA'),
  om('drum', 'drum', 'thing', '1F941'),
  om('harp', 'harp', 'thing', '1FA89'),
  om('bell', 'bell', 'thing', '1F514'),
  om('headphones', 'headphones', 'thing', '1F3A7'),
  om('microphone', 'microphone', 'thing', '1F3A4'),
  om('mobile-phone', 'mobile phone', 'thing', '1F4F1'),
  om('battery', 'battery', 'thing', '1F50B'),
  om('electric-plug', 'electric plug', 'thing', '1F50C'),
  om('laptop', 'laptop', 'thing', '1F4BB'),
  om('television', 'television', 'thing', '1F4FA'),
  om('camera', 'camera', 'thing', '1F4F7'),
  om('candle', 'candle', 'thing', '1F56F'),
  om('light-bulb', 'light bulb', 'thing', '1F4A1'),
  om('flashlight', 'flashlight', 'thing', '1F526'),
  om('magnifying-glass', 'magnifying glass', 'thing', '1F50D'),
  om('book', 'book', 'thing', '1F4D5'),
  om('newspaper', 'newspaper', 'thing', '1F4F0'),
  om('coin', 'coin', 'thing', '1FA99'),
  om('treasure-chest', 'treasure chest', 'thing', '1FA8E'),
  om('credit-card', 'credit card', 'thing', '1F4B3'),
  om('envelope', 'envelope', 'thing', '2709'),
  om('cardboard-box', 'cardboard box', 'thing', '1F4E6'),
  om('pencil', 'pencil', 'thing', '270F'),
  om('paintbrush', 'paintbrush', 'thing', '1F58C'),
  om('crayon', 'crayon', 'thing', '1F58D'),
  om('paperclip', 'paperclip', 'thing', '1F4CE'),
  om('ruler', 'ruler', 'thing', '1F4CF'),
  om('scissors', 'scissors', 'thing', '2702'),
  om('key', 'key', 'thing', '1F511'),
  om('padlock', 'padlock', 'thing', '1F512'),
  om('hammer', 'hammer', 'thing', '1F528'),
  om('axe', 'axe', 'thing', '1FA93'),
  om('saw', 'saw', 'thing', '1FA9A'),
  om('wrench', 'wrench', 'thing', '1F527'),
  om('screwdriver', 'screwdriver', 'thing', '1FA9B'),
  om('magnet', 'magnet', 'thing', '1F9F2'),
  om('ladder', 'ladder', 'thing', '1FA9C'),
  om('shovel', 'shovel', 'thing', '1FA8F'),
  om('boomerang', 'boomerang', 'thing', '1FA83'),
  om('shield', 'shield', 'thing', '1F6E1'),
  om('test-tube', 'test tube', 'thing', '1F9EA'),
  om('microscope', 'microscope', 'thing', '1F52C'),
  om('syringe', 'syringe', 'thing', '1F489'),
  om('bandage', 'bandage', 'thing', '1FA79'),
  om('mirror', 'mirror', 'thing', '1FA9E'),
  om('bed', 'bed', 'thing', '1F6CF'),
  om('chair', 'chair', 'thing', '1FA91'),
  om('bathtub', 'bathtub', 'thing', '1F6C1'),
  om('broom', 'broom', 'thing', '1F9F9'),
  om('bucket', 'bucket', 'thing', '1FAA3'),
  om('soap', 'soap', 'thing', '1F9FC'),
  om('toothbrush', 'toothbrush', 'thing', '1FAA5'),
  om('sponge', 'sponge', 'thing', '1F9FD'),
  om('fire-extinguisher', 'fire extinguisher', 'thing', '1F9EF'),
  om('umbrella', 'umbrella', 'thing', '2602'),
  om('sunglasses', 'sunglasses', 'thing', '1F576'),
  om('necktie', 'necktie', 'thing', '1F454'),
  om('gloves', 'gloves', 'thing', '1F9E4'),
  om('socks', 'socks', 'thing', '1F9E6'),
  om('backpack', 'backpack', 'thing', '1F392'),
  om('running-shoe', 'running shoe', 'thing', '1F45F'),
  om('crown', 'crown', 'thing', '1F451'),
  om('ring', 'ring', 'thing', '1F48D'),
  om('balloon', 'balloon', 'thing', '1F388'),
  om('gift-box', 'gift box', 'thing', '1F381'),
  om('teddy-bear', 'teddy bear', 'thing', '1F9F8'),
  om('teapot', 'teapot', 'thing', '1FAD6'),
  om('spoon', 'spoon', 'thing', '1F944'),
  om('kitchen-knife', 'kitchen knife', 'thing', '1F52A'),
  om('jar', 'jar', 'thing', '1FAD9'),
  om('kite', 'kite', 'thing', '1FA81'),
  om('dice', 'dice', 'thing', '1F3B2'),
  om('soccer-ball', 'soccer ball', 'thing', '26BD'),
  om('ice-skate', 'ice skate', 'thing', '26F8'),
  om('trophy', 'trophy', 'thing', '1F3C6'),
  om('fishing-rod', 'fishing rod', 'thing', '1F3A3'),
  om('feather', 'feather', 'thing', '1FAB6'),
  om('seashell', 'seashell', 'thing', '1F41A'),
  om('ice-cube', 'ice cube', 'thing', '1F9CA'),
  om('life-ring', 'life ring', 'thing', '1F6DF'),

  // food
  om('banana', 'banana', 'food', '1F34C'),
  om('apple', 'apple', 'food', '1F34E'),
  om('lemon', 'lemon', 'food', '1F34B'),
  om('grapes', 'grapes', 'food', '1F347'),
  om('watermelon', 'watermelon', 'food', '1F349'),
  om('pineapple', 'pineapple', 'food', '1F34D'),
  om('strawberry', 'strawberry', 'food', '1F353'),
  om('coconut', 'coconut', 'food', '1F965'),
  om('tomato', 'tomato', 'food', '1F345'),
  om('carrot', 'carrot', 'food', '1F955'),
  om('potato', 'potato', 'food', '1F954'),
  om('corn-on-the-cob', 'corn on the cob', 'food', '1F33D'),
  om('broccoli', 'broccoli', 'food', '1F966'),
  om('onion', 'onion', 'food', '1F9C5'),
  om('peanuts', 'peanuts', 'food', '1F95C'),
  om('bread', 'bread', 'food', '1F35E'),
  om('cheese', 'cheese', 'food', '1F9C0'),
  om('egg', 'egg', 'food', '1F95A'),
  om('butter', 'butter', 'food', '1F9C8'),
  om('pizza', 'pizza', 'food', '1F355'),
  om('hamburger', 'hamburger', 'food', '1F354'),
  om('popcorn', 'popcorn', 'food', '1F37F'),
  om('doughnut', 'doughnut', 'food', '1F369'),
  om('cookie', 'cookie', 'food', '1F36A'),
  om('chocolate-bar', 'chocolate bar', 'food', '1F36B'),
  om('honey-pot', 'honey pot', 'food', '1F36F'),
  om('ice-cream-cone', 'ice cream cone', 'food', '1F366'),
  om('glass-of-milk', 'glass of milk', 'food', '1F95B'),

  // animal
  om('dog', 'dog', 'animal', '1F415'),
  om('cat', 'cat', 'animal', '1F408'),
  om('horse', 'horse', 'animal', '1F40E'),
  om('cow', 'cow', 'animal', '1F404'),
  om('pig', 'pig', 'animal', '1F416'),
  om('sheep', 'sheep', 'animal', '1F411'),
  om('camel', 'camel', 'animal', '1F42A'),
  om('giraffe', 'giraffe', 'animal', '1F992'),
  om('elephant', 'elephant', 'animal', '1F418'),
  om('mouse', 'mouse', 'animal', '1F401'),
  om('rabbit', 'rabbit', 'animal', '1F407'),
  om('bear', 'bear', 'animal', '1F43B'),
  om('chicken', 'chicken', 'animal', '1F414'),
  om('penguin', 'penguin', 'animal', '1F427'),
  om('duck', 'duck', 'animal', '1F986'),
  om('owl', 'owl', 'animal', '1F989'),
  om('frog', 'frog', 'animal', '1F438'),
  om('turtle', 'turtle', 'animal', '1F422'),
  om('snake', 'snake', 'animal', '1F40D'),
  om('whale', 'whale', 'animal', '1F40B'),
  om('fish', 'fish', 'animal', '1F41F'),
  om('shark', 'shark', 'animal', '1F988'),
  om('octopus', 'octopus', 'animal', '1F419'),
  om('crab', 'crab', 'animal', '1F980'),
  om('snail', 'snail', 'animal', '1F40C'),
  om('butterfly', 'butterfly', 'animal', '1F98B'),
  om('bee', 'bee', 'animal', '1F41D'),
  om('spider', 'spider', 'animal', '1F577'),

  // vehicle
  om('bicycle', 'bicycle', 'vehicle', '1F6B2'),
  om('car', 'car', 'vehicle', '1F697'),
  om('bus', 'bus', 'vehicle', '1F68C'),
  om('ambulance', 'ambulance', 'vehicle', '1F691'),
  om('fire-engine', 'fire engine', 'vehicle', '1F692'),
  om('tractor', 'tractor', 'vehicle', '1F69C'),
  om('motorcycle', 'motorcycle', 'vehicle', '1F3CD'),
  om('truck', 'truck', 'vehicle', '1F69A'),
  om('steam-train', 'steam train', 'vehicle', '1F682'),
  om('skateboard', 'skateboard', 'vehicle', '1F6F9'),
  om('sailboat', 'sailboat', 'vehicle', '26F5'),
  om('canoe', 'canoe', 'vehicle', '1F6F6'),
  om('airplane', 'airplane', 'vehicle', '2708'),
  om('helicopter', 'helicopter', 'vehicle', '1F681'),
  om('rocket', 'rocket', 'vehicle', '1F680'),

  // plant
  om('sunflower', 'sunflower', 'plant', '1F33B'),
  om('rose', 'rose', 'plant', '1F339'),
  om('tulip', 'tulip', 'plant', '1F337'),
  om('cactus', 'cactus', 'plant', '1F335'),
  om('palm-tree', 'palm tree', 'plant', '1F334'),
  om('tree', 'tree', 'plant', '1F333'),
  om('pine-tree', 'pine tree', 'plant', '1F332'),
  om('mushroom', 'mushroom', 'plant', '1F344'),
  om('four-leaf-clover', 'four-leaf clover', 'plant', '1F340'),
  om('maple-leaf', 'maple leaf', 'plant', '1F341'),
]
```

- [ ] **Step 4: Run the tests to see the next failure**

Run: `npx vitest run content-engine/visual/iconFiles.test.ts content-engine/visual/validateItems.test.ts`
Expected: `validateItems` all PASS. `iconFiles` FAILs on the raw-file and output checks, listing all 165 ids, because nothing has been fetched yet.

- [ ] **Step 5: Vendor the raw icons**

Run: `npm run visual:fetch-icons`
Expected: `Fetched 165 new OpenMoji file(s) into …content-engine\visual\icons\openmoji`. Re-running prints `Fetched 0`.

- [ ] **Step 6: Normalize**

Run: `npm run visual:icons`
Expected: `Normalized 165/165 icons`, a `Changed (165): …` line, no `warn`, `FAIL` or `ORPHAN` lines, exit 0. (The prototype's largest output was 3,615 bytes, under the 6,000-byte warning.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run content-engine/visual`
Expected: PASS for every file in `content-engine/visual/`.

- [ ] **Step 8: Record the icons' provenance and licenses**

`content-engine/visual/icons/README.md`:
```markdown
# Visual icons — provenance and licences

- `openmoji/<HEX>.svg` — unmodified files from OpenMoji 17.0.0's black line set
  (https://openmoji.org), fetched by `npm run visual:fetch-icons` from
  `https://cdn.jsdelivr.net/npm/openmoji@17.0.0/black/svg/`. Licence: CC BY-SA 4.0.
  Required credit: "All emojis designed by OpenMoji – the open-source emoji and
  icon project. License: CC BY-SA 4.0".
- `noun/<id>.svg` — Noun Project icons, CC BY 3.0. Each one's creator and page are
  recorded on its item in `../items.ts` and shown on the in-game credits screen.
- `public/icons/visual/<id>.svg` — produced from the files above by
  `npm run visual:icons` (recoloured, stroke-scaled, optimized). As adaptations,
  the OpenMoji-derived files are CC BY-SA 4.0 too. This covers the icon files
  only, not the game's code.

Never hand-edit an output file: `iconFiles.test.ts` fails if one stops matching
what the normalizer produces from its raw file.
```

- [ ] **Step 9: Full verification**

Run: `npm test && npm run lint && npm run typecheck:content-engine && npm run build`
Expected: every suite passes (the existing word-engine suites are unchanged); lint and typecheck are clean; the build succeeds.
Then run: `grep -c "icons/visual" dist/sw.js`
Expected: `0`. The service worker must not precache the icon set (spec §5.5: icons get a runtime cache in Phase 4).

- [ ] **Step 10: Commit**

```bash
git add content-engine/visual/items.ts content-engine/visual/iconFiles.test.ts content-engine/visual/icons public/icons/visual
git commit -m "Add the 165-item visual pilot bank and its icons"
```

---

### Task 6: Contact-sheet review and stroke calibration (human gate)

This task is judgment work, not code. It's what actually enforces the anti-ambiguity rule, and Phase 1 isn't done until it passes.

**Files:**
- Modify (only if the review calls for it): `content-engine/visual/normalize.ts` (`STROKE_SCALE`), `content-engine/visual/items.ts`, `public/icons/visual/*.svg` (regenerated, never hand-edited)

- [ ] **Step 1: Open the contact sheet**

Open `content-engine/output/icon-sheet.html` in a browser.

- [ ] **Step 2: Calibrate `STROKE_SCALE`**

Look at the 36 px column (the card size) in both panels. Lines should read clearly without details clogging (watch `bicycle`, `harp`, `microscope`, `pineapple`). If they look too thin or too heavy, change `STROKE_SCALE` in `normalize.ts` in 0.25 steps and re-run `npm run visual:icons`; every icon will appear under `Changed`. Expected end state: a value between 1.25 and 2 that reads well at 26 px and 36 px.
The `normalize.test.ts` stroke assertion (`stroke-width="3"`) and the "1.5" in the plan both assume the default. If you change the value, update that assertion to `2 × STROKE_SCALE`.

- [ ] **Step 3: Recognizability pass**

For each tile, check that a player could name the thing correctly from the 36 px icon **alongside its caption**, and that it couldn't be confused with another item in the bank. For each failure, pick one:
- the caption is the problem → change `name` (never the `id`)
- the icon is the problem → swap the hexcode for a better OpenMoji candidate (`npm run visual:candidates`), or mark `blocked: true` until a Noun Project replacement is sourced in a later batch

Re-run `npm run visual:fetch-icons && npm run visual:icons` after any hexcode change. The superseded raw file stays in the repo (non-destructive); delete it by hand only if you're sure.

- [ ] **Step 4: Re-verify**

Run: `npm test && npm run lint && npm run typecheck:content-engine`
Expected: all pass.

- [ ] **Step 5: Mark Phase 1 done in the spec**

In `planning-visual-pivot.md` §6 under Phase 1, add the line:
`**Status:** done YYYY-MM-DD (STROKE_SCALE = <value>; <n> items, <k> blocked).`

- [ ] **Step 6: Commit**

```bash
git add content-engine/visual public/icons/visual planning-visual-pivot.md planning-visual-pivot-phase1.md
git commit -m "Calibrate icon stroke weight after contact-sheet review"
```

---

## Self-review against the spec

| Spec requirement (planning-visual-pivot.md) | Task |
|---|---|
| §5.1 `Item` shape, groups, OpenMoji / Noun Project sources | 1 |
| §5.1 candidate listing from the in-scope OpenMoji groups | 2 |
| §5.1 globally familiar items, one clear name, no lookalikes | 5 (list), 6 (review) |
| §5.2 pinned source; Noun Project files in `icons/noun/` | 2 (`OPENMOJI_VERSION`, `RAW_NOUN_DIR`) |
| §5.2 svgo `preset-default` + `removeDimensions`, ids dropped | 3 |
| §5.2 recolor to `currentColor`, keep `fill="none"`, root `fill="currentColor"` | 3 |
| §5.2 `STROKE_SCALE` calibration knob, OpenMoji only | 3, 4 (`strokeScaleFor`), 6 |
| §5.2 allowlist gate (elements, attributes, `on*`, `href`, `url(`, script/style/foreignObject/image/text, and any processing instruction other than the XML declaration — added after the Task 3 review found `<?xml-stylesheet?>` slipped through) | 3 |
| §5.2 reject `<text>`; reject multi-color cutouts; 6 KB warn / 20 KB reject | 3 |
| §5.2 1:1 item↔file check, enforced by a test | 5 (`iconFiles.test.ts`) |
| §5.2 contact sheet at card / clue / tray sizes, light and dark, with captions | 4, 6 |
| §5.2 licensing recorded per item; CC BY-SA on derivatives | 1 (credit fields validated), 5 (README) |
| §4.1 redrawn icon → re-check shape tags | 4 prints `Changed: …`; Phase 2 attaches the shape-tag list |
| §6 Phase 1 exit: pilot normalizes cleanly; contact sheet reviewed | 5, 6 |
| Global: nothing deleted; word engine untouched; ESM `.js` imports | all tasks (orphans are reported, never removed) |

**Changes made during execution (reviews), beyond the task text above:**
- Task 3 review: the gate also rejects every XML processing instruction except the `<?xml …?>` declaration (already folded into Task 3's code and tests above).
- Final whole-branch review: the gate also rejects CDATA sections and non-whitespace text content; a test pins the root-level default stroke width; and both `fetchOpenMojiIcons.ts` and `normalizeIcons.ts` refuse to run when `validateItems(ITEMS)` reports problems. These live in the commit "Harden the icon gate and check the item bank before icon scripts". The code blocks in Tasks 2–4 above predate it.

**Deviation from the spec, recorded:** §5.2 said OpenMoji would be a pinned *devDependency*. That package is 43 MB across 11,539 files and would be installed on every Netlify and Vercel build, so this plan vendors only the files it uses, from the same pinned release. The spec has been updated to match.
