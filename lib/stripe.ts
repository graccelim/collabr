import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export const COMMISSION_RATES = { free: 0.12, pro: 0.08 } as const

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
