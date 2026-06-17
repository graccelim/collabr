import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getUserRow } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, relativeTime } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import InviteActions from '@/components/InviteActions'
import EmptyState from '@/components/EmptyState'
import BoostHint from '@/components/BoostHint'
import { boostUiEnabled, boostPreview } from '@/lib/stripe'
import { Send, Mail, Zap, Shield } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warn',
  accepted: 'badge-safe',
  declined: 'badge-neutral',
  expired: 'badge-neutral',
}

export default async function InvitesPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const account = await getUserRow()
  const isBrand = account?.role === 'brand'

  // ── Brand: invites sent ─────────────────────────────────────────────────────
  if (isBrand) {
    const { data: brand } = await supabase.from('brand_profiles')
      .select('id').eq('user_id', user.id).single()
    // Admin client so the creator's display identity resolves (users rows are
    // RLS-limited to own-row); scoped explicitly to this brand's invites.
    const admin = createAdminClient()
    const { data: invites } = brand
      ? await admin.from('campaign_invites')
          .select('*, campaigns(title), creator_profiles(id, users(display_name, avatar_url))')
          .eq('brand_id', brand.id)
          .order('created_at', { ascending: false }).limit(100)
      : { data: [] }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Invites sent</h1>
          <p className="text-sm text-gray-500 mt-0.5">Every creator you&apos;ve reached out to, and whether they&apos;ve said yes.</p>
        </div>

        {(!invites || invites.length === 0) ? (
          <EmptyState
            icon={Send}
            title="You haven't invited anyone yet"
            body="Spot a creator you'd love to work with? Invite them straight from their profile. If they accept, your collab opens on the spot."
            actionHref="/creators"
            actionLabel="Browse creators"
          />
        ) : (
          <div className="space-y-2">
            {invites.map(inv => {
              const creator = inv.creator_profiles as any
              const name = creator?.users?.display_name || 'Creator'
              return (
                <div key={inv.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar src={creator?.users?.avatar_url} name={name} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/creators/${creator?.id}`} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                      {name}
                    </Link>
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1 }}>
                      {(inv.campaigns as any)?.title || 'Campaign'} · {formatSGD(inv.proposed_rate)} · {relativeTime(inv.created_at)}
                    </p>
                  </div>
                  <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>{inv.status}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Creator: invites received ───────────────────────────────────────────────
  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, boost_active_until, onboarding_completed_at').eq('user_id', user.id).single()
  // Admin client so campaign titles still resolve after a campaign closes;
  // scoped explicitly to this creator's invites.
  const adminClient = createAdminClient()
  const { data: invites } = creator
    ? await adminClient.from('campaign_invites')
        .select('*, campaigns(id, title, brief), brand_profiles(company_name, logo_url)')
        .eq('creator_id', creator.id)
        .order('created_at', { ascending: false }).limit(100)
    : { data: [] }

  const pending = (invites || []).filter(i => i.status === 'pending')
  const past = (invites || []).filter(i => i.status !== 'pending')

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Invites</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Brands that want to work with you. Accepting creates the collab instantly, escrow protects the payment.
        </p>
      </div>

      {/* Boost nudge - only once boost is configured AND the profile is complete. */}
      {boostUiEnabled() && creator?.onboarding_completed_at && (
        <BoostHint boostUntil={creator?.boost_active_until ?? null} preview={boostPreview()} />
      )}

      {(!invites || invites.length === 0) && (
        <EmptyState
          icon={Mail}
          title="Brands will reach out right here"
          body="When a brand invites you to a campaign, it lands here with their offer attached. A complete profile with connected socials gets you discovered faster."
          actionHref="/profile"
          actionLabel="Polish your profile"
        />
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">Pending · {pending.length}</p>
          {pending.map(inv => {
            const brandP = inv.brand_profiles as any
            const brandName = brandP?.company_name || 'A brand'
            return (
              <div key={inv.id} className="card space-y-3">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                  <Avatar src={brandP?.logo_url} name={brandName} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 14, fontWeight: 560, color: 'var(--ink)' }}>{brandName} invited you</p>
                      <span className="badge badge-warn"><Zap size={11} /> New</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {(inv.campaigns as any)?.title || 'a campaign'} · {relativeTime(inv.created_at)}
                    </p>
                  </div>
                  {/* escrow offer pill */}
                  <span className="badge badge-money" style={{ flexShrink: 0, height: 28, paddingInline: 11, fontSize: 14, fontWeight: 600 }}>
                    <Shield size={13} />
                    <span className="mono-num">{formatSGD(inv.proposed_rate)}</span>
                  </span>
                </div>
                {inv.message && (
                  <p style={{
                    fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5,
                    background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', margin: 0,
                  }}>
                    &ldquo;{inv.message}&rdquo;
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 13 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
                    If you accept, {brandName} funds escrow immediately.
                  </span>
                  <InviteActions inviteId={inv.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">Past</p>
          {past.map(inv => (
            <div key={inv.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: .75 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {(inv.brand_profiles as any)?.company_name || 'Brand'} · {(inv.campaigns as any)?.title || 'Campaign'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1 }}>
                  {formatSGD(inv.proposed_rate)} · {inv.responded_at ? relativeTime(inv.responded_at) : relativeTime(inv.created_at)}
                </p>
              </div>
              <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>{inv.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
