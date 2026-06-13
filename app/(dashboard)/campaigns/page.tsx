import { createClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import EmptyState from '@/components/EmptyState'
import { Briefcase } from 'lucide-react'

export default async function CampaignsPage() {
  const user = await requireBrand()
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single()
  const { data: campaigns } = await supabase.from('campaigns')
    .select('*').eq('brand_id', brand!.id).order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
        <Link href="/post-job" className="btn-primary">Post new</Link>
      </div>
      <div className="space-y-2">
        {campaigns?.map(c => (
          <Link key={c.id} href={`/campaigns/${c.id}`}
            className="card flex items-center justify-between hover:border-purple-200 transition-colors">
            <div>
              <div className="text-sm font-medium text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {c.comp_type} · {c.creators_needed} creator{c.creators_needed > 1 ? 's' : ''} · {c.deadline ? `Due ${new Date(c.deadline).toLocaleDateString('en-SG')}` : 'No deadline'}
              </div>
            </div>
            <span className={`badge ${c.status === 'active' ? 'badge-teal' : 'badge-gray'}`}>{c.status}</span>
          </Link>
        ))}
        {(!campaigns || campaigns.length === 0) && (
          <EmptyState
            icon={Briefcase}
            title="Let's get your first campaign live"
            body="Describe what you need and creators start applying — usually within 48 hours. Your money stays in escrow until you approve the work."
            steps={['Post a campaign', 'Review applicants', 'Fund escrow']}
            actionHref="/post-job"
            actionLabel="Post your first campaign"
          />
        )}
      </div>
    </div>
  )
}
