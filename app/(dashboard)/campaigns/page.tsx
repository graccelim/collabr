import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'
import CampaignList, { type CampaignRow } from '@/components/CampaignList'
import { Megaphone, Plus } from 'lucide-react'

export default async function CampaignsPage() {
  const user = await requireBrand()
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single()
  const { data: campaigns } = await supabase.from('campaigns')
    .select('id, title, status, comp_type, budget_min, budget_max, creators_needed, deadline, brand_id')
    .eq('brand_id', brand!.id).order('created_at', { ascending: false })

  const campaignIds = (campaigns || []).map(c => c.id)

  // Applications (count + a few applicant names per campaign). Admin client:
  // applicant display identity is RLS own-row-only for session clients; scoped
  // to this brand's own campaigns. Ordered so boosted/recent applicants surface.
  const { data: applications } = campaignIds.length
    ? await createAdminClient().from('applications')
        .select('campaign_id, created_at, is_boosted, creator_profiles(users(display_name))')
        .in('campaign_id', campaignIds)
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  // Funded escrow + filled spots per campaign. Admin client: collabs are
  // party-scoped for session clients; this brand owns these campaigns.
  const { data: collabs } = campaignIds.length
    ? await createAdminClient().from('collabs')
        .select('campaign_id, agreed_rate, payment_status, status')
        .in('campaign_id', campaignIds)
    : { data: [] as any[] }

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
  const spotsFilled = new Map<string, number>()
  for (const c of collabs || []) {
    const id = c.campaign_id as string
    if (id == null) continue
    if (c.status !== 'cancelled') {
      spotsFilled.set(id, (spotsFilled.get(id) || 0) + 1)
    }
    if (c.payment_status === 'funded' && c.status !== 'completed' && c.status !== 'cancelled') {
      inEscrow.set(id, (inEscrow.get(id) || 0) + (c.agreed_rate || 0))
    }
  }

  const rows: CampaignRow[] = (campaigns || []).map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    comp_type: c.comp_type,
    budget_min: c.budget_min,
    budget_max: c.budget_max,
    creators_needed: c.creators_needed,
    deadline: c.deadline,
    applicants: applicantCount.get(c.id) || 0,
    spotsFilled: spotsFilled.get(c.id) || 0,
    inEscrow: inEscrow.get(c.id) || 0,
    applicantNames: applicantNames.get(c.id) || [],
  }))

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Campaign manager</div>
          <h1 style={{ fontSize: 28 }}>Your campaigns</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
            Track applicants, drafts and escrow across every brief.
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
          body="Describe what you need and creators start applying — usually within hours. Your money stays in escrow until you approve the work. Live in under five minutes."
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
