import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import { resolvePlan, isBetaFreePro, PRO_FEATURES, PLAN_COLUMNS } from '@/lib/plans'
import BillingActions from '@/components/BillingActions'
import EmptyState from '@/components/EmptyState'
import Link from 'next/link'
import { Check, Receipt } from 'lucide-react'

export default async function BillingPage() {
  const user = await requireBrand()
  const supabase = createClient()

  // Admin client: stripe_customer_id and subscription columns are not
  // client-readable; this is the signed-in brand's own row, scoped by user_id.
  const { data: brand } = await createAdminClient().from('brand_profiles')
    .select(`id, company_name, stripe_customer_id, ${PLAN_COLUMNS}`)
    .eq('user_id', user.id).single()

  // Admin client: creator display identity is RLS own-row-only for session
  // clients; the query is scoped to this brand's own collabs.
  const { data: collabs } = await createAdminClient().from('collabs')
    .select('*, campaigns(title), creator_profiles(users(display_name))')
    .eq('brand_id', brand!.id)
    .eq('status', 'completed')
    .in('payment_status', ['paid', 'manual_exception'])
    .order('created_at', { ascending: false })

  const totalSpend = (collabs || []).reduce((sum, c) => sum + (c.agreed_rate || 0), 0)
  const plan = resolvePlan(brand)
  const beta = isBetaFreePro()

  const periodEnd = brand?.subscription_current_period_end
    ? new Date(brand.subscription_current_period_end).toLocaleDateString('en-SG')
    : null
  const grandfatheredUntil = brand?.grandfathered_pro_until
    ? new Date(brand.grandfathered_pro_until).toLocaleDateString('en-SG')
    : null

  const statusLabel = plan.proReason === 'beta' ? 'Active'
    : plan.proReason === 'cancelled_until_period_end' ? `Active until ${periodEnd}`
    : plan.proReason === 'grandfathered' ? 'Complimentary'
    : plan.state === 'active' ? 'Active'
    : plan.state === 'past_due' ? 'Past due'
    : plan.isPro ? 'Active'
    : plan.state === 'cancelled' ? 'Cancelled'
    : '—'
  const statusBadge = plan.state === 'past_due' ? 'badge-warn'
    : plan.proReason === 'cancelled_until_period_end' ? 'badge-warn'
    : plan.isPro ? 'badge-safe'
    : 'badge-neutral'

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Billing</h1>

      {/* Current plan */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Current plan</p>
            <p className="text-lg font-semibold text-gray-900">{plan.label}</p>
          </div>
          <span className={`badge ${statusBadge}`}>{statusLabel}</span>
        </div>

        {/* Benefits */}
        {plan.isPro && (
          <ul className="mt-4 space-y-1.5">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={14} style={{ color: 'var(--safe)' }} />
                {f}
              </li>
            ))}
          </ul>
        )}

        {/* Beta explanation — the one place this is spelled out */}
        {beta && (
          <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-border leading-relaxed">
            You currently have complimentary Pro access while collabr is in beta.
            We may introduce paid plans in the future. Existing beta users will be
            notified in advance.
          </p>
        )}

        {/* Paid mode actions */}
        {!beta && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 flex-wrap">
            {plan.proReason === 'grandfathered' ? (
              <div className="w-full">
                <p className="text-sm text-gray-600 mb-1">
                  You have complimentary Pro access until {grandfatheredUntil} as an early
                  collabr user — thanks for being here from the start.
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Subscribe any time to keep Pro after that. Pricing is shown at checkout.
                </p>
                <BillingActions action="checkout" label="Continue to checkout" variant="primary" />
              </div>
            ) : plan.isPro ? (
              <>
                <BillingActions action="portal" label="Manage subscription" />
                {plan.state === 'past_due' && (
                  <p className="text-xs" style={{ color: 'var(--warn-deep)' }}>
                    Your last payment failed — update your payment method to keep Pro access.
                  </p>
                )}
                {plan.proReason === 'cancelled_until_period_end' ? (
                  <p className="text-xs" style={{ color: 'var(--warn-deep)' }}>
                    Subscription cancelled — Pro access remains until {periodEnd}. Your saved
                    creators and invites are kept either way.
                  </p>
                ) : periodEnd ? (
                  <p className="text-xs text-gray-400">Renews {periodEnd}</p>
                ) : null}
              </>
            ) : (
              <>
                <div className="w-full">
                  <p className="text-sm text-gray-600 mb-1">
                    Pro unlocks creator discovery, invites, saved creators, advanced filters
                    and barter campaigns.
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    Pricing is shown at checkout. Campaigns, applications, escrow, reviews
                    and disputes stay on the Free plan.
                  </p>
                  <div className="flex gap-2">
                    <BillingActions action="checkout" label="Continue to checkout" variant="primary" />
                    {brand?.stripe_customer_id && (
                      <BillingActions action="portal" label="Billing portal" />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Spend summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-2xl font-semibold text-gray-900 mono-num">{formatSGD(totalSpend)}</p>
          <p className="text-xs text-gray-500 mt-1">Total campaign spend</p>
        </div>
        <div className="card">
          <p className="text-2xl font-semibold text-gray-900 mono-num">{collabs?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Completed collabs</p>
        </div>
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Payment history</h2>
        {(!collabs || collabs.length === 0) ? (
          <EmptyState
            icon={Receipt}
            title="No settled payments yet"
            body="Escrow payments appear here once a collab completes and the creator is paid."
          />
        ) : (
          <div className="space-y-2">
            {collabs.map(c => {
              const creatorName = ((c.creator_profiles as any)?.users?.display_name) || 'Creator'
              return (
                <div key={c.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.campaigns?.title}</p>
                    <p className="text-xs text-gray-500">{creatorName} · {new Date(c.created_at).toLocaleDateString('en-SG')}</p>
                    <p className="text-xs text-gray-400">Fee: {formatSGD(c.platform_fee)} · Creator: {formatSGD(c.creator_payout)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 mono-num">{formatSGD(c.agreed_rate)}</p>
                    <Link href={`/collabs/${c.id}`} className="text-xs" style={{ color: 'var(--accent-deep)' }}>View →</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
