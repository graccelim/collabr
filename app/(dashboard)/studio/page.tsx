import { requireCreator } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { studioAccess } from '@/lib/entitlements'
import { flags } from '@/lib/flags'
import CreatorProPanel from '@/components/CreatorProPanel'
import StudioNav from '@/components/studio/StudioNav'
import BackButton from '@/components/BackButton'
import InsightsPanel from '@/components/studio/InsightsPanel'
import ConnectAccounts from '@/components/studio/ConnectAccounts'
import ContentLab from '@/components/studio/ContentLab'
import BrandCoachPanel from '@/components/studio/BrandCoachPanel'
import ReportsTab from '@/components/studio/ReportsTab'
import MockBanner from '@/components/MockBanner'
import { platformConnectable } from '@/lib/analytics/oauth'
import type { Platform } from '@/lib/analytics/adapters/types'
import { Lock } from 'lucide-react'

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
        <BackButton />
        <header>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>Creator Studio</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>
            Your growth workspace — connect your socials, see your strengths, and get proactive AI growth suggestions. A Creator Pro feature.
          </p>
        </header>
        {flags.creatorPro ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}><CreatorProPanel returnTo="/studio" /></div>
        ) : (
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
  const [{ data: accounts }, { data: collabsRaw }, { data: platformInsights }, { data: reports }] = await Promise.all([
    supabase.from('connected_accounts').select('id, platform, status, last_synced_at, sync_frozen').eq('creator_id', creator.id),
    admin.from('collabs').select('id, campaigns(title)').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('creator_platform_insights').select('platform, data, ai_narrative').eq('creator_id', creator.id),
    admin.from('ai_reports').select('period_start, period_end, report').eq('creator_id', creator.id).order('period_end', { ascending: false }).limit(12),
  ])
  const collabs = (collabsRaw ?? []).map((c) => ({ id: c.id as string, title: ((c.campaigns as any)?.title as string) || 'Collaboration' }))

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <BackButton />
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>Creator Studio</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>Your private growth workspace.</p>
      </header>

      <MockBanner />

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
          <InsightsPanel platformInsights={platformInsights ?? []} />
          {flags.analyticsAi && <BrandCoachPanel collabs={collabs} />}
        </div>
      )}

      {tab === 'content-lab' && (flags.analyticsAi ? <ContentLab /> : <ComingSoon label="Content Lab" />)}
      {tab === 'reports' && <ReportsTab platformInsights={platformInsights ?? []} reports={reports ?? []} />}
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

