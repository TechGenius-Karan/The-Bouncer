// ai-feedback-plan.md §7.6: the direct, no-AI path for a reviewer to
// retire/reinstate a rule or recalibrate its difficulty. Writes straight to
// the `rules` collection's disabled/subtletyOverride fields, which the
// generator merges in at runtime via content-engine/rules/ruleOverrides.ts
// — no code deploy needed for the change to take effect. Every field is
// independently optional so a caller can toggle just one without touching
// the other.

import { requireAdmin } from './_shared/adminAuth'
import type { AdminRuleOverrideRequest, AdminRuleOverrideResponse } from './_shared/adminApi'
import { writeRuleOverride } from './_shared/ruleOverrides'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }

  let body: Partial<AdminRuleOverrideRequest>
  try {
    body = (await req.json()) as Partial<AdminRuleOverrideRequest>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { ruleId } = body
  if (!ruleId) {
    return jsonResponse({ error: 'Missing ruleId' }, 400)
  }
  if (
    body.subtletyOverride !== undefined &&
    body.subtletyOverride !== null &&
    (!Number.isInteger(body.subtletyOverride) || body.subtletyOverride < 1 || body.subtletyOverride > 5)
  ) {
    return jsonResponse({ error: 'subtletyOverride must be an integer 1-5, or null to clear it' }, 400)
  }

  if (body.disabled === undefined && body.subtletyOverride === undefined) {
    return jsonResponse({ error: 'Nothing to update — pass disabled and/or subtletyOverride' }, 400)
  }

  const matched = await writeRuleOverride(ruleId, {
    disabled: body.disabled,
    subtletyOverride: body.subtletyOverride,
  })
  if (!matched) {
    return jsonResponse({ error: `Unknown ruleId: ${ruleId}` }, 404)
  }

  const response: AdminRuleOverrideResponse = { ok: true }
  return jsonResponse(response)
}
