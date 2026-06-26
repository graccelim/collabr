import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

// Creator commission (charged to the creator, never the brand). The single
// source of truth is computeFee() in lib/utils.ts; this mirrors it for any
// display use. Creator Free 10% / Creator Pro 8%.
export const COMMISSION_RATES = { free: 0.1, pro: 0.08 } as const

// ── Brand Pro / Brand Plus (subscription) price configuration ───────────────
// Canonical env names. STRIPE_PRO_PRICE_ID is the legacy fallback for Brand Pro
// monthly so existing setups keep working. Brand Plus has no code-wired tier yet
// (see roadmap) — these IDs are read once the tier ships.
export function brandProPriceIds() {
  return {
    monthly: process.env.STRIPE_BRAND_PRO_PRICE_MONTHLY || process.env.STRIPE_PRO_PRICE_ID || null,
    annual: process.env.STRIPE_BRAND_PRO_PRICE_ANNUAL || null,
  }
}
export function brandPlusPriceIds() {
  return {
    monthly: process.env.STRIPE_BRAND_PLUS_PRICE_MONTHLY || null,
    annual: process.env.STRIPE_BRAND_PLUS_PRICE_ANNUAL || null,
  }
}

// Beta-only 50%-off Plus prices (used while BETA_FREE_PRO is on). Optional —
// the checkout falls back to the full-price IDs when these aren't configured.
export function brandPlusBetaPriceIds() {
  return {
    monthly: process.env.STRIPE_BRAND_PLUS_BETA_PRICE_MONTHLY || null,
    annual: process.env.STRIPE_BRAND_PLUS_BETA_PRICE_ANNUAL || null,
  }
}

// ── Creator Boost (paid placement) configuration ────────────────────────────
// Boost is a PAID feature. It is enabled only when Stripe is wired AND at least
// one boost Price ID is configured. When disabled, the Boost UI is hidden and
// the ranking bump is not applied (see lib/discovery-data.ts).
export const BOOST_DAYS = { monthly: 30, per_app: 7 } as const
// A boost can be extended by repeated purchases, but never beyond this horizon
// so stacking can't push someone to the top indefinitely.
export const BOOST_MAX_HORIZON_DAYS = 120

export function boostPriceIds() {
  return {
    monthly: process.env.STRIPE_BOOST_PRICE_MONTHLY || null,
    per_app: process.env.STRIPE_BOOST_PRICE_PER_APP || null,
  }
}

export function boostEnabled(): boolean {
  const ids = boostPriceIds()
  return Boolean(process.env.STRIPE_SECRET_KEY && (ids.monthly || ids.per_app))
}

// ── Developer-only UI preview ───────────────────────────────────────────────
// BOOST_UI_PREVIEW=true renders the Boost hint + /boost page WITHOUT real Stripe
// prices, so the UI can be designed before products exist. It is visual-only:
// no Checkout session is created, and the ranking bump / "Boosted" badge / the
// purchase API all stay on boostEnabled() (real config). Off unless the env var
// is explicitly "true", so production is unchanged unless deliberately enabled.
export function boostPreview(): boolean {
  return process.env.BOOST_UI_PREVIEW === 'true'
}

/** Should the Boost UI surfaces (hint + /boost page) render? Real config OR preview. */
export function boostUiEnabled(): boolean {
  return boostEnabled() || boostPreview()
}

// ── Creator Pro (subscription) configuration ────────────────────────────────
// Mirrors the Boost pattern: enabled only when Stripe is wired AND a Creator Pro
// Price ID exists. Create the Price(s) in the Stripe dashboard, then set the env
// vars. Until then the upgrade card can render in preview (visual-only) but no
// Checkout session is created.
export function creatorProPriceIds() {
  return {
    monthly: process.env.STRIPE_CREATOR_PRO_PRICE_MONTHLY || null,
    annual: process.env.STRIPE_CREATOR_PRO_PRICE_ANNUAL || null,
  }
}

export function creatorProEnabled(): boolean {
  const ids = creatorProPriceIds()
  return Boolean(process.env.STRIPE_SECRET_KEY && (ids.monthly || ids.annual))
}

/** Visual-only preview of the Creator Pro upgrade surfaces before prices exist. */
export function creatorProPreview(): boolean {
  return process.env.CREATOR_PRO_UI_PREVIEW === 'true'
}

export function creatorProUiEnabled(): boolean {
  return creatorProEnabled() || creatorProPreview()
}
