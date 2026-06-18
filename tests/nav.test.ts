import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/lib/nav'

describe('safeNextPath — post-auth redirect guard (no open redirects)', () => {
  it('allows same-origin absolute paths', () => {
    expect(safeNextPath('/jobs/abc')).toBe('/jobs/abc')
    expect(safeNextPath('/creators/girl-devours')).toBe('/creators/girl-devours')
  })

  it('falls back for absolute URLs and protocol-relative origins', () => {
    expect(safeNextPath('https://evil.com')).toBe('/dashboard')
    expect(safeNextPath('//evil.com')).toBe('/dashboard')
    expect(safeNextPath('/\\evil.com')).toBe('/dashboard')
    expect(safeNextPath('/%2Fevil.com')).toBe('/dashboard')
    expect(safeNextPath('/%5Cevil.com')).toBe('/dashboard')
  })

  it('falls back for empty / non-path input', () => {
    expect(safeNextPath(null)).toBe('/dashboard')
    expect(safeNextPath(undefined)).toBe('/dashboard')
    expect(safeNextPath('')).toBe('/dashboard')
    expect(safeNextPath('jobs/abc')).toBe('/dashboard') // no leading slash
  })

  it('honours a custom fallback', () => {
    expect(safeNextPath(null, '/login')).toBe('/login')
  })
})
