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
export const CREATOR_PRO_PRICING = { monthly: 15, annual: 149 } as const
export function creatorProAnnualPerMonth(): number {
  return Math.round(CREATOR_PRO_PRICING.annual / 12)
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
