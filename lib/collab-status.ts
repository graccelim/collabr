/**
 * Single source of truth for "is payment secured?", how many campaign spots are
 * actually consumed, and what a CREATOR is allowed to see about an application.
 *
 * Product promise: creators only start work after payment is secured. So a
 * collab that exists but isn't funded yet is invisible to the creator — their
 * application still simply reads "Applied".
 *
 * No new DB statuses: this is pure mapping over the existing
 * applications.status + collabs.payment_status / collabs.status values.
 */

// payment_status values that mean "money is secured" (funded or further along).
// Anything before `funded` (unfunded/authorizing) is NOT secured; cancelled /
// refunded / failed states are not secured either.
export const SECURED_PAYMENT_STATUSES = [
  'funded', 'capture_pending', 'captured', 'transfer_pending', 'paid', 'manual_exception',
] as const

export function isPaymentSecured(paymentStatus?: string | null): boolean {
  return !!paymentStatus && (SECURED_PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
}

/**
 * Does this collab consume a campaign spot? Only a funded (secured), non-cancelled
 * collab counts. Pending / shortlisted applications and selected-but-unfunded
 * collabs never consume a spot.
 */
export function consumesSpot(collab: { status?: string | null; payment_status?: string | null }): boolean {
  return collab.status !== 'cancelled' && isPaymentSecured(collab.payment_status)
}

/** Remaining spots = creators_needed − funded collabs (floored at 0). */
export function remainingSpots(
  creatorsNeeded: number | null | undefined,
  collabs: { status?: string | null; payment_status?: string | null }[],
): number {
  const filled = (collabs || []).filter(consumesSpot).length
  return Math.max(0, (creatorsNeeded || 1) - filled)
}

export function isCampaignFilled(
  creatorsNeeded: number | null | undefined,
  collabs: { status?: string | null; payment_status?: string | null }[],
): boolean {
  return remainingSpots(creatorsNeeded, collabs) <= 0
}

// What the CREATOR sees for one application. selected-but-unfunded collapses to
// "applied" so no unfunded/selected state ever leaks to the creator.
export type CreatorAppState = 'applied' | 'confirmed' | 'rejected'

export function creatorApplicationState(
  appStatus: string,
  collab?: { status?: string | null; payment_status?: string | null } | null,
): CreatorAppState {
  if (appStatus === 'rejected') return 'rejected'
  if (appStatus === 'selected' && collab && consumesSpot(collab)) return 'confirmed'
  // pending, shortlisted, and selected-but-unfunded all read as "Applied".
  return 'applied'
}

export const CREATOR_APP_LABEL: Record<CreatorAppState, string> = {
  applied: 'Applied',
  confirmed: 'Confirmed · Payment Secured',
  rejected: 'Rejected',
}

/**
 * A paid campaign (cash rate) requires an expected rate on application; a barter
 * campaign does not (the rate is optional there). 'both' counts as paid.
 */
export function requiresExpectedRate(compType?: string | null): boolean {
  return compType === 'paid' || compType === 'both'
}
