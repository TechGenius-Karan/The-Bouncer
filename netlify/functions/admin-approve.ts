// Phase 6: Approve is deliberately single-purpose — it only transitions a
// puzzle to "approved". It intentionally does NOT assign a date; the
// existing, unmodified schedulePuzzles.ts script is what makes approved
// puzzles servable, matching planning.md §9's locked four-stage pipeline
// (generate -> validate -> human-approve -> schedule) rather than
// collapsing the last two stages into this one action.

import { ObjectId } from 'mongodb'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminApproveRequest } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminApproveRequest>
  try {
    body = (await req.json()) as Partial<AdminApproveRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId)) {
    return jsonResponse({ error: 'Missing or invalid puzzleId' }, 400)
  }

  const { puzzles } = await getCollections()
  const update = await puzzles.updateOne(
    { _id: new ObjectId(puzzleId), status: 'pending_approval' },
    { $set: { status: 'approved' } },
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  return jsonResponse({ ok: true })
}
