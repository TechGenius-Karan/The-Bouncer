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
import { ruleHolderFilter } from './_shared/visual'

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
  const id = new ObjectId(puzzleId)

  // planning-visual-pivot.md §3.5: a visual rule runs once ever, and this check
  // is the hard guarantee. ponytail: check-then-write, so two approvals racing
  // could both pass; there is one reviewer. A unique partial index on ruleId
  // closes it if that changes.
  const target = await puzzles.findOne({ _id: id }, { projection: { kind: 1, ruleId: 1 } })
  if (target?.kind === 'visual') {
    const holder = await puzzles.findOne(ruleHolderFilter(target.ruleId, id), {
      projection: { number: 1, status: 1 },
    })
    if (holder) {
      const name = holder.number ? `#${holder.number}` : holder._id.toString()
      return jsonResponse(
        {
          error: `Rule ${target.ruleId} already belongs to puzzle ${name} (${holder.status}). A visual rule runs once ever: reject this one.`,
        },
        409
      )
    }
  }

  const update = await puzzles.updateOne(
    { _id: id, status: 'pending_approval' },
    { $set: { status: 'approved' } },
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  return jsonResponse({ ok: true })
}
