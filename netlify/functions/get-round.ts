// Phase 4 (build-plan.md / planning.md §8.4): serves the current puzzle with
// every guest's true label stripped out, and either starts a fresh round or
// resumes an in-progress one (via ?resultId=) so refreshing the page can't
// reset a player's lives. Real date-based "today's puzzle" scheduling is
// Phase 5 — for now this always serves the lowest-numbered approved puzzle.

import { ObjectId } from 'mongodb'
import type { GetRoundResponse } from './_shared/api'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'
import { buildPool, resolveClueWords } from './_shared/roundView'
import type { PuzzleDoc, ResultDoc } from './_shared/types'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  const resultId = url.searchParams.get('resultId')

  const { puzzles, results, rules } = await getCollections()

  let result: ResultDoc | null = null
  let puzzle: PuzzleDoc | null = null

  if (resultId && ObjectId.isValid(resultId)) {
    result = await results.findOne({ _id: new ObjectId(resultId) })
    if (result) {
      puzzle = await puzzles.findOne({ _id: new ObjectId(result.puzzleId) })
    }
  }

  if (!result || !puzzle) {
    puzzle = await puzzles.findOne({ status: 'approved' }, { sort: { number: 1 } })
    if (!puzzle) {
      return jsonResponse({ error: 'No approved puzzle is available yet.' }, 404)
    }

    const fresh: ResultDoc = {
      puzzleId: puzzle._id!.toString(),
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
    number: puzzle.number,
    clues,
    pool,
    livesRemaining: result.livesRemaining,
    roundComplete: result.roundComplete,
    ruleText,
  }

  return jsonResponse(response)
}
