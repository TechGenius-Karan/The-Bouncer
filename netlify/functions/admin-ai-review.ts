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
import { buildReviewMenus } from '../../content-engine/generator/aiReviewMenu'
import { buildWordBank } from '../../content-engine/words/wordBank'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminAiReviewRequest, AdminAiReviewResponse } from './_shared/adminApi'
import { getAiReviewDecision } from './_shared/aiReview'
import { resolveFullPuzzleDetail } from './_shared/adminPuzzleDetail'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'
import { writeRuleOverride } from './_shared/ruleOverrides'
import type { AiReviewDoc } from './_shared/types'

// How many real, correctly-sided bank words to offer the AI as a menu for the
// rewrite-puzzle action. IN is generous so skewed rules (e.g. hidden-number,
// where "one"/"ten" words swamp the rarer "six"/"nine" ones) still surface
// enough of the rare words for the AI to build genuine variety from.
const IN_MENU_SIZE = 100
const OUT_MENU_SIZE = 40

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
  const wordBank = buildWordBank()

  // Build the rewrite-puzzle menu of real, correctly-sided words — with the
  // puzzle's own words and anything the reviewer named pinned in, so a direct
  // instruction can actually be carried out. See aiReviewMenu.ts.
  const rule = RULES.find((r) => r.id === doc.ruleId)
  const { inWordMenu, outWordMenu, pinnedNamed, requestedMissing } = rule
    ? buildReviewMenus(
        rule,
        wordBank,
        trimmedReason,
        [...doc.clues.map((c) => c.wordId), ...doc.guests.map((g) => g.wordId)],
        { in: IN_MENU_SIZE, out: OUT_MENU_SIZE }
      )
    : { inWordMenu: [], outWordMenu: [], pinnedNamed: [], requestedMissing: [] }

  const { decision, rawResponse } = await getAiReviewDecision({
    puzzle: detail,
    reason: trimmedReason,
    inWordMenu,
    outWordMenu,
    pinnedNamed,
    requestedMissing,
  })

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
    wordBank
  )

  // Apply any taxonomy-level recalibration first — independent of what
  // happens to the puzzle instance itself.
  if (plan.ruleOverride) {
    await writeRuleOverride(plan.ruleOverride.ruleId, {
      subtletyOverride: plan.ruleOverride.subtletyOverride,
    })
  }

  // Refine never destroys a puzzle. The reviewer has a separate Reject button
  // and already decided this one is worth saving, so a refinement that can't
  // be applied leaves the puzzle exactly as it was, in the queue, with the
  // rationale explaining what went wrong. (Previously this rejected it, which
  // meant asking for a fix could silently lose the puzzle.)
  const changed = plan.puzzleMutation.kind === 'update-content'
  if (plan.puzzleMutation.kind === 'update-content') {
    const { revealRuleId } = plan.puzzleMutation
    await puzzles.updateOne(
      { _id: doc._id },
      {
        $set: {
          clues: plan.puzzleMutation.clues,
          guests: plan.puzzleMutation.guests,
          liveDecoys: plan.puzzleMutation.liveDecoys,
          ...(revealRuleId ? { revealRuleId } : {}),
        },
        // Unset rather than skip: the rewritten board may no longer collide
        // with whatever set the previous override, and leaving it would reveal
        // a rule that no longer describes the puzzle.
        ...(revealRuleId ? {} : { $unset: { revealRuleId: '' } }),
      }
    )
  }

  const reviewDoc: AiReviewDoc = {
    puzzleId,
    ruleId: doc.ruleId,
    reviewerReason: trimmedReason,
    aiAction: decision.action,
    aiRationale: decision.rationale,
    aiRawResponse: rawResponse,
    resultingPuzzleId: changed ? puzzleId : null,
    createdAt: new Date(),
    humanOutcome: null,
  }
  await aiReviews.insertOne(reviewDoc)

  // Say so when the board isn't exactly what the AI proposed, rather than
  // letting a silent swap look like the AI having ignored the reviewer.
  const altered =
    plan.puzzleMutation.kind === 'update-content' && plan.puzzleMutation.alteredByValidator
  const response: AdminAiReviewResponse = {
    ok: true,
    action: decision.action,
    rationale: altered
      ? `${decision.rationale} (One pool word was then swapped by the validator to keep the puzzle solvable.)`
      : decision.rationale,
    changed,
  }
  return jsonResponse(response)
}
