// Lightweight feature flags (env-driven, no runtime service). A flag stays off
// until its env var is explicitly "true", so unfinished features never surface.
// NEXT_PUBLIC_* so the same value is readable on server and client.

// MASTER kill-switch for the entire analytics / Creator Pro / Connected / AI
// ecosystem. When OFF (default), every analytics surface is invisible + every
// analytics route/cron fails safe, restoring the original pre-analytics product.
// All granular analytics flags are SUBORDINATE to it (suite OFF overrides them).
// NOTE: Collabr Certified is NOT part of the suite — it's free Collabr-behaviour
// reputation, controlled independently by its own flag.
const ANALYTICS_SUITE = process.env.NEXT_PUBLIC_ANALYTICS_SUITE === 'true'

// Concierge-beta launch mode - the ONE switch for "hide every paywall/upgrade
// prompt" (Brand Plus/Pro, Creator Pro, Boost). Default OFF so nothing changes
// until deliberately turned on. Subordinate flags below fold this in with
// `&& !LAUNCH_BETA` so flipping it on can never be defeated by a stray
// per-feature env var left set from earlier testing.
const LAUNCH_BETA = process.env.NEXT_PUBLIC_LAUNCH_BETA === 'true'

export const flags = {
  /** Master switch — analytics/Creator Pro/Connected/AI ecosystem. */
  analyticsSuite: ANALYTICS_SUITE,
  /** Collabr Certified 🛡️ badge + brand-facing filter. Independent of the suite. */
  collabrCertified: process.env.NEXT_PUBLIC_COLLABR_CERTIFIED === 'true',
  /** Creator Pro 💎 subscription. Subordinate to the suite; hidden in launch beta. */
  creatorPro: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_CREATOR_PRO === 'true' && !LAUNCH_BETA,
  /** ⭐ Connected Creator badge + connect-accounts UI. Subordinate. */
  connectedCreator: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_CONNECTED_CREATOR === 'true',
  /** Creator Studio surfaces. Subordinate. */
  creatorStudio: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_CREATOR_STUDIO === 'true',
  /** All analytics AI: per-platform analyst's read, Content Lab, collaboration
   *  analysis, weekly reports, campaign recap. Subordinate to the suite. */
  analyticsAi: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_ANALYTICS_AI === 'true',
  /** Concierge beta launch mode. See lib/plans.ts (isBetaFreePlus) and
   *  lib/stripe.ts (boostUiEnabled) for the other two systems this reaches into. */
  launchBeta: LAUNCH_BETA,
  /** Stripe escrow (fund/capture/transfer). Default ON - the audited system is
   *  production-ready; this exists purely as an emergency stop, not a default-off
   *  gate. Set NEXT_PUBLIC_ESCROW_LIVE=false to pause funding without touching
   *  any billing code. */
  escrowLive: process.env.NEXT_PUBLIC_ESCROW_LIVE !== 'false',
} as const

export type FeatureFlag = keyof typeof flags

/**
 * Which landing page renders at "/" - a plain string switch (not part of the
 * boolean `flags` object above) read once at app/page.tsx's one entry point.
 * Defaults to the existing page so nothing changes until deliberately flipped.
 */
export function landingVersion(): 'concierge' | 'current' {
  return process.env.NEXT_PUBLIC_LANDING_VERSION === 'concierge' ? 'concierge' : 'current'
}
