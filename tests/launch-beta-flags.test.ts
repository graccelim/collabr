import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// flags.launchBeta and flags.escrowLive are evaluated at module import from
// env (same pattern as the analytics suite master flag), so each case resets
// modules and re-imports fresh.
const ENV_KEYS = ['NEXT_PUBLIC_LAUNCH_BETA', 'NEXT_PUBLIC_ESCROW_LIVE', 'BETA_FREE_PLUS', 'BOOST_UI_PREVIEW', 'STRIPE_SECRET_KEY']
const saved: Record<string, string | undefined> = {}
beforeEach(() => { for (const k of ENV_KEYS) saved[k] = process.env[k] })
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  vi.resetModules()
})

describe('flags.launchBeta', () => {
  it('defaults OFF when unset', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_LAUNCH_BETA
    const { flags } = await import('@/lib/flags')
    expect(flags.launchBeta).toBe(false)
  })

  it('turns on with the literal string "true"', async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_LAUNCH_BETA = 'true'
    const { flags } = await import('@/lib/flags')
    expect(flags.launchBeta).toBe(true)
  })

  it('Brand Plus (isBetaFreePlus) is a real paid feature - launchBeta no longer unlocks it', async () => {
    vi.resetModules()
    delete process.env.BETA_FREE_PLUS
    process.env.NEXT_PUBLIC_LAUNCH_BETA = 'true'
    const { isBetaFreePlus } = await import('@/lib/plans')
    expect(isBetaFreePlus()).toBe(false)
  })

  it('Plus stays gated with launchBeta off and BETA_FREE_PLUS unset', async () => {
    vi.resetModules()
    delete process.env.BETA_FREE_PLUS
    delete process.env.NEXT_PUBLIC_LAUNCH_BETA
    const { isBetaFreePlus } = await import('@/lib/plans')
    expect(isBetaFreePlus()).toBe(false)
  })

  it('an explicit BETA_FREE_PLUS=true still unlocks Plus as a deliberate promo', async () => {
    vi.resetModules()
    process.env.BETA_FREE_PLUS = 'true'
    delete process.env.NEXT_PUBLIC_LAUNCH_BETA
    const { isBetaFreePlus } = await import('@/lib/plans')
    expect(isBetaFreePlus()).toBe(true)
  })

  it('force-hides Boost UI even when Boost preview is otherwise on', async () => {
    vi.resetModules()
    process.env.BOOST_UI_PREVIEW = 'true'
    process.env.NEXT_PUBLIC_LAUNCH_BETA = 'true'
    const { boostUiEnabled } = await import('@/lib/stripe')
    expect(boostUiEnabled()).toBe(false)
  })

  it('Boost preview renders normally when launchBeta is off', async () => {
    vi.resetModules()
    process.env.BOOST_UI_PREVIEW = 'true'
    delete process.env.NEXT_PUBLIC_LAUNCH_BETA
    const { boostUiEnabled } = await import('@/lib/stripe')
    expect(boostUiEnabled()).toBe(true)
  })
})

describe('flags.escrowLive', () => {
  it('defaults ON when unset', async () => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_ESCROW_LIVE
    const { flags } = await import('@/lib/flags')
    expect(flags.escrowLive).toBe(true)
  })

  it('only the literal string "false" turns it off', async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_ESCROW_LIVE = 'false'
    let mod = await import('@/lib/flags')
    expect(mod.flags.escrowLive).toBe(false)

    vi.resetModules()
    process.env.NEXT_PUBLIC_ESCROW_LIVE = 'FALSE' // not the literal - stays on
    mod = await import('@/lib/flags')
    expect(mod.flags.escrowLive).toBe(true)
  })
})
