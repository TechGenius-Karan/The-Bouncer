// Vercel's Hobby plan caps a deployment at 12 Serverless Functions
// (errorCode "exceeded_serverless_functions_per_deployment"); this project
// has 22 route files, so the 14 admin-*.ts endpoints are consolidated into
// this one dispatcher instead of upgrading to a paid plan. Each handler
// below is otherwise unchanged from its original admin-<name>.ts file —
// vercel.json rewrites the original `/api/admin-<name>` paths to
// `/api/admin?action=<name>` so the frontend (src/admin/adminClient.ts)
// needed no changes at all.

import { ObjectId } from 'mongodb'
import { generateBatchCore } from '../content-engine/generator/batch'
import { planAiReviewDispatch } from '../content-engine/generator/aiReviewDispatch'
import { buildReviewMenus } from '../content-engine/generator/aiReviewMenu'
import { buildWordBank } from '../content-engine/words/wordBank'
import { RULES } from '../content-engine/rules'
import { applyRuleOverrides } from '../content-engine/rules/ruleOverrides'
import { requireAdmin } from '../lib/adminAuth'
import type {
  AdminAiReviewRequest,
  AdminAiReviewResponse,
  AdminApproveRequest,
  AdminBatchStatsResponse,
  AdminBufferHealthResponse,
  AdminGenerateBatchRequest,
  AdminListApprovedResponse,
  AdminListPendingResponse,
  AdminListScheduledResponse,
  AdminPuzzleStatsResponse,
  AdminRejectRequest,
  AdminSchedulePuzzleRequest,
  AdminScheduledPuzzle,
  AdminUnapproveRequest,
  AdminUnscheduleRequest,
} from '../lib/adminApi'
import { resolveFullPuzzleDetail } from '../lib/adminPuzzleDetail'
import { getAiReviewDecision } from '../lib/aiReview'
import { getCollections } from '../lib/db'
import { isValidPuzzleDateString, resolvePuzzleDateString } from '../lib/puzzleDate'
import { resolveBatchStats, resolveBufferHealth, resolvePuzzleStats } from '../lib/puzzleStats'
import { resolveRejectCounts } from '../lib/rejectStats'
import { jsonResponse } from '../lib/respond'
import { resolveRuleOverrides, writeRuleOverride } from '../lib/ruleOverrides'
import { resolveRecentRuleUsage } from '../lib/ruleUsage'
import type { AiReviewDoc, PuzzleDoc } from '../lib/types'

// How many real, correctly-sided bank words to offer the AI as a menu for the
// rewrite-puzzle action. IN is generous so skewed rules (e.g. hidden-number,
// where "one"/"ten" words swamp the rarer "six"/"nine" ones) still surface
// enough of the rare words for the AI to build genuine variety from.
const IN_MENU_SIZE = 100
const OUT_MENU_SIZE = 40
const MAX_BATCH_STATS_RANGE = 200
const MAX_GENERATE_COUNT = 20

// Phase 6: validates the access code the reviewer just typed, so the UI can
// give immediate "wrong code" feedback. There's no session-token layer —
// the browser already holds the code itself and resends it as
// x-admin-token on every later admin call, this endpoint just confirms it
// upfront.
async function handleLogin(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }
  return jsonResponse({ ok: true })
}

// Phase 6: the pending_approval queue, full detail — everything a player
// must never see (true labels, trap flags, the rule, live decoys, knob
// values), per planning.md §9.1's reviewer checklist.
async function handleListPending(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  const { puzzles } = await getCollections()
  // Pending puzzles have no `number` yet (only assigned at schedule time),
  // so sort by generation order instead.
  const pending = await puzzles
    .find({ status: 'pending_approval' })
    .sort({ createdAt: 1 })
    .toArray()
  const detail = await Promise.all(pending.map((p) => resolveFullPuzzleDetail(p)))

  const response: AdminListPendingResponse = { puzzles: detail }
  return jsonResponse(response)
}

// Phase 6: Approve is deliberately single-purpose — it only transitions a
// puzzle to "approved". It intentionally does NOT assign a date; the
// existing, unmodified schedulePuzzles.ts script is what makes approved
// puzzles servable, matching planning.md §9's locked four-stage pipeline
// (generate -> validate -> human-approve -> schedule) rather than
// collapsing the last two stages into this one action.
async function handleApprove(req: Request): Promise<Response> {
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
    { $set: { status: 'approved' } }
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  return jsonResponse({ ok: true })
}

// Phase 6: rejects a candidate with a reason, keeping the document (not
// deleting it) so the reason persists for future generator tuning
// (planning.md §9.3) — a rejected puzzle is excluded from every existing
// query (pending-queue, schedulePuzzles.ts, get-round.ts) automatically,
// since each already filters to its own specific status.
async function handleReject(req: Request): Promise<Response> {
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
    { $set: { status: 'rejected', rejectionReason: reason.trim() } }
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  return jsonResponse({ ok: true })
}

