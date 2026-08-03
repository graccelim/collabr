import { describe, it, expect } from 'vitest'
import { clientIpFromHeaders } from '@/lib/rate-limit'

function headersFrom(record: Record<string, string>) {
  return { get: (name: string) => record[name.toLowerCase()] ?? null }
}

describe('clientIpFromHeaders', () => {
  it('prefers x-forwarded-for, taking the first hop', () => {
    expect(clientIpFromHeaders(headersFrom({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when no x-forwarded-for', () => {
    expect(clientIpFromHeaders(headersFrom({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('falls back to "unknown" when neither header is present', () => {
    expect(clientIpFromHeaders(headersFrom({}))).toBe('unknown')
  })

  it('works with a real Headers instance (what next/headers() returns)', () => {
    const h = new Headers({ 'x-forwarded-for': '10.0.0.1' })
    expect(clientIpFromHeaders(h)).toBe('10.0.0.1')
  })
})
