import { createClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'
import CampaignList from '@/components/CampaignList'
import { Megaphone, Plus } from 'lucide-react'

export default async function CampaignsPage() {
  const user = await requireBrand()
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single()
  const { data: campaigns } = await supabase.from('campaigns')
    .select('*').eq('brand_id', brand!.id).order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
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

      {(!campaigns || campaigns.length === 0) ? (
        <EmptyState
          icon={Megaphone}
          title="Let's get your first campaign live"
          body="Describe what you need and creators start applying — usually within hours. Your money stays in escrow until you approve the work. Live in under five minutes."
          steps={['Write a brief', 'Set your budget', 'Go live']}
          actionHref="/post-job"
          actionLabel="Post your first campaign"
        />
      ) : (
        <CampaignList campaigns={campaigns} />
      )}
    </div>
  )
}