// ai-feedback-plan.md §7.5: the AI-assisted reject path. A reviewer's
// free-text reasoning goes to the model (aiReview.ts), which picks one
// bounded action; planAiReviewDispatch (pure, tested) turns that into a
// concrete plan reusing the existing repairWord/generateCandidate/rule-
// override machinery, and this thin wrapper is the only part that touches
// Mongo. Every branch logs one AiReviewDoc for audit + few-shot growth (§5),
// and nothing here can approve or schedule a puzzle — the strongest outcome
// is "content updated, still pending a second human look" (§9).
async function handleAiReview(req: Request): Promise<Response> {
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

// Phase 10.5: the upcoming schedule, full detail — same reviewer-only depth
// as admin-list-pending.ts, so a mistake can be spotted without switching
// screens. Includes today's puzzle (read-only) alongside future ones so the
// admin sees the whole picture; only future rows are ever unschedulable
// (see handleUnschedule) since nothing in this codebase ever flips a
// puzzle's status to 'live' — today's puzzle is just a 'scheduled' puzzle
// whose date happens to match.
async function handleListScheduled(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  const today = resolvePuzzleDateString()
  const { puzzles } = await getCollections()
  const scheduled = await puzzles
    .find({ status: { $in: ['scheduled', 'live'] }, date: { $gte: today } })
    .sort({ date: 1 })
    .toArray()

  const detail: AdminScheduledPuzzle[] = await Promise.all(
    scheduled.map(async (p) => ({
      ...(await resolveFullPuzzleDetail(p)),
      date: p.date!,
      // Safe: this query is scoped to scheduled/live puzzles, which always have a real number.
      number: p.number!,
    }))
  )

  const response: AdminListScheduledResponse = { today, puzzles: detail }
  return jsonResponse(response)
}

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
async function handleUnschedule(req: Request): Promise<Response> {
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
    { $set: { status: 'pending_approval', date: null, number: null } }
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

// Approved-but-unscheduled queue, full detail — same reviewer depth as
// handleListPending/handleListScheduled, so a mistake can be spotted
// before a date is picked. Sorted FIFO by generation time, matching the
// order content-engine/scripts/schedulePuzzles.ts already consumes this
// same queue in.
async function handleListApproved(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  const { puzzles } = await getCollections()
  const approved = await puzzles
    .find({ status: 'approved', date: null })
    .sort({ createdAt: 1 })
    .toArray()
  const detail = await Promise.all(approved.map((p) => resolveFullPuzzleDetail(p)))

  const response: AdminListApprovedResponse = { puzzles: detail }
  return jsonResponse(response)
}

// Manually schedules one approved-and-unscheduled puzzle onto a specific
// calendar date, picked by a reviewer in the admin UI — the hand-picking
// counterpart to content-engine/scripts/schedulePuzzles.ts's automatic
// day-by-day fill.
//
// `number` is a gapless sequence in chronological (date) order — the same
// invariant schedulePuzzles.ts and handleUnschedule both maintain — not
// in the order an admin happens to click "Schedule" in. So scheduling a
// puzzle for a date earlier than something already on the calendar must
// shift every later puzzle's number up by one, the mirror image of
// handleUnschedule's shift-down-by-one on removal. Shifting up walks
// descending by current number (highest first) so no two documents ever
// transiently collide on the same `number` against its unique index —
// handleUnschedule's shift-down walks ascending for the identical reason
// in the opposite direction.
async function handleSchedulePuzzle(req: Request): Promise<Response> {
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

  const target = await puzzles.findOne({
    _id: new ObjectId(puzzleId),
    status: 'approved',
    date: null,
  })
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
    { $set: { status: 'scheduled', date, number: newNumber } }
  )
  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle changed before this could apply — try again' }, 409)
  }

  return jsonResponse({ ok: true })
}

// Sends an approved-but-unscheduled puzzle back to the review queue. Unlike
// handleUnschedule, there's no date/number to unwind here — a puzzle in
// this state never had either assigned yet (schedulePuzzles.ts and
// handleSchedulePuzzle are the only two places that ever set them).
async function handleUnapprove(req: Request): Promise<Response> {
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
    { $set: { status: 'pending_approval' } }
  )

  if (update.matchedCount === 0) {
    return jsonResponse({ error: 'Puzzle not found or already scheduled' }, 409)
  }

  return jsonResponse({ ok: true })
}

// Phase 8: surfaces resolveBufferHealth() to the admin tool — the numbers
// behind planning.md §9.2's "never let the buffer run to zero" requirement,
// previously only checkable by hand-counting documents in Mongo.
async function handleBufferHealth(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const response: AdminBufferHealthResponse = await resolveBufferHealth()
  return jsonResponse(response)
}

