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

export type PlanTier = 'free' | 'pro'
export type SubscriptionState = 'beta_free' | 'active' | 'cancelled' | 'past_due'

export interface ResolvedPlan {
  tier: PlanTier
  state: SubscriptionState
  isPro: boolean
  /** Human label: "Pro Beta" | "Pro" | "Free" */
  label: string
  /** Why this brand is Pro (drives billing-page copy). */
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

export const PRO_FEATURES = [
  'Creator Discovery',
  'Creator Search & Advanced Filters',
  'Creator Invites',
  'Saved Creators',
  'Barter Campaigns',
] as const

function inFuture(iso: string | null | undefined): boolean {
  return Boolean(iso && new Date(iso) > new Date())
}

export function resolvePlan(brand: BrandPlanRow | null): ResolvedPlan {
  if (isBetaFreePro()) {
    return { tier: 'pro', state: 'beta_free', isPro: true, label: 'Pro Beta', proReason: 'beta' }
  }

  const state = (brand?.subscription_status as SubscriptionState) || 'beta_free'

  // Active subscription, or past_due while Stripe retries payment.
  if (brand?.plan === 'pro' && (state === 'active' || state === 'past_due')) {
    return { tier: 'pro', state, isPro: true, label: 'Pro', proReason: 'subscription' }
  }

  // Cancelled but the paid period hasn't ended yet - access remains.
  if (brand?.plan === 'pro' && state === 'cancelled' && inFuture(brand?.subscription_current_period_end)) {
    return { tier: 'pro', state, isPro: true, label: 'Pro', proReason: 'cancelled_until_period_end' }
  }

  // Launch-transition grace window for existing beta users.
  if (inFuture(brand?.grandfathered_pro_until)) {
    return { tier: 'pro', state, isPro: true, label: 'Pro', proReason: 'grandfathered' }
  }

  return { tier: 'free', state, isPro: false, label: 'Free', proReason: null }
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
 * API gate for Pro features. Returns null when allowed, or a 403 response
 * when paid mode is active and the brand is on Free. Calm copy - no pricing.
 */
export function proGateResponse(plan: ResolvedPlan, feature: string): NextResponse | null {
  if (plan.isPro) return null
  return NextResponse.json(
    { error: `${feature} is part of collabr Pro. Upgrade from the Billing page to unlock it.` },
    { status: 403 }
  )
}
