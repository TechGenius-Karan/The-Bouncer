// Server-rendered puzzle archive: /archive and /archive/YYYY-MM-DD.
//
// Exists for two reasons. Players want to see past puzzles, and the site had
// exactly one indexable URL — a client-rendered SPA gives a crawler an empty
// div, so there was almost nothing for search to rank. Every finished puzzle
// becomes a real HTML page with words and a rule on it.
//
// SPOILER BOUNDARY: only puzzles dated strictly BEFORE today (UTC) are ever
// served. planning.md locks spoiler-safety (§6.2), and today's answers leaking
// through a side door would break the game far more quietly than a bug. The
// cut-off lives in the Mongo query itself, not in a caller, so there is one
// place to get it right.

import {
  renderArchiveIndex,
  renderArchivePuzzle,
  renderNotFound,
  type ArchiveEntry,
  type ArchivePuzzle,
} from './_shared/archiveView'
import { pastPuzzleFilter } from './_shared/archiveQuery'
import { getCollections } from './_shared/db'
import { isValidPuzzleDateString, resolvePuzzleDateString } from './_shared/puzzleDate'

// A past puzzle never changes, so these are safe to cache hard. Keeps crawler
// traffic off Mongo — Atlas's free tier connection budget is shared with the
// game itself.
const CACHE_HEADER = 'public, max-age=3600, s-maxage=86400'

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': CACHE_HEADER },
  })
}

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  // Netlify rewrites /archive/... to this function; the requested date is the
  // last path segment when it looks like one.
  const segments = url.pathname.split('/').filter(Boolean)
  const requested = segments[segments.length - 1]
  const wantsDetail = requested !== undefined && requested !== 'archive'

  const today = resolvePuzzleDateString()
  const { puzzles, words, rules } = await getCollections()

  if (!wantsDetail) {
    const docs = await puzzles
      .find(pastPuzzleFilter(today), {
        projection: { date: 1, number: 1, ruleId: 1, revealRuleId: 1 },
      })
      .sort({ date: -1 })
      .toArray()

    const ruleDocs = await rules
      .find({ _id: { $in: [...new Set(docs.map((d) => d.revealRuleId ?? d.ruleId))] } })
      .toArray()
    const ruleById = new Map(ruleDocs.map((r) => [r._id, r]))

    const entries: ArchiveEntry[] = docs.map((d) => {
      const rule = ruleById.get(d.revealRuleId ?? d.ruleId)
      return {
        date: d.date as string,
        number: d.number,
        ruleName: rule?.name ?? d.ruleId,
        ruleDescription: rule?.descriptionTemplate ?? '',
      }
    })
    return html(renderArchiveIndex(entries))
  }

  if (!isValidPuzzleDateString(requested)) return html(renderNotFound(), 404)

  const doc = await puzzles.findOne(pastPuzzleFilter(today, { date: requested }))
  if (!doc) return html(renderNotFound(), 404)

  const [wordDocs, rule, previousDoc, nextDoc] = await Promise.all([
    words
      .find({
        _id: { $in: [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)] },
      })
      .toArray(),
    rules.findOne({ _id: doc.revealRuleId ?? doc.ruleId }),
    puzzles.findOne(pastPuzzleFilter(today, { date: { $lt: requested } }), {
      projection: { date: 1 },
      sort: { date: -1 },
    }),
    puzzles.findOne(pastPuzzleFilter(today, { date: { $gt: requested } }), {
      projection: { date: 1 },
      sort: { date: 1 },
    }),
  ])

  const spellingOf = new Map(wordDocs.map((w) => [w._id, w.spelling]))
  const puzzle: ArchivePuzzle = {
    date: doc.date as string,
    number: doc.number,
    ruleName: rule?.name ?? doc.ruleId,
    ruleDescription: rule?.descriptionTemplate ?? '',
    clues: doc.clues.map((c) => ({ word: spellingOf.get(c.wordId) ?? c.wordId, label: c.label })),
    guests: doc.guests.map((g) => ({
      word: spellingOf.get(g.wordId) ?? g.wordId,
      trueLabel: g.trueLabel,
    })),
  }

  return html(
    renderArchivePuzzle(puzzle, {
      previous: (previousDoc?.date as string | undefined) ?? undefined,
      next: (nextDoc?.date as string | undefined) ?? undefined,
    })
  )
}
