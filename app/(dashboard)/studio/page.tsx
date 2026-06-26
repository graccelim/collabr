import { requireCreator } from '@/lib/auth'
import { redirect } from 'next/navigation'
import crypto from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { studioAccess } from '@/lib/entitlements'
import { flags } from '@/lib/flags'
import CreatorProUpgradeCard from '@/components/CreatorProUpgradeCard'
import StudioNav from '@/components/studio/StudioNav'
import InsightsPanel from '@/components/studio/InsightsPanel'
import ConnectAccounts from '@/components/studio/ConnectAccounts'
import GrowthSuggestions from '@/components/studio/GrowthSuggestions'
import ContentLab from '@/components/studio/ContentLab'
import BrandCoachPanel from '@/components/studio/BrandCoachPanel'
import EmptyState from '@/components/EmptyState'
import { platformConnectable } from '@/lib/analytics/oauth'
import type { Platform } from '@/lib/analytics/adapters/types'
import { Lock, FileText } from 'lucide-react'

export default async function StudioPage({ searchParams }: { searchParams: { tab?: string } }) {
  if (!flags.analyticsSuite) redirect('/dashboard')
  const user = await requireCreator()
  const supabase = createClient()
  const admin = createAdminClient()

  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  const { data: sub } = creator
    ? await admin.from('creator_subscriptions').select('status, pro_until').eq('creator_id', creator.id).maybeSingle()
    : { data: null }
  const access = studioAccess(sub)

  // Locked — never been Pro: entice with the upgrade card.
  if (access === 'locked' || !creator) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <header>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>Creator Studio</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>
            Your growth workspace — connect your socials, see your strengths, and get proactive AI growth suggestions. A Creator Pro feature.
          </p>
        </header>
        {flags.creatorPro ? <CreatorProUpgradeCard returnTo="/studio" /> : (
          <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Lock size={18} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>Creator Studio is available with Creator Pro.</p>
          </div>
        )}
      </div>
    )
  }

  const readOnly = access === 'read_only'
  const tab = searchParams.tab || 'insights'

  // Data (own-row RLS / admin for owner-private tables).
  const [{ data: rollup }, { data: dna }, { data: accounts }, { data: collabsRaw }, { data: cachedSug }] = await Promise.all([
    supabase.from('creator_rollups').select('*').eq('creator_id', creator.id).maybeSingle(),
    supabase.from('content_dna').select('*').eq('creator_id', creator.id).maybeSingle(),
    supabase.from('connected_accounts').select('id, platform, status, last_synced_at, sync_frozen').eq('creator_id', creator.id),
    admin.from('collabs').select('id, campaigns(title)').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(20),
    admin.from('ai_insights').select('input_hash, suggestions').eq('creator_id', creator.id).eq('period', 'growth_suggestions').maybeSingle(),
  ])
  const collabs = (collabsRaw ?? []).map((c) => ({ id: c.id as string, title: ((c.campaigns as any)?.title as string) || 'Collaboration' }))
  const hasData = Boolean(rollup || dna)
  // Show cached growth suggestions only when they still match the current data.
  const sugHash = crypto.createHash('sha256').update(JSON.stringify({ rollup, dna })).digest('hex')
  const freshSuggestions = cachedSug?.input_hash === sugHash && Array.isArray(cachedSug.suggestions)
    ? (cachedSug.suggestions as any[]) : []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>Creator Studio</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>Your private growth workspace.</p>
      </header>

      {readOnly && (
        <div className="card" style={{ padding: '13px 16px', background: 'var(--warn-tint)', border: '1px solid rgba(178,106,30,.22)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--warn-deep)' }}>Read-only — Creator Pro lapsed</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 0' }}>
            Your historical analytics stay visible. Renew Creator Pro to resume syncing and new reports.
          </p>
        </div>
      )}

      <StudioNav active={tab} />

      {tab === 'insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {flags.connectedCreator && (
            <ConnectAccounts
              accounts={accounts ?? []} readOnly={readOnly}
              connectable={(['youtube', 'instagram', 'tiktok'] as Platform[]).filter(platformConnectable)}
            />
          )}
          <InsightsPanel rollup={rollup} dna={dna} />
          {flags.aiGrowthCoach && <GrowthSuggestions initial={freshSuggestions} hasData={hasData} />}
          {flags.aiGrowthCoach && <BrandCoachPanel collabs={collabs} />}
        </div>
      )}

      {tab === 'content-lab' && (flags.aiGrowthCoach ? <ContentLab /> : <ComingSoon label="Content Lab" />)}
      {tab === 'reports' && (await ReportsTab(creator.id))}
    </div>
  )
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>{label} is coming soon to your Studio.</p>
    </div>
  )
}

async function ReportsTab(creatorId: string) {
  const admin = createAdminClient()
  const { data: reports } = await admin.from('ai_reports')
    .select('period_start, period_end, report, created_at').eq('creator_id', creatorId)
    .order('period_end', { ascending: false }).limit(12)
  if (!reports?.length) {
    return <EmptyState icon={FileText} title="Weekly reports appear here" body="Once your accounts are syncing, Collabr generates a weekly report — top posts, what worked, and your next actions." />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reports.map((r, i) => (
        <div key={i} className="card" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ fontSize: 10.5, color: 'var(--ink-faint-solid)' }}>{r.period_start} → {r.period_end}</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{(r.report as any)?.text || ''}</pre>
        </div>
      ))}
    </div>
  )
}
