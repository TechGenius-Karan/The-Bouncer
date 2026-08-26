// Phase 5 (build-plan.md / planning.md §8.2, §8.4, §10): serves the puzzle
// scheduled for today (UTC), with every guest's true label stripped out, and
// either starts a fresh round or resumes an in-progress one (via
// ?resultId=) so refreshing the page can't reset a player's lives. A
// resumed round is only trusted if it's actually dated today — otherwise a
// returning player's stale, already-finished round from a previous day
// would be served forever instead of today's puzzle.

import { ObjectId } from 'mongodb'
import type { GetRoundResponse } from './_shared/api'
import { getCollections } from './_shared/db'
import { isValidPuzzleDateString, resolvePuzzleDateString } from './_shared/puzzleDate'
import { jsonResponse } from './_shared/respond'
import { buildPool, resolveClueWords } from './_shared/roundView'
import type { PuzzleDoc, ResultDoc } from './_shared/types'

// Lets us simulate a different "today" to manually walk through a
// multi-day schedule without touching the system clock. Fails closed: only
// local `netlify dev` (NETLIFY_DEV, set reliably by the CLI itself — unlike
// CONTEXT, which isn't guaranteed to be populated for local dev) or a
// deploy-preview/branch-deploy context can honor it, so a real production
// deploy never can.
const OVERRIDE_ALLOWED_CONTEXTS = new Set(['branch-deploy', 'deploy-preview'])

function resolveToday(url: URL): string {
  const allowOverride =
    process.env.NETLIFY_DEV === 'true' || OVERRIDE_ALLOWED_CONTEXTS.has(process.env.CONTEXT ?? '')
  const asOf = allowOverride ? url.searchParams.get('asOf') : null
  if (asOf && isValidPuzzleDateString(asOf)) {
    return resolvePuzzleDateString(new Date(`${asOf}T00:00:00.000Z`))
  }
  return resolvePuzzleDateString()
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  const resultId = url.searchParams.get('resultId')
  const today = resolveToday(url)

  const { puzzles, results, rules } = await getCollections()

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
    const rule = await rules.findOne({ _id: puzzle.ruleId })
    ruleText = rule?.descriptionTemplate ?? null
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
}
