import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'
import ListWorkspace, { type LWItem, type LWTile, type LWStatus } from '@/components/ListWorkspace'
import { CampaignDesktopCard, CampaignMobileCard, type CampaignRow } from '@/components/CampaignCard'
import { capacityBreakdown } from '@/lib/collab-status'
import { formatSGD } from '@/lib/utils'
import { Megaphone, Plus } from 'lucide-react'

export default async function CampaignsPage() {
  const user = await requireBrand()
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single()
  const { data: campaigns } = await supabase.from('campaigns')
    .select('id, title, status, comp_type, budget_min, budget_max, creators_needed, deadline, brand_id')
    .eq('brand_id', brand!.id).order('created_at', { ascending: false })

  const campaignIds = (campaigns || []).map(c => c.id)

  // Applications (count + a few applicant names per campaign) and funded
  // escrow / filled spots per campaign - independent reads, issued concurrently.
  // Admin client: applicant display identity and collabs are RLS-restricted for
  // session clients; both scoped to this brand's own campaigns. Applications
  // ordered so boosted/recent applicants surface.
  const [{ data: applications }, { data: collabs }] = await Promise.all([
    campaignIds.length
      ? createAdminClient().from('applications')
          .select('campaign_id, created_at, is_boosted, creator_profiles(users(display_name))')
          .in('campaign_id', campaignIds)
          // Don't count/preview withdrawn or rejected applicants — they're not in the running.
          .not('status', 'in', '("withdrawn","rejected")')
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    campaignIds.length
      ? createAdminClient().from('collabs')
          .select('campaign_id, agreed_rate, payment_status, status')
          .in('campaign_id', campaignIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const applicantCount = new Map<string, number>()
  const applicantNames = new Map<string, string[]>()
  for (const a of applications || []) {
    const id = a.campaign_id as string
    applicantCount.set(id, (applicantCount.get(id) || 0) + 1)
    const names = applicantNames.get(id) || []
    if (names.length < 3) {
      names.push((a.creator_profiles as any)?.users?.display_name || 'Creator')
      applicantNames.set(id, names)
    }
  }

  const inEscrow = new Map<string, number>()
  const byCampaign = new Map<string, { status: string; payment_status: string }[]>()
  for (const c of collabs || []) {
    const id = c.campaign_id as string
    if (id == null) continue
    const list = byCampaign.get(id) || []
    list.push({ status: c.status, payment_status: c.payment_status })
    byCampaign.set(id, list)
    if (c.payment_status === 'funded' && c.status !== 'completed' && c.status !== 'cancelled') {
      inEscrow.set(id, (inEscrow.get(id) || 0) + (c.agreed_rate || 0))
    }
  }

  const rows: CampaignRow[] = (campaigns || []).map(c => {
    const cap = capacityBreakdown(c.creators_needed, byCampaign.get(c.id) || [])
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      comp_type: c.comp_type,
      budget_min: c.budget_min,
      budget_max: c.budget_max,
      creators_needed: c.creators_needed,
      deadline: c.deadline,
      applicants: applicantCount.get(c.id) || 0,
      confirmed: cap.confirmed,
      awaiting: cap.awaiting,
      available: cap.available,
      inEscrow: inEscrow.get(c.id) || 0,
      applicantNames: applicantNames.get(c.id) || [],
    }
  })

  // Stat-band aggregates — derived from rows already built (no new queries).
  const activeRows = rows.filter((r) => r.status === 'active')
  const applicantsToReview = activeRows.reduce((s, r) => s + r.applicants, 0)
  const spotsToFill = activeRows.reduce((s, r) => s + r.available, 0)
  const protectedTotal = rows.reduce((s, r) => s + r.inEscrow, 0)

  const items: LWItem[] = rows.map((r, i) => ({
    id: r.id,
    status: r.status,
    amountCents: r.inEscrow,
    createdAt: rows.length - i, // preserve the created_at-desc order from the query
    needsAction: r.status === 'active' && r.applicants > 0,
    desktop: <CampaignDesktopCard c={r} />,
    mobile: <CampaignMobileCard c={r} />,
  }))
  const tiles: LWTile[] = [
    { label: 'Active campaigns', value: String(activeRows.length), filter: ['active'] },
    { label: 'Applicants to review', value: String(applicantsToReview), valueColor: 'var(--pending)' },
    { label: 'Spots to fill', value: String(spotsToFill) },
    { label: 'Protected', value: formatSGD(protectedTotal), hero: true, heroIcon: 'shield', heroSub: 'held safely across campaigns' },
  ]
  const statuses: LWStatus[] = [
    { key: 'active', label: 'Active', dot: 'var(--money)' },
    { key: 'draft', label: 'Draft', dot: '#B7BCC6' },
    { key: 'completed', label: 'Completed', dot: 'var(--brand)' },
  ]

  return (
    <div style={{ width: '100%' }}>
      <div className="page-head-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Campaign manager</div>
          <h1 className="display-face" style={{ fontSize: 'clamp(23px,3vw,28px)', fontWeight: 700, letterSpacing: '-0.03em' }}>Your campaigns</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 6, fontSize: 14.5 }}>
            Who&rsquo;s applied, who&rsquo;s confirmed, and how each collab is coming along.
          </p>
        </div>
        <Link href="/post-job" className="btn-primary" style={{ flexShrink: 0 }}>
          <Plus size={16} /> Post a campaign
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Let's get your first campaign live"
          body="Describe what you need and creators start applying, usually within hours. Your money stays protected until you approve the work."
          steps={['Write a brief', 'Set your budget', 'Go live']}
          actionHref="/post-job"
          actionLabel="Post your first campaign"
        />
      ) : (
        <ListWorkspace
          tiles={tiles}
          statuses={statuses}
          sorts={['recent']}
          items={items}
          variant="cards"
          emptyLabel="No campaigns match these filters."
        />
      )}
    </div>
  )
}
