// Phase 10.5: pulls a puzzle back out of the schedule without deleting it —
// for when a mistake is spotted after approval. Sends it back to
// 'pending_approval' (full re-review), not 'approved', since a puzzle
// pulled from the schedule usually needs a fresh look, not a silent
// requeue into the next schedulePuzzles.ts run.
//
// The `date: { $gt: today }` clause, not `status: 'scheduled'` alone, is
// what actually blocks pulling today's puzzle — nothing in this codebase
// ever transitions a puzzle's status to 'live', so today's puzzle is
// indistinguishable from a future one by status alone.

import { ObjectId } from 'mongodb'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminUnscheduleRequest } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { resolvePuzzleDateString } from './_shared/puzzleDate'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminUnscheduleRequest>
  try {
    body = (await req.json()) as Partial<AdminUnscheduleRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId)) {
    return jsonResponse({ error: 'Missing or invalid puzzleId' }, 400)
  }

  const today = resolvePuzzleDateString()
  const { puzzles } = await getCollections()
  const update = await puzzles.updateOne(
    { _id: new ObjectId(puzzleId), status: 'scheduled', date: { $gt: today } },
    { $set: { status: 'pending_approval', date: null } },
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found, not scheduled, or already live today' }, 409)
  }

  return jsonResponse({ ok: true })
}
