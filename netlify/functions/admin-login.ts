// Phase 6: validates the access code the reviewer just typed, so the UI can
// give immediate "wrong code" feedback. There's no session-token layer —
// the browser already holds the code itself and resends it as
// x-admin-token on every later admin call, this endpoint just confirms it
// upfront.

import { requireAdmin } from './_shared/adminAuth'
import { jsonResponse } from './_shared/respond'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!requireAdmin(req)) {
    return jsonResponse({ error: 'Invalid access code' }, 401)
  }
  return jsonResponse({ ok: true })
}
