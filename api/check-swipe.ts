// Phase 4 (build-plan.md / planning.md §8.4): the server-authoritative
// per-guest check. The client sends one attempted label for one guest; this
// is the only place a guest's true label or the round's life count ever
// changes — never trust anything the client claims about either.

import { ObjectId } from 'mongodb'
import type { CheckSwipeRequest, CheckSwipeResponse } from '../lib/api.js'
import { getCollections } from '../lib/db.js'
import { getPuzzleCached } from '../lib/puzzleCache.js'
import { jsonResponse } from '../lib/respond.js'
import { buildPool, resolveRuleText } from '../lib/roundView.js'
import type { ResultPlacementDoc } from '../lib/types.js'

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    let body: Partial<CheckSwipeRequest>
    try {
      body = (await req.json()) as Partial<CheckSwipeRequest>
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const { resultId, puzzleId, wordId, attemptedLabel } = body
    if (
      !resultId ||
      !puzzleId ||
      !wordId ||
      (attemptedLabel !== 'IN' && attemptedLabel !== 'OUT') ||
      !ObjectId.isValid(resultId)
    ) {
      return jsonResponse({ error: 'Missing or invalid fields' }, 400)
    }

    const puzzle = await getPuzzleCached(puzzleId)
    if (!puzzle) {
      return jsonResponse({ error: 'Puzzle not found' }, 404)
    }

    const guest = puzzle.guests.find((g) => g.wordId === wordId)
    if (!guest) {
      return jsonResponse({ error: 'Unknown wordId for this puzzle' }, 400)
    }

    const correct = attemptedLabel === guest.trueLabel
    const placement: ResultPlacementDoc = { wordId, attemptedLabel, correct }

    const { results } = await getCollections()

    // One atomic round trip for the normal case, instead of a separate
    // find-then-update: the filter below (not-yet-resolved, round still open,
    // puzzleId actually matches this result) doubles as the idempotency guard,
    // which also closes a race where two near-simultaneous swipes of the same
    // guest could otherwise both read "not yet resolved" and both write.
    const updated = await results.findOneAndUpdate(
      {
        _id: new ObjectId(resultId),
        puzzleId,
        roundComplete: false,
        'placements.wordId': { $ne: wordId },
      },
      correct
        ? { $push: { placements: placement } }
        : { $push: { placements: placement }, $inc: { livesRemaining: -1 } },
      { returnDocument: 'after' }
    )

    if (!updated) {
      // Rare path (stale client state, a duplicate/retried request) — pay one
      // extra read here for the specific reason, rather than taxing every
      // normal swipe with an upfront read it doesn't need.
      const existing = await results.findOne({ _id: new ObjectId(resultId) })
      if (!existing) return jsonResponse({ error: 'Unknown resultId' }, 404)
      if (existing.puzzleId !== puzzleId) {
        return jsonResponse({ error: 'This round is not for the current puzzle' }, 409)
      }
      if (existing.roundComplete) {
        return jsonResponse({ error: 'This round has already ended.' }, 409)
      }
      return jsonResponse({ error: 'This guest has already been resolved.' }, 409)
    }

    const roundComplete =
      updated.livesRemaining <= 0 || updated.placements.length === puzzle.guests.length

    let ruleText: string | null = null
    let poolReveal: CheckSwipeResponse['poolReveal']
    if (roundComplete) {
      const score = updated.placements.filter((p) => p.correct).length
      const completedAt = new Date()
      await results.updateOne(
        { _id: updated._id },
        { $set: { roundComplete: true, score, completedAt } }
      )
      ruleText = await resolveRuleText(puzzle)
      poolReveal = await buildPool(puzzle, { ...updated, roundComplete: true, score, completedAt })
    }

    const response: CheckSwipeResponse = {
      correct,
      trueLabel: guest.trueLabel,
      livesRemaining: updated.livesRemaining,
      roundComplete,
      ruleText,
      poolReveal,
    }
    return jsonResponse(response)
  },
}
