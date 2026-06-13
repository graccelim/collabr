import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, COLLAB_STATUSES, getInitials, relativeTime } from '@/lib/utils'
import { deriveWorkflow, actorLabel, escrowStep } from '@/lib/workflow'
import EmptyState from '@/components/EmptyState'
import { ChevronRight, MessageSquare } from 'lucide-react'

export default async function CollabsPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()

  const isBrand = profile?.role === 'brand'

  // Resolve the viewer's own profile id first — the list query below uses the
  // admin client (counterparty display identity is RLS own-row-only for
  // session clients) and must always be scoped to the viewer's own collabs.
  let ownFilter: { column: 'brand_id' | 'creator_id'; id: string } | null = null
  if (isBrand) {
    const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single()
    if (brand) ownFilter = { column: 'brand_id', id: brand.id }
  } else {
    const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
    if (creator) ownFilter = { column: 'creator_id', id: creator.id }
  }

  const { data: collabs } = ownFilter
    ? await createAdminClient().from('collabs')
        .select('*, campaigns(title), creator_profiles(id, user_id, users(display_name)), brand_profiles(company_name), stripe_payment_intent_id')
        .eq(ownFilter.column, ownFilter.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const active = collabs?.filter(c => !['completed', 'cancelled'].includes(c.status)) || []
  const past = collabs?.filter(c => ['completed', 'cancelled'].includes(c.status)) || []

  // Redesign row: counterparty-first, slim escrow track + n/5, mono amount.
  const CollabRow = ({ c, dimmed = false }: { c: any; dimmed?: boolean }) => {
    const counterparty = isBrand
      ? (c.creator_profiles as any)?.users?.display_name || 'Creator'
      : (c.brand_profiles as any)?.company_name || 'Brand'
    const initials = getInitials(counterparty)

    const view = deriveWorkflow({
      status: c.status,
      paymentStatus: c.payment_status,
      isBrand,
      counterpartName: counterparty,
    })
    const turn = actorLabel(view, isBrand, counterparty)
    const step = escrowStep(c.status, c.payment_status)
    const statusLabel = COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.label || c.status
    const statusColor = c.status === 'disputed' ? 'var(--danger)'
      : turn.yourTurn ? 'var(--warn)'
      : 'var(--ink-faint-solid)'

    return (
      <Link href={`/collabs/${c.id}`} style={{
        textDecoration: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '17px 20px', background: 'var(--surface)',
        opacity: dimmed ? 0.6 : 1, transition: 'background .12s ease',
      }} className="collab-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-tint)', color: 'var(--accent-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: 14,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 550, color: 'var(--ink)' }}>{counterparty}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.campaigns?.title || 'Campaign'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
            {/* slim escrow progress — green = money-secured steps cleared */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }} title={`Escrow step ${step} of 5`}>
              <div className="mini-escrow-track">
                <div className="mini-escrow-fill" style={{ width: `${(step / 5) * 100}%` }} />
              </div>
              <span className="mono-num" style={{ fontSize: 11, color: 'var(--ink-faint-solid)', letterSpacing: '0.02em' }}>{step}/5</span>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: statusColor }}>
              {turn.yourTurn ? `${statusLabel} · your turn` : statusLabel}
            </span>
          </div>
          <span className="mono-num" style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 540, minWidth: 56, textAlign: 'right' }}>
            {formatSGD(c.agreed_rate)}
          </span>
          <ChevronRight size={17} style={{ color: 'var(--ink-faint-solid)' }} />
        </div>
      </Link>
    )
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Collaborations</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          Every active deal and exactly where its escrow sits. Open one to manage drafts and release.
        </p>
      </div>

      {active.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Active · {active.length}</p>
          <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
            {active.map(c => <CollabRow key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Past</p>
          <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
            {past.map(c => <CollabRow key={c.id} c={c} dimmed />)}
          </div>
        </div>
      )}

      {(!collabs || collabs.length === 0) && (
        <EmptyState
          icon={MessageSquare}
          title="Your first collaboration starts here"
          body={isBrand
            ? "Accept a creator on one of your campaigns and fund escrow — your active collabs and their progress will light up here."
            : 'Apply to open campaigns or accept an invite. Once a brand selects you, your collab appears here with payment secured.'}
          steps={isBrand
            ? ['Post a campaign', 'Pick a creator', 'Fund escrow']
            : ['Browse campaigns', 'Apply or accept an invite', 'Get paid via escrow']}
          actionHref={isBrand ? '/campaigns' : '/jobs'}
          actionLabel={isBrand ? 'Go to campaigns' : 'Browse campaigns'}
        />
      )}
    </div>
  )
}
