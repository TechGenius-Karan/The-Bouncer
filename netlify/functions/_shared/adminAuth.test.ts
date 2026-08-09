import { afterEach, describe, expect, it } from 'vitest'
import { requireAdmin } from './adminAuth'

const ORIGINAL_ENV = process.env.ADMIN_ACCESS_CODE

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/admin-list-pending', { headers })
}

describe('requireAdmin', () => {
  afterEach(() => {
    process.env.ADMIN_ACCESS_CODE = ORIGINAL_ENV
  })

  it('passes when the header matches the configured code', () => {
    process.env.ADMIN_ACCESS_CODE = 'let-me-in'
    expect(requireAdmin(makeRequest({ 'x-admin-token': 'let-me-in' }))).toBe(true)
  })

  it('fails when the header does not match', () => {
    process.env.ADMIN_ACCESS_CODE = 'let-me-in'
    expect(requireAdmin(makeRequest({ 'x-admin-token': 'wrong' }))).toBe(false)
  })

  it('fails when no header is provided', () => {
    process.env.ADMIN_ACCESS_CODE = 'let-me-in'
    expect(requireAdmin(makeRequest())).toBe(false)
  })

  it('fails when the header is an empty string, even with a code configured', () => {
    process.env.ADMIN_ACCESS_CODE = 'let-me-in'
    expect(requireAdmin(makeRequest({ 'x-admin-token': '' }))).toBe(false)
  })

  it('fails closed when the env var itself is unset, regardless of what header is sent', () => {
    delete process.env.ADMIN_ACCESS_CODE
    expect(requireAdmin(makeRequest({ 'x-admin-token': '' }))).toBe(false)
    expect(requireAdmin(makeRequest({ 'x-admin-token': 'anything' }))).toBe(false)
    expect(requireAdmin(makeRequest())).toBe(false)
  })
})
