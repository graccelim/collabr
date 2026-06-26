// Display pricing (SGD) — the single source of truth for UI price copy. These are
// DISPLAY ONLY; actual charges come from the Stripe Price IDs. Keep these amounts
// in sync with the prices you create in Stripe.
// Annual = 12 months for the price of 10 (2 months free).
export const CURRENCY = 'S$'

export const PLAN_PRICING = {
  pro: { monthly: 29, annual: 290 },
  plus: { monthly: 79, annual: 790 },
} as const

// Creator Pro subscription (display only — keep in sync with the Stripe prices).
// Annual 150 → S$12.50/mo (2 months free vs S$15/mo).
export const CREATOR_PRO_PRICING = { monthly: 15, annual: 150 } as const
/** Effective monthly cost when paying annually, formatted (e.g. "12.50" or "12"). */
export function creatorProAnnualPerMonth(): string {
  const v = CREATOR_PRO_PRICING.annual / 12
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}

// Creator profile Boost (one-time). per_app = 7-day, monthly = 30-day.
export const BOOST_PRICING = { per_app: 5, monthly: 20 } as const

// Brand Plus is 50% off during beta (launch incentive). Pro is free in beta.
export const BETA_PLUS_DISCOUNT = 0.5
export function betaPlusPrice(cycle: 'monthly' | 'annual'): number {
  return Math.round(PLAN_PRICING.plus[cycle] * BETA_PLUS_DISCOUNT)
}

export type PricedTier = keyof typeof PLAN_PRICING

/** Rounded effective monthly cost when paying annually (for "≈ S$x/mo"). */
export function annualPerMonth(tier: PricedTier): number {
  return Math.round(PLAN_PRICING[tier].annual / 12)
}
