import { createClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD } from '@/lib/utils'
import EmptyState from '@/components/EmptyState'
import { Megaphone, ChevronRight, Plus } from 'lucide-react'

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
        <div className="row-list card" style={{ padding: 0, overflow: 'hidden' }}>
          {campaigns.map(c => {
            const budget = c.budget_min
              ? `${formatSGD(c.budget_min)}${c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}`
              : c.comp_type === 'barter' ? 'Barter' : '—'
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  padding: '16px 18px', textDecoration: 'none',
                }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 560, color: 'var(--ink)' }}>{c.title}</span>
                    <span className={`badge ${c.status === 'active' ? 'badge-money' : c.status === 'draft' ? 'badge-pending' : 'badge-neutral'}`}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>
                    <span className="mono-num">{budget}</span> per creator · {c.creators_needed} spot{c.creators_needed > 1 ? 's' : ''}
                    {c.deadline ? ` · Due ${new Date(c.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : ''}
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
