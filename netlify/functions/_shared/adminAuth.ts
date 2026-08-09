import { createHash, timingSafeEqual } from 'node:crypto'

// Phase 6: the admin tool's only gate is a single shared access code (no
// user accounts exist anywhere in this project). Both sides are hashed to
// a fixed 32 bytes before comparing — sidesteps timingSafeEqual's
// same-length requirement (a raw client-supplied header trivially won't
// match the secret's length) and removes even the theoretical timing
// signal, for the cost of a couple of lines.

function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

export function requireAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_ACCESS_CODE
  if (!expected) return false // fail closed if the gate itself isn't configured

  const provided = req.headers.get('x-admin-token')
  if (!provided) return false

  return timingSafeEqual(hash(provided), hash(expected))
}
