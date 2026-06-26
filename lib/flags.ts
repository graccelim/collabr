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

export const flags = {
  /** Master switch — analytics/Creator Pro/Connected/AI ecosystem. */
  analyticsSuite: ANALYTICS_SUITE,
  /** Collabr Certified 🛡️ badge + brand-facing filter. Independent of the suite. */
  collabrCertified: process.env.NEXT_PUBLIC_COLLABR_CERTIFIED === 'true',
  /** Creator Pro 💎 subscription. Subordinate to the suite. */
  creatorPro: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_CREATOR_PRO === 'true',
  /** ⭐ Connected Creator badge + connect-accounts UI. Subordinate. */
  connectedCreator: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_CONNECTED_CREATOR === 'true',
  /** Creator Studio surfaces. Subordinate. */
  creatorStudio: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_CREATOR_STUDIO === 'true',
  /** All analytics AI: per-platform analyst's read, Content Lab, collaboration
   *  analysis, weekly reports, campaign recap. Subordinate to the suite. */
  analyticsAi: ANALYTICS_SUITE && process.env.NEXT_PUBLIC_ANALYTICS_AI === 'true',
} as const

export type FeatureFlag = keyof typeof flags
