import { describe, it, expect, vi } from 'vitest'
import { makeSupabaseStub, verifiedUser, jsonRequest } from './helpers/supabase-stub'

let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    ...active.client,
    auth: { ...active.client.auth, signOut: async () => ({ error: null }) },
  }),
  createAdminClient: () => active.client,
}))

// Regression: signout previously redirected with the default 307, which
// preserves POST - the browser re-POSTed /login (a GET-only page) → HTTP 405.
describe('POST /api/auth/signout - redirect method', () => {
  it('redirects to /login with 303 so the browser follows with GET', async () => {
    active = makeSupabaseStub({ user: verifiedUser() })
    const { POST } = await import('@/app/api/auth/signout/route')
    const res = await POST(jsonRequest('POST'))
    expect(res.status).toBe(303) // NOT 307/308 - those would re-POST /login
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    // Origin derived from the request, never a localhost fallback.
    expect(res.headers.get('location')).toContain('test.local')
  })
})
