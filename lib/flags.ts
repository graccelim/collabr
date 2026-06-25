// Lightweight feature flags (env-driven, no runtime service). A flag stays off
// until its env var is explicitly "true", so unfinished features never surface.
// NEXT_PUBLIC_* so the same value is readable on server and client.

export const flags = {
  /** Collabr Certified 🛡️ badge + brand-facing filter. Phase 1. */
  collabrCertified: process.env.NEXT_PUBLIC_COLLABR_CERTIFIED === 'true',
} as const

export type FeatureFlag = keyof typeof flags
