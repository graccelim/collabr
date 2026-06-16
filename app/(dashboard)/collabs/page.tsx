import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getUserRow } from '@/lib/auth'
import { formatSGD, COLLAB_STATUSES, getInitials } from '@/lib/utils'
import { deriveWorkflow, actorLabel, escrowStep } from '@/lib/workflow'
import EmptyState from '@/components/EmptyState'
import CollabsList, { type CollabRowData } from '@/components/CollabsList'
import { Briefcase } from 'lucide-react'

export default async function CollabsPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const profile = await getUserRow()

  const isBrand = profile?.role === 'brand'

  // Resolve the viewer's own profile id first - the list query below uses the
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

  // Build display rows + filter bucket (Needs you / In progress / Completed)
  // server-side; the chip filtering happens client-side in <CollabsList>.
  const rows: CollabRowData[] = (collabs || []).map(c => {
    const counterparty = isBrand
      ? (c.creator_profiles as any)?.users?.display_name || 'Creator'
      : (c.brand_profiles as any)?.company_name || 'Brand'
    const view = deriveWorkflow({ status: c.status, paymentStatus: c.payment_status, isBrand, counterpartName: counterparty })
    const turn = actorLabel(view, isBrand, counterparty)
    const done = ['completed', 'cancelled'].includes(c.status)
    const statusLabel = COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.label || c.status
    return {
      id: c.id,
      counterparty,
      initials: getInitials(counterparty),
      campaignTitle: c.campaigns?.title || 'Campaign',
      step: escrowStep(c.status, c.payment_status),
      statusLabel: turn.yourTurn ? `${statusLabel} · your turn` : statusLabel,
      statusColor: c.status === 'disputed' ? 'var(--danger)' : turn.yourTurn ? 'var(--warn)' : 'var(--ink-faint-solid)',
      amount: formatSGD(c.agreed_rate),
      bucket: done ? 'completed' : turn.yourTurn ? 'needs' : 'progress',
      dimmed: done,
    }
  })

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Collaborations</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          Every active deal and exactly where its escrow sits. Open one to manage drafts and release.
        </p>
      </div>

      {rows.length > 0 ? (
        <CollabsList rows={rows} />
      ) : (
        <EmptyState
          icon={Briefcase}
          title={isBrand ? 'Ready when you are' : 'No collabs yet'}
          body={isBrand
            ? 'Accept a creator on one of your campaigns and fund escrow, your active collabs and their progress will light up here.'
            : 'When a brand accepts you, the collab opens here with your payment already secured in escrow. Apply to a campaign to get started.'}
          actionHref={isBrand ? '/campaigns' : '/jobs'}
          actionLabel={isBrand ? 'Go to campaigns' : 'Browse campaigns'}
        />
      )}
    </div>
  )
}
