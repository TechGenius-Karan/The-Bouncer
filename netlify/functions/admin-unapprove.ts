// Sends an approved-but-unscheduled puzzle back to the review queue. Unlike
// admin-unschedule.ts, there's no date/number to unwind here — a puzzle in
// this state never had either assigned yet (schedulePuzzles.ts and
// admin-schedule-puzzle.ts are the only two places that ever set them).

import { ObjectId } from 'mongodb'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminUnapproveRequest } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminUnapproveRequest>
  try {
    body = (await req.json()) as Partial<AdminUnapproveRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId)) {
    return jsonResponse({ error: 'Missing or invalid puzzleId' }, 400)
  }

  const { puzzles } = await getCollections()
  const update = await puzzles.updateOne(
    { _id: new ObjectId(puzzleId), status: 'approved', date: null },
    { $set: { status: 'pending_approval' } },
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or already scheduled' }, 409)
  }

  return jsonResponse({ ok: true })
}
