// Phase 10.6 item 2: surfaces resolveRuleRejectStats() — which rule ids have
// recent reviewer rejections, and which have crossed the threshold worth a
// human looking at the template itself (retire it, narrow its difficulty
// range, or rework it).

import { requireAdmin } from './_shared/adminAuth'
import type { AdminRuleRejectStatsResponse } from './_shared/adminApi'
import { resolveRuleRejectStats } from './_shared/rejectStats'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  if (!requireAdmin(req)) return jsonResponse({ error: 'Invalid access code' }, 401)

  const response: AdminRuleRejectStatsResponse = { rules: await resolveRuleRejectStats() }
  return jsonResponse(response)
}
