// Drafts the visual tagging matrix with Gemini, offline (planning-visual-pivot.md
// §4.3). Each batch is asked three times independently; a cell is yes or no
// only when all three agree, otherwise unsure (D3). Nothing under api/, lib/ or
// src/ imports this, and nothing here runs at game time.
//
// Resumable: a rule is only asked about items it has no AI or human answer for
// yet, and its family's tags/<family>.ai.ts is rewritten after every rule. A
// quota stop just pauses the run. Human overrides are never read for writing,
// so a re-run can't touch a reviewed decision.
//
// Run with: npm run visual:tag -- [--family F] [--rule ID] [--limit N] [--dry]

import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GoogleGenAI, Type } from '@google/genai'
import { ITEMS } from '../items.js'
import type { Cell } from '../matrix.js'
import { VISUAL_RULES } from '../rules.js'
import {
  buildRuleTaggingPrompt,
  consensus,
  itemsToTag,
  mergeRow,
  parseRuleTaggingResponse,
  renderAiTagFile,
} from '../tagging.js'
import { TAG_FILES } from '../tags/index.js'
import { validateItems } from '../validateItems.js'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
const PASSES = 3
const BATCH_SIZE = 100
const MAX_RETRIES = 4
const TAGS_DIR = join(process.cwd(), 'content-engine', 'visual', 'tags')

const flag = (name: string) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const DRY_RUN = process.argv.includes('--dry')
const FAMILY = flag('--family')
const RULE = flag('--rule')
const LIMIT = Number(flag('--limit')) || Infinity

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      answer: { type: Type.STRING, enum: ['yes', 'no', 'unsure'] },
    },
    required: ['id', 'answer'],
  },
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One pass over one batch. Null if the call never succeeded: the batch stays untagged for the next run. */
async function askOnce(prompt: string, ids: string[]): Promise<Map<string, Cell> | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      })
      return parseRuleTaggingResponse(JSON.parse(response.text ?? '[]'), ids)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt === MAX_RETRIES) {
        console.warn(`  call failed after ${MAX_RETRIES} retries: ${message.slice(0, 120)}`)
        return null
      }
      const isRateLimit = message.includes('429') || message.toLowerCase().includes('quota')
      await sleep(isRateLimit ? 5000 * (attempt + 1) : 1000)
    }
  }
  return null
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set — add it to .env.')
    process.exit(1)
  }
  const problems = validateItems(ITEMS)
  if (problems.length > 0) {
    for (const p of problems) console.error(`INVALID  ${p}`)
    process.exit(1)
  }

  const rules = VISUAL_RULES.filter(
    (r) =>
      !r.retired &&
      (FAMILY === undefined || r.family === FAMILY) &&
      (RULE === undefined || r.id === RULE) &&
      itemsToTag(r.id, ITEMS, TAG_FILES[r.family].ai, TAG_FILES[r.family].overrides).length > 0
  ).slice(0, LIMIT)
  if (rules.length === 0) {
    console.log('Nothing to tag: every selected rule has an answer for every item.')
    process.exit(0)
  }
  console.log(`Tagging ${rules.length} rule(s) via ${MODEL}, ${PASSES} passes per batch.`)

  for (const rule of rules) {
    const files = TAG_FILES[rule.family]
    const todo = itemsToTag(rule.id, ITEMS, files.ai, files.overrides)
    const cells = new Map<string, Cell>()

    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const batch = todo.slice(i, i + BATCH_SIZE)
      const ids = batch.map((item) => item.id)
      const prompt = buildRuleTaggingPrompt(rule, batch)
      const passes: Map<string, Cell>[] = []
      for (let p = 0; p < PASSES; p++) {
        const answers = await askOnce(prompt, ids)
        if (answers === null) break
        passes.push(answers)
      }
      // A batch with a failed pass is left untagged rather than judged on two passes.
      if (passes.length < PASSES) continue
      for (const [id, cell] of consensus(passes, ids)) cells.set(id, cell)
    }

    const tally = { yes: 0, no: 0, unsure: 0 }
    for (const cell of cells.values()) tally[cell]++
    console.log(
      `${rule.id}: ${tally.yes} yes, ${tally.no} no, ${tally.unsure} unsure, ` +
        `${todo.length - cells.size} left untagged`
    )

    if (DRY_RUN) {
      for (const cell of ['yes', 'no', 'unsure'] as const) {
        const sample = [...cells].filter(([, c]) => c === cell).map(([id]) => id)
        console.log(`  ${cell.padEnd(6)} ${sample.slice(0, 20).join(', ')}`)
      }
      continue
    }
    files.ai[rule.id] = mergeRow(files.ai[rule.id], cells)
    writeFileSync(join(TAGS_DIR, `${rule.family}.ai.ts`), renderAiTagFile(files.ai))
  }

  console.log(DRY_RUN ? '\n--dry: nothing written.' : '\nNext: npm run visual:report')
  process.exit(0)
}

main().catch((err) => {
  console.error('tagVisualAi failed:', err)
  process.exit(1)
})
