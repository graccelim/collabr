import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import ConnectOnboarding from '@/components/ConnectOnboarding'
import EmptyState from '@/components/EmptyState'
import { stripe, boostUiEnabled, boostPreview } from '@/lib/stripe'
import BoostHint from '@/components/BoostHint'
import type { LucideProps } from 'lucide-react'
import { Wallet, TrendingUp, Shield, CheckCircle2 } from 'lucide-react'

// Stat tile (Collabr Redesign): mono value, micro label, tone-tinted icon.
// `money` tone is reserved for secured / escrow figures.
function Stat({ label, value, icon: Icon, sub, tone = 'neutral' }: {
  label: string; value: string; icon: React.ComponentType<Partial<LucideProps>>
  sub?: string; tone?: 'neutral' | 'money'
}) {
  const color = tone === 'money' ? 'var(--money)' : 'var(--ink-faint-solid)'
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="micro">{label}</span>
        <Icon size={16} style={{ color, opacity: 0.85 }} />
      </div>
      <span className="mono-num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: tone === 'money' ? 'var(--money-deep)' : 'var(--ink)' }}>{value}</span>
      {sub && <span className="micro" style={{ color: tone === 'money' ? 'var(--money)' : 'var(--ink-faint-solid)' }}>{sub}</span>}
    </div>
  )
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: { connect?: string }
}) {
  const user = await requireCreator()
  const supabase = createClient()

  const admin = createAdminClient()
  // creator profile + Connect status both key off user.id - fetch concurrently.
  const [{ data: creator }, { data: connectProfile }] = await Promise.all([
    supabase.from('creator_profiles')
      .select('id, user_id, bio, niches, platforms, base_rate, is_verified, boost_active_until, onboarding_completed_at, rating_avg, rating_count, collabs_completed, created_at')
      .eq('user_id', user.id).single(),
    // total_earned is private (not client-readable) - read it via the service role.
    admin.from('creator_profiles')
      .select('stripe_connect_id, total_earned').eq('user_id', user.id).single(),
  ])

  // Real payout readiness - having a Connect id is NOT the same as being able to
  // receive payouts (Stripe may still need details/verification). Check the live
  // account so we never show "connected" (green) before payouts are enabled.
  let payoutsReady = false
  if (connectProfile?.stripe_connect_id) {
    try {
      const acct = await stripe.accounts.retrieve(connectProfile.stripe_connect_id)
      payoutsReady = Boolean(acct.charges_enabled && acct.payouts_enabled)
    } catch { payoutsReady = false }
  }
  // Payout history + active escrow both key off creator.id - fetch concurrently.
  const [{ data: collabs }, { data: secured }] = await Promise.all([
    supabase.from('collabs')
      .select('*, campaigns(title), brand_profiles(company_name)')
      .eq('creator_id', creator!.id)
      .eq('status', 'completed')
      .in('payment_status', ['paid', 'manual_exception'])
      .order('created_at', { ascending: false }),
    // Active escrow secured for this creator - money held but not yet released.
    supabase.from('collabs')
      .select('creator_payout')
      .eq('creator_id', creator!.id)
      .eq('payment_status', 'funded')
      .not('status', 'in', '(completed,cancelled)'),
  ])
  const inEscrow = (secured || []).reduce((sum, c) => sum + (c.creator_payout || 0), 0)
  const escrowCount = (secured || []).length

  const connectComplete = searchParams.connect === 'complete'
  const connectRefresh = searchParams.connect === 'refresh'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="eyebrow" style={{ marginBottom: 7 }}>Money</div>
        <h1 style={{ fontSize: 28 }}>Earnings</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
          What you&rsquo;ve earned, what&rsquo;s held safely for you, and what&rsquo;s on its way to you.
        </p>
      </div>

      <div className="resp-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Stat label="Lifetime earned" value={formatSGD(connectProfile?.total_earned || 0)} icon={TrendingUp} />
        <Stat
          label="Protected for you"
          value={formatSGD(inEscrow)}
          icon={Shield}
          tone="money"
          sub={escrowCount > 0 ? `From ${escrowCount} active collab${escrowCount > 1 ? 's' : ''}` : undefined}
        />
        <Stat label="Completed collabs" value={String(creator?.collabs_completed || 0)} icon={CheckCircle2} />
      </div>

      {/* Stripe Connect onboarding - getting paid comes first, above the boost. */}
      <ConnectOnboarding
        accountExists={Boolean(connectProfile?.stripe_connect_id)}
        payoutsEnabled={payoutsReady}
        justCompleted={connectComplete}
        needsRefresh={connectRefresh}
      />

      {/* Boost nudge - only once boost is configured AND the profile is complete
          (no point boosting an undiscoverable profile). */}
      {boostUiEnabled() && creator?.onboarding_completed_at && (
        <BoostHint boostUntil={creator?.boost_active_until ?? null} preview={boostPreview()} />
      )}

      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Payout history</h2>
        <div className="space-y-2">
          {collabs?.map(c => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{c.campaigns?.title}</div>
                <div className="text-xs text-gray-500">
                  {(c.brand_profiles as any)?.company_name} · {new Date(c.created_at).toLocaleDateString('en-SG')}
                </div>
              </div>
              <div className="text-sm font-medium text-teal-600">{formatSGD(c.creator_payout)}</div>
            </div>
          ))}
          {(!collabs || collabs.length === 0) && (
            <EmptyState
              icon={Wallet}
              tone="money"
              title="Your first payout is on its way"
              body={inEscrow > 0
                ? `${formatSGD(inEscrow)} is protected for you, it lands here the moment the brand confirms your live post.`
                : 'The moment a brand confirms your live post, the protected payment releases and the money is on its way to you. You always know the payment is protected before you start.'}
              actionHref={inEscrow > 0 ? '/collabs' : '/jobs'}
              actionLabel={inEscrow > 0 ? 'Open active collab' : 'Browse campaigns'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
