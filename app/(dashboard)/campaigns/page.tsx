import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'
import CampaignList, { type CampaignRow } from '@/components/CampaignList'
import { capacityBreakdown } from '@/lib/collab-status'
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

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div className="page-head-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Campaign manager</div>
          <h1 style={{ fontSize: 28 }}>Your campaigns</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
            Your campaigns, who&rsquo;s applied, and how each collab is coming along.
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
          body="Describe what you need and creators start applying, usually within hours. Your money stays protected until you approve the work. Live in under five minutes."
          steps={['Write a brief', 'Set your budget', 'Go live']}
          actionHref="/post-job"
          actionLabel="Post your first campaign"
        />
      ) : (
        <CampaignList campaigns={rows} />
      )}
    </div>
  )
}
