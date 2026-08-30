// Phase 10.6 item 2's "cheap word-level repair path": the minority case
// where a reviewer's objection is genuinely about one specific word (reads
// oddly, a proper name, whatever), not the whole rule/concept. The actual
// repair logic lives in content-engine/generator/repairWord.ts (pure,
// testable); this is just the HTTP/Mongo glue around it, matching the
// house convention of a testable core module plus a thin wrapper.

import { ObjectId } from 'mongodb'
import { RULES } from '../../content-engine/rules'
import { repairWord } from '../../content-engine/generator/repairWord'
import { buildWordBank } from '../../content-engine/words/wordBank'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminRepairWordRequest, AdminRepairWordResponse } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminRepairWordRequest>
  try {
    body = (await req.json()) as Partial<AdminRepairWordRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId, badWordId, reason } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId) || !badWordId || !reason?.trim()) {
    return jsonResponse({ error: 'Missing or invalid puzzleId/badWordId/reason' }, 400)
  }

  const { puzzles } = await getCollections()
  const doc = await puzzles.findOne({ _id: new ObjectId(puzzleId), status: 'pending_approval' })
  if (!doc) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  const wordInPuzzle = doc.clues.some((c) => c.wordId === badWordId) || doc.guests.some((g) => g.wordId === badWordId)
  if (!wordInPuzzle) {
    return jsonResponse({ error: 'badWordId is not part of this puzzle' }, 400)
  }

  const result = repairWord(
    {
      ruleId: doc.ruleId,
      difficultyTier: doc.difficultyTier,
      knobValues: doc.knobValues,
      clues: doc.clues,
      guests: doc.guests,
    },
    badWordId,
    RULES,
    buildWordBank()
  )

  if (result.repaired) {
    await puzzles.updateOne(
      { _id: doc._id },
      {
        $set: {
          clues: result.candidate.clues,
          guests: result.candidate.guests,
          liveDecoys: result.candidate.liveDecoys,
          rejectionReason: reason.trim(),
        },
      }
    )
  } else {
    await puzzles.updateOne(
      { _id: doc._id, status: 'pending_approval' },
      { $set: { status: 'rejected', rejectionReason: reason.trim() } }
    )
  }

  const response: AdminRepairWordResponse = { ok: true, repaired: result.repaired }
  return jsonResponse(response)
}
