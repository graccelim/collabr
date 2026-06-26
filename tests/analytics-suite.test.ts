import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Master kill-switch tests. flags are evaluated at module import from env, so we
// reset modules + set env per case and dynamically import.
const ENV_KEYS = [
  'NEXT_PUBLIC_ANALYTICS_SUITE', 'NEXT_PUBLIC_CREATOR_PRO', 'NEXT_PUBLIC_CONNECTED_CREATOR',
  'NEXT_PUBLIC_CREATOR_STUDIO', 'NEXT_PUBLIC_AI_GROWTH_COACH', 'CRON_SECRET',
  'YOUTUBE_API_KEY', 'META_APP_ID', 'META_APP_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'ANTHROPIC_API_KEY',
]
const saved: Record<string, string | undefined> = {}
beforeEach(() => { for (const k of ENV_KEYS) saved[k] = process.env[k] })
afterEach(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }; vi.resetModules() })

async function loadFlags(suite: string | undefined, granularOn: boolean) {
  vi.resetModules()
  if (suite === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
  else process.env.NEXT_PUBLIC_ANALYTICS_SUITE = suite
  for (const k of ['NEXT_PUBLIC_CREATOR_PRO', 'NEXT_PUBLIC_CONNECTED_CREATOR', 'NEXT_PUBLIC_CREATOR_STUDIO', 'NEXT_PUBLIC_AI_GROWTH_COACH']) {
    process.env[k] = granularOn ? 'true' : 'false'
  }
  return (await import('@/lib/flags')).flags
}

describe('master flag — subordination', () => {
  it('1–4: suite OFF hides Creator Pro / Connected / Studio / AI even when granular flags are ON', async () => {
    const flags = await loadFlags(undefined, true) // suite unset, granular all true
    expect(flags.analyticsSuite).toBe(false)
    expect(flags.creatorPro).toBe(false)
    expect(flags.connectedCreator).toBe(false)
    expect(flags.creatorStudio).toBe(false)
    expect(flags.aiGrowthCoach).toBe(false)
  })

  it('suite OFF explicitly "false" also overrides', async () => {
    const flags = await loadFlags('false', true)
    expect(flags.creatorPro).toBe(false)
    expect(flags.aiGrowthCoach).toBe(false)
  })

  it('7: suite ON lets the granular flags control their surfaces', async () => {
    const on = await loadFlags('true', true)
    expect(on.creatorPro).toBe(true)
    expect(on.connectedCreator).toBe(true)
    expect(on.creatorStudio).toBe(true)
    expect(on.aiGrowthCoach).toBe(true)
    const off = await loadFlags('true', false) // suite on, granular off
    expect(off.creatorPro).toBe(false)
    expect(off.aiGrowthCoach).toBe(false)
  })

  it('Collabr Certified is independent of the suite', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
    process.env.NEXT_PUBLIC_COLLABR_CERTIFIED = 'true'
    const { flags } = await import('@/lib/flags')
    expect(flags.analyticsSuite).toBe(false)
    expect(flags.collabrCertified).toBe(true)
  })
})

describe('master flag — backend fail-safe', () => {
  it('4 & 8: oauth start route returns 404 when suite OFF (no platform call possible)', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
    process.env.NEXT_PUBLIC_CONNECTED_CREATOR = 'true'
    const { GET } = await import('@/app/api/connected/oauth/[platform]/start/route')
    const req = new Request('https://x/api/connected/oauth/tiktok/start')
    const res = await GET(req as any, { params: { platform: 'tiktok' } })
    expect(res.status).toBe(404)
  })

  it('5 & 8: sync-connected cron no-ops when suite OFF (no Phyllo)', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
    process.env.CRON_SECRET = 'test-secret'
    const { GET } = await import('@/app/api/cron/sync-connected/route')
    const req = new Request('https://x/api/cron/sync-connected', { headers: { authorization: 'Bearer test-secret' } })
    const res = await GET(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.note).toMatch(/suite off/i)
    expect(body.synced).toBe(0)
  })

  it('5: ai-reports cron no-ops when suite OFF (no Anthropic)', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
    process.env.CRON_SECRET = 'test-secret'
    const { GET } = await import('@/app/api/cron/ai-reports/route')
    const req = new Request('https://x/api/cron/ai-reports', { headers: { authorization: 'Bearer test-secret' } })
    const res = await GET(req as any)
    const body = await res.json()
    expect(body.note).toMatch(/suite off/i)
    expect(body.generated).toBe(0)
  })

  it('8 & 9: provider factories refuse even when credentials ARE present (suite OFF)', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
    process.env.YOUTUBE_API_KEY = 'k'
    process.env.META_APP_ID = 'id'; process.env.META_APP_SECRET = 'sec'
    process.env.TIKTOK_CLIENT_KEY = 'k'; process.env.TIKTOK_CLIENT_SECRET = 'sec'
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    const { getAdapter, analyticsConfigured } = await import('@/lib/analytics/adapters')
    expect(getAdapter('youtube')).toBeNull()   // no adapter despite creds
    expect(getAdapter('tiktok')).toBeNull()
    expect(analyticsConfigured()).toBe(false)
    const { aiConfigured, getAnthropic } = await import('@/lib/ai/client')
    expect(aiConfigured()).toBe(false)         // no AI despite key
    expect(() => getAnthropic()).toThrow()     // Anthropic client cannot be constructed
  })

  it('rollups cron no-ops when suite OFF', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ANALYTICS_SUITE
    process.env.CRON_SECRET = 'test-secret'
    const { GET } = await import('@/app/api/cron/rollups/route')
    const req = new Request('https://x/api/cron/rollups', { headers: { authorization: 'Bearer test-secret' } })
    const res = await GET(req as any)
    const body = await res.json()
    expect(body.note).toMatch(/suite off/i)
  })
})
