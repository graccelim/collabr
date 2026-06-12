import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, COLLAB_STATUSES, getInitials, relativeTime } from '@/lib/utils'
import { deriveWorkflow, actorLabel } from '@/lib/workflow'
import EmptyState from '@/components/EmptyState'
import { Lock, ChevronRight, MessageSquare } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  briefed:         'badge-neutral',
  draft_submitted: 'badge-warn',
  in_revision:     'badge-danger',
  draft_approved:  'badge-safe',
  live_submitted:  'badge-warn',
  live_confirmed:  'badge-safe',
  completed:       'badge-safe',
  disputed:        'badge-danger',
  cancelled:       'badge-neutral',
}

const ESCROW_COLOR: Record<string, string> = {
  briefed:         'var(--warn)',
  draft_submitted: 'var(--safe)',
  in_revision:     'var(--safe)',
  draft_approved:  'var(--safe)',
  live_submitted:  'var(--safe)',
  completed:       'var(--safe)',
  disputed:        'var(--danger)',
  cancelled:       'var(--ink-faint-solid)',
}

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

  const CollabCard = ({ c, dimmed = false }: { c: any; dimmed?: boolean }) => {
    const counterparty = isBrand
      ? (c.creator_profiles as any)?.users?.display_name || 'Creator'
      : (c.brand_profiles as any)?.company_name || 'Brand'
    const initials = getInitials(counterparty)
    const statusLabel = COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.label || c.status
    const badgeClass = STATUS_BADGE[c.status] || 'badge-neutral'
    const paymentLabel: Record<string, string> = {
      unfunded: 'Not funded',
      authorizing: 'Authorizing',
      funded: 'Funds held',
      capture_pending: 'Capture pending',
      captured: 'Captured',
      transfer_pending: 'Payout pending',
      paid: 'Creator paid',
      manual_exception: 'Paid manually',
      capture_failed: 'Capture failed',
      transfer_failed: 'Payout failed',
      refund_pending: 'Refund pending',
      refund_failed: 'Refund failed',
      refunded: 'Refunded',
      cancelled: 'Payment cancelled',
    }
    const paymentSafe = ['funded', 'paid', 'manual_exception'].includes(c.payment_status)
    const escrowColor = paymentSafe ? 'var(--safe)' : ESCROW_COLOR[c.status] || 'var(--ink-faint-solid)'

    // Who acts next — so users never have to open a collab to find out.
    const view = deriveWorkflow({
      status: c.status,
      paymentStatus: c.payment_status,
      isBrand,
      counterpartName: counterparty,
    })
    const turn = actorLabel(view, isBrand, counterparty)

    return (
      <Link href={`/collabs/${c.id}`} style={{ textDecoration: 'none' }}>
        <div className="card card-hover" style={{ opacity: dimmed ? 0.65 : 1, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: isBrand ? 'var(--creator-tint)' : 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: isBrand ? 'var(--creator-deep)' : 'var(--ink)' }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.campaigns?.title || 'Campaign'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {counterparty}
                {!dimmed && turn.label && (
                  turn.yourTurn
                    ? <span className="badge badge-accent">Your turn</span>
                    : <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>{turn.label}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span className={`badge ${badgeClass}`}>{statusLabel}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: escrowColor }}>
                <Lock size={12} />
                <span style={{ fontWeight: 600 }}>{paymentLabel[c.payment_status] || 'Payment unknown'} · {formatSGD(c.agreed_rate)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em' }}>Collabs</h1>
      </div>

      {active.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
            Active · {active.length}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(c => <CollabCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
            Past
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(c => <CollabCard key={c.id} c={c} dimmed />)}
          </div>
        </div>
      )}

      {(!collabs || collabs.length === 0) && (
        <EmptyState
          icon={MessageSquare}
          title="No collabs yet"
          body={isBrand
            ? 'Select a creator from a campaign to start your first collaboration. Escrow protects every deal.'
            : 'Apply to open campaigns to get started. Once a brand selects you, your collab appears here.'}
          actionHref={isBrand ? '/campaigns' : '/jobs'}
          actionLabel={isBrand ? 'View campaigns' : 'Browse campaigns'}
        />
      )}
    </div>
  )
}
