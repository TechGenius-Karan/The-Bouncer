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
//
// Pulling a puzzle also clears its `number` and shifts every later
// scheduled/live puzzle's number down by one, so the visible sequence
// never grows a gap (schedulePuzzles.ts's invariant: numbers are always a
// gapless 1, 2, 3...). This only ever touches numbers for *future*
// puzzles no player has seen yet, since a puzzle can only be pulled if its
// date is still in the future. The shift is a sequential loop in ascending
// order (not one bulk $inc) — Mongo doesn't guarantee per-document
// ordering within a single updateMany, and a bulk decrement could
// transiently collide two documents on the same number against the unique
// index on `number`; doing it ascending one at a time guarantees each step
// frees exactly the slot the next step needs.

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

  const target = await puzzles.findOne({
    _id: new ObjectId(puzzleId),
    status: 'scheduled',
    date: { $gt: today },
  })
  if (!target || target.number === null) {
    return jsonResponse({ error: 'Puzzle not found, not scheduled, or already live today' }, 409)
  }

  const update = await puzzles.updateOne(
    { _id: target._id, status: 'scheduled', date: { $gt: today } },
    { $set: { status: 'pending_approval', date: null, number: null } },
  )
  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found, not scheduled, or already live today' }, 409)
  }

  const laterPuzzles = await puzzles
    .find({ status: { $in: ['scheduled', 'live'] }, number: { $gt: target.number } })
    .sort({ number: 1 })
    .toArray()
  for (const p of laterPuzzles) {
    await puzzles.updateOne({ _id: p._id }, { $inc: { number: -1 } })
  }

  return jsonResponse({ ok: true })
}
