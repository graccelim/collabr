import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Phase 10: single source of truth for plan resolution and feature gating.
//
// BETA MODE - while BETA_FREE_PRO is enabled (the default), every brand
// resolves to Pro ("Pro Beta"): all Pro features work, no Stripe subscription
// is required, and no upgrade prompts are shown.
//
// PAID MODE - setting BETA_FREE_PRO=false activates the paid system with no
// code or data changes: new brands resolve to Free, Pro features gate, and
// the upgrade flow (Stripe Checkout → webhook → plan=pro) unlocks instantly.
// Cancellation keeps access until the paid period ends; grandfathered_pro_until
// grants existing beta users a complimentary window at launch. Downgrades only
// lock functionality - saved creators, invites and history are never deleted.

export type PlanTier = 'free' | 'pro' | 'plus'
export type SubscriptionState = 'beta_free' | 'active' | 'cancelled' | 'past_due'

export interface ResolvedPlan {
  tier: PlanTier
  state: SubscriptionState
  /** Has at least Pro (barter access). True for Pro AND Plus. */
  isPro: boolean
  /** Has Plus — the Creator Discovery product (search, filters, invites, saved). */
  isPlus: boolean
  /** Human label: "Pro Beta" | "Plus Beta" | "Pro" | "Plus" | "Free" */
  label: string
  /** Why this brand has access (drives billing-page copy). */
  proReason: 'beta' | 'subscription' | 'cancelled_until_period_end' | 'grandfathered' | null
}

export interface BrandPlanRow {
  plan?: string | null
  subscription_status?: string | null
  subscription_current_period_end?: string | null
  grandfathered_pro_until?: string | null
}

/** Columns resolvePlan needs - keep brand_profiles selects in sync. */
export const PLAN_COLUMNS = 'plan, subscription_status, subscription_current_period_end, grandfathered_pro_until'

/** Beta defaults ON - only an explicit 'false' activates paid mode. */
export function isBetaFreePro(): boolean {
  return process.env.BETA_FREE_PRO !== 'false'
}

/**
 * Plus (Creator Discovery) is a real paid feature, not part of the free
 * core — posting campaigns, applying, and funding barter/paid collabs
 * (Pro, via isBetaFreePro above) stay free for every brand, but browsing
 * the full creator roster in-app (search, filters, invites, saved
 * creators) requires an actual paid subscription. Set BETA_FREE_PLUS=true
 * only for a deliberate temporary promo — it no longer follows
 * flags.launchBeta, which still separately hides the Boost/Creator Pro
 * paywalls (see lib/stripe.ts, lib/flags.ts) and is unrelated to Plus.
 */
export function isBetaFreePlus(): boolean {
  return process.env.BETA_FREE_PLUS === 'true'
}

/** Pro-tier features (barter). */
export const PRO_FEATURES = ['Unlimited barter campaigns'] as const
/** Plus discovery features — independent of the Analytics Suite. */
export const PLUS_DISCOVERY_FEATURES = [
  'Creator Discovery',
  'Creator Search & Advanced Filters',
  'Creator Invites',
  'Saved Creators',
] as const

function inFuture(iso: string | null | undefined): boolean {
  return Boolean(iso && new Date(iso) > new Date())
}

export function resolvePlan(brand: BrandPlanRow | null): ResolvedPlan {
  const state = (brand?.subscription_status as SubscriptionState) || 'beta_free'
  const planTier = (brand?.plan as PlanTier) || 'free'
  const paidTier = planTier === 'pro' || planTier === 'plus'

  // An ACTIVE paid subscription is honored REGARDLESS of beta — so a brand that
  // actually paid for Plus gets Plus even while Pro is complimentary in beta.
  // (Pro is free in beta + its checkout 409s, so a paid 'pro' here is benign.)
  if (paidTier && (state === 'active' || state === 'past_due')) {
    return {
      tier: planTier, state, isPro: true, isPlus: planTier === 'plus',
      label: planTier === 'plus' ? 'Plus' : 'Pro', proReason: 'subscription',
    }
  }

  // Cancelled but the paid period hasn't ended yet - access remains at the tier.
  if (paidTier && state === 'cancelled' && inFuture(brand?.subscription_current_period_end)) {
    return {
      tier: planTier, state, isPro: true, isPlus: planTier === 'plus',
      label: planTier === 'plus' ? 'Plus' : 'Pro', proReason: 'cancelled_until_period_end',
    }
  }

  // Beta: Pro is free for everyone; Plus stays gated unless BETA_FREE_PLUS is set.
  if (isBetaFreePro()) {
    const plus = isBetaFreePlus()
    return {
      tier: plus ? 'plus' : 'pro',
      state: 'beta_free',
      isPro: true,
      isPlus: plus,
      label: plus ? 'Plus Beta' : 'Pro Beta',
      proReason: 'beta',
    }
  }

  // Launch-transition grace window — grants Pro (barter), not Plus.
  if (inFuture(brand?.grandfathered_pro_until)) {
    return { tier: 'pro', state, isPro: true, isPlus: false, label: 'Pro', proReason: 'grandfathered' }
  }

  return { tier: 'free', state, isPro: false, isPlus: false, label: 'Free', proReason: null }
}

/** Resolve the signed-in brand's plan. Non-brands get null. */
export async function getBrandPlanForUser(userId: string): Promise<{
  brandId: string
  plan: ResolvedPlan
} | null> {
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles')
    .select(`id, ${PLAN_COLUMNS}`)
    .eq('user_id', userId).maybeSingle()
  if (!brand) return null
  return { brandId: brand.id, plan: resolvePlan(brand) }
}

/**
 * API gate for a tiered feature. `need` is the minimum tier: 'pro' (barter) or
 * 'plus' (discovery + analytics). Returns null when allowed, or a calm 403 (no
 * pricing) otherwise.
 */
export function featureGateResponse(
  plan: ResolvedPlan,
  feature: string,
  need: 'pro' | 'plus' = 'pro',
): NextResponse | null {
  const ok = need === 'plus' ? plan.isPlus : plan.isPro
  if (ok) return null
  const tierLabel = need === 'plus' ? 'Plus' : 'Pro'
  return NextResponse.json(
    { error: `${feature} is part of collabr ${tierLabel}. Upgrade from the Billing page to unlock it.` },
    { status: 403 }
  )
}

/** Back-compat alias — gates a Pro feature (barter). */
export function proGateResponse(plan: ResolvedPlan, feature: string): NextResponse | null {
  return featureGateResponse(plan, feature, 'pro')
}
