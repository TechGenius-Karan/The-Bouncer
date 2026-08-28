// Manually schedules one approved-and-unscheduled puzzle onto a specific
// calendar date, picked by a reviewer in the admin UI — the hand-picking
// counterpart to content-engine/scripts/schedulePuzzles.ts's automatic
// day-by-day fill.
//
// `number` is a gapless sequence in chronological (date) order — the same
// invariant schedulePuzzles.ts and admin-unschedule.ts both maintain — not
// in the order an admin happens to click "Schedule" in. So scheduling a
// puzzle for a date earlier than something already on the calendar must
// shift every later puzzle's number up by one, the mirror image of
// admin-unschedule.ts's shift-down-by-one on removal. Shifting up walks
// descending by current number (highest first) so no two documents ever
// transiently collide on the same `number` against its unique index —
// admin-unschedule.ts's shift-down walks ascending for the identical reason
// in the opposite direction.

import { ObjectId } from 'mongodb'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminSchedulePuzzleRequest } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { isValidPuzzleDateString, resolvePuzzleDateString } from './_shared/puzzleDate'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminSchedulePuzzleRequest>
  try {
    body = (await req.json()) as Partial<AdminSchedulePuzzleRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId, date } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId) || !date || !isValidPuzzleDateString(date)) {
    return jsonResponse({ error: 'Missing or invalid puzzleId/date' }, 400)
  }

  const today = resolvePuzzleDateString()
  if (date < today) {
    return jsonResponse({ error: 'Date must be today or later' }, 400)
  }

  const { puzzles } = await getCollections()

  const target = await puzzles.findOne({ _id: new ObjectId(puzzleId), status: 'approved', date: null })
  if (!target) {
    return jsonResponse({ error: 'Puzzle not found or not approved-and-unscheduled' }, 409)
  }

  const clash = await puzzles.findOne({ status: { $in: ['scheduled', 'live'] }, date })
  if (clash) {
    return jsonResponse({ error: `${date} is already scheduled` }, 409)
  }

  const countBefore = await puzzles.countDocuments({
    status: { $in: ['scheduled', 'live'] },
    date: { $lt: date },
  })
  const newNumber = countBefore + 1

  const laterPuzzles = await puzzles
    .find({ status: { $in: ['scheduled', 'live'] }, number: { $gte: newNumber } })
    .sort({ number: -1 })
    .toArray()
  for (const p of laterPuzzles) {
    await puzzles.updateOne({ _id: p._id }, { $inc: { number: 1 } })
  }

  const update = await puzzles.updateOne(
    { _id: target._id, status: 'approved', date: null },
    { $set: { status: 'scheduled', date, number: newNumber } },
  )
  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle changed before this could apply — try again' }, 409)
  }

  return jsonResponse({ ok: true })
}
