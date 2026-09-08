// Phase 5 (build-plan.md / planning.md §8.2, §8.4, §10): serves the puzzle
// scheduled for today (UTC), with every guest's true label stripped out, and
// either starts a fresh round or resumes an in-progress one (via
// ?resultId=) so refreshing the page can't reset a player's lives. A
// resumed round is only trusted if it's actually dated today — otherwise a
// returning player's stale, already-finished round from a previous day
// would be served forever instead of today's puzzle.

import { ObjectId } from 'mongodb'
import type { GetRoundResponse } from '../lib/api.js'
import { withCors } from '../lib/cors.js'
import { getCollections } from '../lib/db.js'
import { isValidPuzzleDateString, resolvePuzzleDateString } from '../lib/puzzleDate.js'
import { jsonResponse } from '../lib/respond.js'
import { buildPool, resolveClueWords, resolveRuleText } from '../lib/roundView.js'
import type { PuzzleDoc, ResultDoc } from '../lib/types.js'

// Lets us simulate a different "today" to manually walk through a
// multi-day schedule without touching the system clock. Fails closed: local
// `vercel dev` leaves VERCEL_ENV unset and preview deploys set it to
// 'preview' — only a real production deploy sets it to 'production', so
// this is the one value that must never honor the override.
function resolveToday(url: URL): string {
  const allowOverride = process.env.VERCEL_ENV !== 'production'
  const asOf = allowOverride ? url.searchParams.get('asOf') : null
  if (asOf && isValidPuzzleDateString(asOf)) {
    return resolvePuzzleDateString(new Date(`${asOf}T00:00:00.000Z`))
  }
  return resolvePuzzleDateString()
}

export default {
  fetch: withCors(async (req: Request): Promise<Response> => {
    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const url = new URL(req.url)
    const resultId = url.searchParams.get('resultId')
    const today = resolveToday(url)

    const { puzzles, results } = await getCollections()

    let result: ResultDoc | null = null
    let puzzle: PuzzleDoc | null = null

    if (resultId && ObjectId.isValid(resultId)) {
      const candidate = await results.findOne({ _id: new ObjectId(resultId) })
      if (candidate && candidate.date === today) {
        const candidatePuzzle = await puzzles.findOne({ _id: new ObjectId(candidate.puzzleId) })
        if (candidatePuzzle) {
          result = candidate
          puzzle = candidatePuzzle
        }
      }
    }

    if (!result || !puzzle) {
      puzzle = await puzzles.findOne({ date: today, status: { $in: ['scheduled', 'live'] } })
      if (!puzzle) {
        return jsonResponse({ error: `No puzzle is scheduled for ${today} yet.` }, 404)
      }

      const fresh: ResultDoc = {
        puzzleId: puzzle._id!.toString(),
        date: today,
        userId: null,
        placements: [],
        livesRemaining: 3,
        roundComplete: false,
        score: 0,
        createdAt: new Date(),
        completedAt: null,
      }
      const inserted = await results.insertOne(fresh)
      result = { ...fresh, _id: inserted.insertedId }
    }

    let ruleText: string | null = null
    if (result.roundComplete) {
      ruleText = await resolveRuleText(puzzle)
    }

    const [clues, pool] = await Promise.all([resolveClueWords(puzzle), buildPool(puzzle, result)])

    const response: GetRoundResponse = {
      resultId: result._id!.toString(),
      puzzleId: puzzle._id!.toString(),
      // Safe: puzzle was found via status: scheduled/live, which always has a real number.
      number: puzzle.number!,
      date: result.date,
      clues,
      pool,
      livesRemaining: result.livesRemaining,
      roundComplete: result.roundComplete,
      ruleText,
    }

    return jsonResponse(response)
  }),
}