// Phase 8: the first admin view of anything beyond the pending-approval
// queue — live/scheduled puzzle numbers (average score, per-guest miss
// rate) per planning.md §9.3, scoped to word-level attribution only (see
// puzzleStats.ts for why rule-level attribution is a deliberate follow-up).
//
// Looked up by puzzle `number`, not `_id` — the admin tool only ever shows
// reviewers the human-readable number (e.g. "#42"), never the underlying
// ObjectId, so that's the only identifier a reviewer can actually type in.
async function handlePuzzleStats(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const url = new URL(req.url)
  const numberParam = url.searchParams.get('number')
  const number = numberParam ? Number(numberParam) : NaN
  if (!numberParam || !Number.isInteger(number) || number < 1) {
    return jsonResponse({ error: 'Missing or invalid number' }, 400)
  }

  const { puzzles } = await getCollections()
  const puzzle = await puzzles.findOne({ number })
  if (!puzzle) {
    return jsonResponse({ error: 'Puzzle not found' }, 404)
  }

  const response: AdminPuzzleStatsResponse = await resolvePuzzleStats(puzzle)
  return jsonResponse(response)
}

// Phase 10 (build-plan.md): a playtesting batch's score picture at a
// glance — GET ?from=&to= over a contiguous puzzle-number range, instead of
// looking up one puzzle at a time. `number` is assigned in real schedule
// order (schedulePuzzles.ts), so "#from-#to" means "puzzles from-to in
// actual play order," not generation-batch order.
async function handleBatchStats(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from'))
  const to = Number(url.searchParams.get('to'))

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return jsonResponse({ error: 'Missing or invalid from/to' }, 400)
  }
  if (to - from + 1 > MAX_BATCH_STATS_RANGE) {
    return jsonResponse({ error: `Range too large (max ${MAX_BATCH_STATS_RANGE} puzzles)` }, 400)
  }

  const response: AdminBatchStatsResponse = await resolveBatchStats(from, to)
  return jsonResponse(response)
}

// Phase 10.5-adjacent: lets an admin trigger on-demand generation from the
// review screen itself, rather than only via the manual `content:queue-puzzles`
// CLI script or waiting on the nightly `scheduled-generate-puzzles.ts` cron.
// Generation logic mirrors that cron function exactly (same
// generateBatchCore call, same PuzzleDoc shape, same `number = existingCount
// + i + 1` numbering) — the only real difference is this endpoint is
// requireAdmin-gated and invocable on demand, since (unlike the cron
// function) it has a real HTTP path a browser can call.
async function handleGenerateBatch(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminGenerateBatchRequest>
  try {
    body = (await req.json()) as Partial<AdminGenerateBatchRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const count = Number(body.count)
  if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATE_COUNT) {
    return jsonResponse(
      { error: `count must be an integer between 1 and ${MAX_GENERATE_COUNT}` },
      400
    )
  }
  const tiers: ('medium' | 'spicy')[] =
    body.tiers && body.tiers.length > 0 ? body.tiers : ['medium', 'spicy']

  const { puzzles } = await getCollections()
  const [rejectCounts, ruleOverrides, recentUsage] = await Promise.all([
    resolveRejectCounts(),
    resolveRuleOverrides(),
    resolveRecentRuleUsage(),
  ])
  const effectiveRules = applyRuleOverrides(RULES, ruleOverrides)
  const batch = generateBatchCore(count, tiers, rejectCounts, effectiveRules, recentUsage.ruleIds)

  const newDocs: PuzzleDoc[] = batch.map((candidate) => ({
    // Left null — only assigned once actually scheduled, see schedulePuzzles.ts.
    number: null,
    difficultyTier: candidate.difficultyTier,
    ruleId: candidate.ruleId,
    ...(candidate.templateId ? { templateId: candidate.templateId } : {}),
    ...(candidate.revealRuleId ? { revealRuleId: candidate.revealRuleId } : {}),
    status: 'pending_approval',
    date: null,
    clues: candidate.clues,
    guests: candidate.guests,
    liveDecoys: candidate.liveDecoys,
    knobValues: candidate.knobValues,
    createdAt: new Date(),
  }))

  if (newDocs.length > 0) {
    await puzzles.insertMany(newDocs)
  }

  return jsonResponse({ ok: true, requested: count, generated: newDocs.length })
}

const handlers: Record<string, (req: Request) => Promise<Response>> = {
  login: handleLogin,
  'list-pending': handleListPending,
  approve: handleApprove,
  reject: handleReject,
  'ai-review': handleAiReview,
  'list-scheduled': handleListScheduled,
  unschedule: handleUnschedule,
  'list-approved': handleListApproved,
  'schedule-puzzle': handleSchedulePuzzle,
  unapprove: handleUnapprove,
  'buffer-health': handleBufferHealth,
  'puzzle-stats': handlePuzzleStats,
  'batch-stats': handleBatchStats,
  'generate-batch': handleGenerateBatch,
}

export default {
  fetch: async (req: Request): Promise<Response> => {
    const action = new URL(req.url).searchParams.get('action')
    const handler = action ? handlers[action] : undefined
    if (!handler) {
      return jsonResponse({ error: 'Unknown admin action' }, 404)
    }
    return handler(req)
  },
}
