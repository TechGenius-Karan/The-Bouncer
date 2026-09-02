// Phase 4 (build-plan.md / planning.md §8.4): the server-authoritative
// per-guest check. The client sends one attempted label for one guest; this
// is the only place a guest's true label or the round's life count ever
// changes — never trust anything the client claims about either.

import { ObjectId } from 'mongodb'
import type { CheckSwipeRequest, CheckSwipeResponse } from './_shared/api'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'
import { buildPool, resolveRuleText } from './_shared/roundView'
import type { ResultDoc } from './_shared/types'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body: Partial<CheckSwipeRequest>
  try {
    body = (await req.json()) as Partial<CheckSwipeRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { resultId, wordId, attemptedLabel } = body
  if (
    !resultId ||
    !wordId ||
    (attemptedLabel !== 'IN' && attemptedLabel !== 'OUT') ||
    !ObjectId.isValid(resultId)
  ) {
    return jsonResponse({ error: 'Missing or invalid fields' }, 400)
  }

  const { puzzles, results } = await getCollections()

  const result = await results.findOne({ _id: new ObjectId(resultId) })
  if (!result) {
    return jsonResponse({ error: 'Unknown resultId' }, 404)
  }
  if (result.roundComplete) {
    return jsonResponse({ error: 'This round has already ended.' }, 409)
  }

  const puzzle = await puzzles.findOne({ _id: new ObjectId(result.puzzleId) })
  if (!puzzle) {
    return jsonResponse({ error: 'Puzzle not found' }, 404)
  }

  const guest = puzzle.guests.find((g) => g.wordId === wordId)
  if (!guest) {
    return jsonResponse({ error: 'Unknown wordId for this puzzle' }, 400)
  }
  if (result.placements.some((p) => p.wordId === wordId)) {
    return jsonResponse({ error: 'This guest has already been resolved.' }, 409)
  }

  const correct = attemptedLabel === guest.trueLabel
  const livesRemaining = correct ? result.livesRemaining : result.livesRemaining - 1
  const placements = [...result.placements, { wordId, attemptedLabel, correct }]
  const roundComplete = livesRemaining <= 0 || placements.length === puzzle.guests.length
  const score = placements.filter((p) => p.correct).length
  const completedAt = roundComplete ? new Date() : null

  await results.updateOne(
    { _id: result._id },
    { $set: { placements, livesRemaining, roundComplete, score, completedAt } }
  )

  let ruleText: string | null = null
  let poolReveal: CheckSwipeResponse['poolReveal']
  if (roundComplete) {
    ruleText = await resolveRuleText(puzzle)
    const updatedResult: ResultDoc = {
      ...result,
      placements,
      livesRemaining,
      roundComplete,
      score,
      completedAt,
    }
    poolReveal = await buildPool(puzzle, updatedResult)
  }

  const response: CheckSwipeResponse = {
    correct,
    trueLabel: guest.trueLabel,
    livesRemaining,
    roundComplete,
    ruleText,
    poolReveal,
  }
  return jsonResponse(response)
}
