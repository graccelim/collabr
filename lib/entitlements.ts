// Creator Pro 💎 entitlements — the pure, tested gate for everything Pro unlocks
// (connecting social accounts, syncing analytics, Creator Studio, AI). One place
// decides "is this creator Pro-active right now?" so connect/sync/studio/AI all
// agree, and expiry reliably FREEZES (never deletes).
//
// No I/O here — callers pass the creator_subscriptions row + the current time.

export type ProStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export interface SubscriptionRow {
  status: ProStatus | string | null
  pro_until: string | Date | null
}

export interface ProState {
  status: ProStatus
  /** Pro features are unlocked right now. */
  active: boolean
  /** Previously had Pro but access has lapsed — show stale state, keep history, stop syncing. */
  frozen: boolean
}

function asDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

/** Statuses that grant access while still inside the paid/trial period. */
const ACTIVE_STATUSES = new Set<ProStatus>(['trialing', 'active', 'past_due'])

/**
 * Resolve the live entitlement state from a subscription row.
 * Active = an access-granting status AND we're still within `pro_until` (if set).
 * Frozen = not active but the creator has a subscription history (so the UI shows
 * "Last synced …" + a renew prompt rather than hiding everything).
 */
export function proState(row: SubscriptionRow | null | undefined, now: Date = new Date()): ProState {
  const status = (row?.status as ProStatus) || 'none'
  const until = asDate(row?.pro_until)
  const withinPeriod = until == null || until.getTime() > now.getTime()

  const active = ACTIVE_STATUSES.has(status) && withinPeriod
  const frozen =
    !active &&
    (status === 'canceled' ||
      status === 'expired' ||
      // an access status whose period has elapsed (webhook not yet caught up)
      (ACTIVE_STATUSES.has(status) && until != null && until.getTime() <= now.getTime()))

  return { status, active, frozen }
}

export const isProActive = (row: SubscriptionRow | null | undefined, now: Date = new Date()): boolean =>
  proState(row, now).active

// ── Capability gates (all derive from active) ───────────────────────────────
/** May connect social accounts for auto-analytics (Phyllo/YouTube). */
export const canConnectAccounts = isProActive
/** May open Creator Studio surfaces (Insights/Coach/Content Lab/etc.). */
export const canUseStudio = isProActive
/** Should the nightly sync include this creator's accounts? Lapsed Pro = frozen = no. */
export const shouldSyncAccount = isProActive
/** May generate / regenerate AI insights & reports. */
export const canGenerateAI = isProActive

export type StudioAccess = 'full' | 'read_only' | 'locked'

/**
 * Creator Studio access level:
 *   • active Pro     → 'full'      (browse + generate + sync)
 *   • lapsed Pro     → 'read_only' (history visible, ⭐ badge stays stale, no new syncs/AI)
 *   • never Pro      → 'locked'    (upgrade card only)
 */
export function studioAccess(row: SubscriptionRow | null | undefined, now: Date = new Date()): StudioAccess {
  const s = proState(row, now)
  if (s.active) return 'full'
  if (s.frozen) return 'read_only'
  return 'locked'
}

/**
 * Map a Stripe subscription status to our pro_status (pure). Stripe is the source
 * of truth; the webhook calls this. `incomplete`/`incomplete_expired`/`unpaid`
 * never grant access.
 */
export function stripeStatusToPro(stripeStatus: string): ProStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
    case 'incomplete_expired':
      return 'expired'
    case 'incomplete':
    default:
      return 'none'
  }
}
