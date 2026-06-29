'use client'
import { useState } from 'react'
import { flags } from '@/lib/flags'
import ConnectAccounts, { type ConnectedAccountView } from '@/components/studio/ConnectAccounts'
import InsightsPanel from '@/components/studio/InsightsPanel'
import StrategyTab from '@/components/studio/StrategyTab'
import BrandCoachPanel from '@/components/studio/BrandCoachPanel'
import ContentLab from '@/components/studio/ContentLab'
import ReportsTab from '@/components/studio/ReportsTab'

// Client-side Studio tabs. All data is fetched ONCE on the server and passed in;
// switching tabs is pure local state (no navigation, no re-query), so it's instant.
// Panes stay mounted and toggle via `display`, preserving each tab's state.
type Row = { platform: string; data: any; ai_narrative: string | null; ai_strategy?: any }
type Report = { period_start: string; period_end: string; report: any }
const TABS: [string, string][] = [['insights', 'Insights'], ...(flags.analyticsAi ? [['strategy', 'Strategy'] as [string, string]] : []), ['content-lab', 'Content Lab'], ['reports', 'Reports']]

export default function StudioTabs({
  accounts, connectable, readOnly, platformInsights, reports, collabs, contentPlatforms = [], initial = 'insights',
}: {
  accounts: ConnectedAccountView[]
  connectable: string[]
  readOnly: boolean
  platformInsights: Row[]
  reports: Report[]
  collabs: { id: string; title: string }[]
  contentPlatforms?: string[]
  initial?: string
}) {
  const [tab, setTab] = useState(initial)

  function select(key: string) {
    setTab(key)
    // Keep the URL in sync for refresh/deep-link, without a Next navigation.
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `/studio?tab=${key}`)
  }

  return (
    <>
      <nav style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid var(--line)', marginBottom: 18, paddingBottom: 1 }}>
        {TABS.map(([key, label]) => {
          const on = tab === key
          return (
            <button key={key} type="button" onClick={() => select(key)}
              style={{
                fontSize: 13.5, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap', cursor: 'pointer',
                background: 'transparent', border: 'none', color: on ? 'var(--accent)' : 'var(--ink-soft)',
                padding: '9px 12px', borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`,
              }}>
              {label}
            </button>
          )
        })}
      </nav>

      <div style={{ display: tab === 'insights' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
        {flags.connectedCreator && <ConnectAccounts accounts={accounts} readOnly={readOnly} connectable={connectable} />}
        <InsightsPanel platformInsights={platformInsights} />
        {flags.analyticsAi && <BrandCoachPanel collabs={collabs} />}
      </div>

      {flags.analyticsAi && (
        <div style={{ display: tab === 'strategy' ? 'block' : 'none' }}>
          <StrategyTab platformInsights={platformInsights} />
        </div>
      )}

      <div style={{ display: tab === 'content-lab' ? 'block' : 'none' }}>
        {flags.analyticsAi ? <ContentLab platforms={contentPlatforms} /> : (
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>Content Lab is coming soon to your Studio.</p>
          </div>
        )}
      </div>

      <div style={{ display: tab === 'reports' ? 'block' : 'none' }}>
        <ReportsTab platformInsights={platformInsights} reports={reports} />
      </div>
    </>
  )
}
