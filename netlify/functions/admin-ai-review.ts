// ai-feedback-plan.md §7.5: the AI-assisted reject path. A reviewer's
// free-text reasoning goes to the model (aiReview.ts), which picks one
// bounded action; planAiReviewDispatch (pure, tested) turns that into a
// concrete plan reusing the existing repairWord/generateCandidate/rule-
// override machinery, and this thin wrapper is the only part that touches
// Mongo. Every branch logs one AiReviewDoc for audit + few-shot growth (§5),
// and nothing here can approve or schedule a puzzle — the strongest outcome
// is "content updated, still pending a second human look" (§9).

import { ObjectId } from 'mongodb'
import { RULES } from '../../content-engine/rules'
import { planAiReviewDispatch } from '../../content-engine/generator/aiReviewDispatch'
import { buildWordBank } from '../../content-engine/words/wordBank'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminAiReviewRequest, AdminAiReviewResponse } from './_shared/adminApi'
import { getAiReviewDecision } from './_shared/aiReview'
import { resolveFullPuzzleDetail } from './_shared/adminPuzzleDetail'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'
import { writeRuleOverride } from './_shared/ruleOverrides'
import type { AiReviewDoc } from './_shared/types'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminAiReviewRequest>
  try {
    body = (await req.json()) as Partial<AdminAiReviewRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId, reason } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId) || !reason?.trim()) {
    return jsonResponse({ error: 'Missing or invalid puzzleId/reason' }, 400)
  }
  const trimmedReason = reason.trim()

  const { puzzles, aiReviews } = await getCollections()
  const doc = await puzzles.findOne({ _id: new ObjectId(puzzleId), status: 'pending_approval' })
  if (!doc) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  const detail = await resolveFullPuzzleDetail(doc)
  const { decision, rawResponse } = await getAiReviewDecision({ puzzle: detail, reason: trimmedReason })

  const plan = planAiReviewDispatch(
    decision,
    {
      ruleId: doc.ruleId,
      difficultyTier: doc.difficultyTier,
      knobValues: doc.knobValues,
      clues: doc.clues,
      guests: doc.guests,
    },
    RULES,
    buildWordBank()
  )

  // Apply any taxonomy-level override first (retire / recalibrate) — this is
  // independent of what happens to the puzzle instance itself.
  if (plan.ruleOverride) {
    await writeRuleOverride(plan.ruleOverride.ruleId, {
      disabled: plan.ruleOverride.disabled,
      subtletyOverride: plan.ruleOverride.subtletyOverride,
    })
  }

  if (plan.puzzleMutation.kind === 'update-content') {
    await puzzles.updateOne(
      { _id: doc._id },
      {
        $set: {
          clues: plan.puzzleMutation.clues,
          guests: plan.puzzleMutation.guests,
          liveDecoys: plan.puzzleMutation.liveDecoys,
        },
      }
    )
  } else {
    await puzzles.updateOne(
      { _id: doc._id, status: 'pending_approval' },
      { $set: { status: 'rejected', rejectionReason: trimmedReason } }
    )
  }

  const reviewDoc: AiReviewDoc = {
    puzzleId,
    ruleId: doc.ruleId,
    reviewerReason: trimmedReason,
    aiAction: decision.action,
    aiRationale: decision.rationale,
    aiRawResponse: rawResponse,
    resultingPuzzleId: plan.stillPending ? puzzleId : null,
    createdAt: new Date(),
    humanOutcome: null,
  }
  await aiReviews.insertOne(reviewDoc)

  const response: AdminAiReviewResponse = {
    ok: true,
    action: decision.action,
    rationale: decision.rationale,
    stillPending: plan.stillPending,
  }
  return jsonResponse(response)
}
