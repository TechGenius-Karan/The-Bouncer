// Hand-editing a pending puzzle, with no AI in the loop.
//
// The refine path asks a model to change a board and then checks its work. This
// is the other half: the reviewer states the board directly and the server
// stores it. It exists because refine is a negotiation — you describe what you
// want, the model interprets it, and something may still be refused — whereas
// most of the time the reviewer already knows the exact edit.
//
// THE ONE RULE THAT IS DIFFERENT HERE: guest labels are taken verbatim from the
// human, never recomputed from `rule.evaluate`. Everywhere else in this codebase
// the rule is the source of truth for IN/OUT and an AI-supplied label is
// discarded (see aiReviewDispatch's validateAuthoredPuzzle). Here the human
// outranks the evaluator — a category tag can be wrong, a rule can be a rough
// approximation of what the puzzle is really about, and the editor can see that
// where the code cannot.
//
// The consequence is that a hand-edited board may no longer match the rule that
// generated it, so this also takes `ruleText`: whoever moves a word across the
// line is expected to write the reveal sentence that makes the board honest.

import { ObjectId } from 'mongodb'
import { buildWordBank } from '../../content-engine/words/wordBank'
import { requireAdmin } from './_shared/adminAuth'
import type { AdminEditPuzzleRequest, AdminEditPuzzleResponse } from './_shared/adminApi'
import { getCollections } from './_shared/db'
import { jsonResponse } from './_shared/respond'
import type { PuzzleClueDoc, PuzzleGuestDoc, Label } from './_shared/types'

interface EditedWord {
  word: string
  label: Label
}

function isEditedWord(value: unknown): value is EditedWord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.word === 'string' && (v.label === 'IN' || v.label === 'OUT')
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  let body: Partial<AdminEditPuzzleRequest>
  try {
    body = (await req.json()) as Partial<AdminEditPuzzleRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { puzzleId, clues, guests, ruleText } = body
  if (!puzzleId || !ObjectId.isValid(puzzleId)) {
    return jsonResponse({ error: 'Missing or invalid puzzleId' }, 400)
  }
  if (!Array.isArray(clues) || !clues.every(isEditedWord)) {
    return jsonResponse({ error: 'clues must be an array of { word, label }' }, 400)
  }
  if (!Array.isArray(guests) || !guests.every(isEditedWord)) {
    return jsonResponse({ error: 'guests must be an array of { word, label }' }, 400)
  }

  const { puzzles } = await getCollections()
  const doc = await puzzles.findOne({ _id: new ObjectId(puzzleId), status: 'pending_approval' })
  if (!doc) {
    return jsonResponse({ error: 'Puzzle not found or no longer pending approval' }, 409)
  }

  // Structural checks only. None of these is a judgement about what a word
  // means — they are the things that make a puzzle playable at all, and the
  // reviewer overriding them would just produce a broken round.
  const normalised = [...clues, ...guests].map((w) => ({ ...w, word: w.word.trim().toLowerCase() }))
  const spellings = normalised.map((w) => w.word)
  const duplicate = spellings.find((w, i) => spellings.indexOf(w) !== i)
  if (duplicate) {
    return jsonResponse({ error: `"${duplicate}" appears more than once` }, 400)
  }

  const bank = new Map(buildWordBank().map((w) => [w.id, w]))
  for (const { word } of normalised) {
    const known = bank.get(word)
    if (!known) return jsonResponse({ error: `"${word}" is not in the word bank` }, 400)
    if (known.safety.blocked) return jsonResponse({ error: `"${word}" is blocked` }, 400)
  }

  const { clueCountIn, clueCountOut, poolSize } = doc.knobValues
  const editedClues = normalised.slice(0, clues.length)
  const editedGuests = normalised.slice(clues.length)
  const inClues = editedClues.filter((c) => c.label === 'IN').length
  const outClues = editedClues.length - inClues
  if (inClues !== clueCountIn || outClues !== clueCountOut) {
    return jsonResponse(
      { error: `clues must be ${clueCountIn} IN and ${clueCountOut} OUT, got ${inClues} and ${outClues}` },
      400
    )
  }
  if (editedGuests.length !== poolSize) {
    return jsonResponse({ error: `pool must have exactly ${poolSize} guests` }, 400)
  }
  // Not a judgement call: an all-one-label pool means every swipe is the same
  // answer, which isn't a puzzle regardless of who decided the labels.
  if (!editedGuests.some((g) => g.label === 'IN') || !editedGuests.some((g) => g.label === 'OUT')) {
    return jsonResponse({ error: 'the pool needs at least one IN and one OUT guest' }, 400)
  }

  const clueDocs: PuzzleClueDoc[] = editedClues.map((c, i) => ({
    wordId: c.word,
    label: c.label,
    displayOrder: i,
  }))
  // Traps are a property of how the generator built the board; once a human has
  // rearranged it, the old flags describe a board that no longer exists.
  const guestDocs: PuzzleGuestDoc[] = editedGuests.map((g, i) => ({
    wordId: g.word,
    trueLabel: g.label,
    displayOrder: i,
    isTrap: false,
    trapType: null,
  }))

  const trimmedRuleText = typeof ruleText === 'string' ? ruleText.trim() : ''
  await puzzles.updateOne(
    { _id: doc._id },
    {
      $set: {
        clues: clueDocs,
        guests: guestDocs,
        // The old decoy list was computed against the generated board.
        liveDecoys: [],
        manuallyEdited: true,
        ...(trimmedRuleText ? { manualRuleText: trimmedRuleText } : {}),
      },
      // Clearing it restores the generated rule's own description as the reveal.
      ...(trimmedRuleText ? {} : { $unset: { manualRuleText: '' } }),
    }
  )

  const response: AdminEditPuzzleResponse = { ok: true, puzzleId }
  return jsonResponse(response)
}
