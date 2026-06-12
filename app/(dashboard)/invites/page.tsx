import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, relativeTime, getInitials } from '@/lib/utils'
import InviteActions from '@/components/InviteActions'
import EmptyState from '@/components/EmptyState'
import { Send, Mail } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warn',
  accepted: 'badge-safe',
  declined: 'badge-neutral',
  expired: 'badge-neutral',
}

export default async function InvitesPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const { data: account } = await supabase.from('users').select('role').eq('id', user.id).single()
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
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Invites sent</h1>
          <p className="text-sm text-gray-500 mt-0.5">Creators you&apos;ve invited to your campaigns.</p>
        </div>

        {(!invites || invites.length === 0) ? (
          <EmptyState
            icon={Send}
            title="No invites sent yet"
            body="Found a creator you like? Invite them to a campaign directly from their profile — if they accept, the collab is created instantly."
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
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                    background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12,
                  }}>
                    {creator?.users?.avatar_url
                      ? <img src={creator.users.avatar_url} alt={name} style={{ width: 36, height: 36, objectFit: 'cover' }} />
                      : getInitials(name)}
                  </div>
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
    .select('id').eq('user_id', user.id).single()
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
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Invites</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Brands that want to work with you. Accepting creates the collab instantly — escrow protects the payment.
        </p>
      </div>

      {(!invites || invites.length === 0) && (
        <EmptyState
          icon={Mail}
          title="No invites yet"
          body="When a brand invites you to a campaign, it appears here. A complete profile with connected socials gets you discovered faster."
          actionHref="/profile"
          actionLabel="Polish your profile"
        />
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">Pending · {pending.length}</p>
          {pending.map(inv => {
            const brandP = inv.brand_profiles as any
            return (
              <div key={inv.id} className="card space-y-3">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                      {brandP?.company_name || 'A brand'} invited you to &ldquo;{(inv.campaigns as any)?.title || 'a campaign'}&rdquo;
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{relativeTime(inv.created_at)}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint-solid)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Offer</div>
                    <div style={{ fontSize: 17, fontWeight: 650, color: 'var(--safe-deep)' }} className="mono-num">
                      {formatSGD(inv.proposed_rate)}
                    </div>
                  </div>
                </div>
                {inv.message && (
                  <p style={{
                    fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5,
                    background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', margin: 0,
                  }}>
                    &ldquo;{inv.message}&rdquo;
                  </p>
                )}
                <InviteActions inviteId={inv.id} />
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
