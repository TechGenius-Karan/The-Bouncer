// Phase 6: rejects a candidate with a reason, keeping the document (not
// deleting it) so the reason persists for future generator tuning
// (planning.md §9.3) — a rejected puzzle is excluded from every existing
// query (pending-queue, schedulePuzzles.ts, get-round.ts) automatically,
// since each already filters to its own specific status.

import { ObjectId } from 'mongodb'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminRejectRequest } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminRejectRequest>
  try {
    body = (await req.json()) as Partial<AdminRejectRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId, reason } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId) || !reason?.trim()) {
    return jsonResponse({ error: 'Missing or invalid puzzleId/reason' }, 400)
  }

  const { puzzles } = await getCollections()
  const update = await puzzles.updateOne(
    { _id: new ObjectId(puzzleId), status: 'pending_approval' },
    { $set: { status: 'rejected', rejectionReason: reason.trim() } },
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  return jsonResponse({ ok: true })
}
