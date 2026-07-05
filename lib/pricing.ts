// Display pricing (SGD) — the single source of truth for UI price copy. These are
// DISPLAY ONLY; actual charges come from the Stripe Price IDs. Keep these amounts
// in sync with the prices you create in Stripe.
// Annual = 12 months for the price of 10 (2 months free).
export const CURRENCY = 'S$'

export const PLAN_PRICING = {
  pro: { monthly: 39, annual: 390 },
  plus: { monthly: 59, annual: 590 },
} as const

// Creator Pro subscription (display only — keep in sync with the Stripe prices).
// Annual 149 → ≈ S$12.42/mo (about 2 months free vs S$14.99/mo).
export const CREATOR_PRO_PRICING = { monthly: 14.99, annual: 149 } as const
/** Effective monthly cost when paying annually, formatted (e.g. "12.42" or "12"). */
export function creatorProAnnualPerMonth(): string {
  const v = CREATOR_PRO_PRICING.annual / 12
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}

// Creator profile Boost (one-time). per_app = 7-day, monthly = 30-day.
export const BOOST_PRICING = { per_app: 5, monthly: 20 } as const

// Brand Plus is discounted during beta (launch incentive). Pro is free in beta.
export const BETA_PLUS_PRICING = { monthly: 30, annual: 300 } as const
export function betaPlusPrice(cycle: 'monthly' | 'annual'): number {
  return BETA_PLUS_PRICING[cycle]
}

export type PricedTier = keyof typeof PLAN_PRICING

/** Rounded effective monthly cost when paying annually (for "≈ S$x/mo"). */
export function annualPerMonth(tier: PricedTier): number {
  return Math.round(PLAN_PRICING[tier].annual / 12)
}
