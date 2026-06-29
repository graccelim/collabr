'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import PlatformSwitcher from '@/components/studio/PlatformSwitcher'
import StrategistPanel from '@/components/studio/StrategistPanel'
import type { StrategyOutput } from '@/lib/ai/service'

// The Strategy tab — per-platform AI strategist (reasoning beyond the deterministic
// facts). Numbers live in Insights; this is where the direction lives. The game
// plan is generated on demand (when this tab is opened and it isn't ready yet),
// so connect/sync stays fast and the plan loads here with its own loading UI.
const ORDER = ['tiktok', 'instagram', 'youtube']
const GEN_STEPS = ['Reading your whole account', 'Spotting what matters', 'Writing your game plan']
type Row = { platform: string; data: any; ai_narrative: string | null; ai_strategy?: StrategyOutput | null }

export default function StrategyTab({ platformInsights, onDraft, active = false }: { platformInsights: Row[]; onDraft?: (topic: string, platform: string) => void; active?: boolean }) {
  const router = useRouter()
  const rows = [...platformInsights].sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform))
  const [activePlatform, setActivePlatform] = useState(rows[0]?.platform ?? '')
  const [gen, setGen] = useState<'idle' | 'loading' | 'error'>('idle')
  const [step, setStep] = useState(0)
  const tried = useRef<Set<string>>(new Set())

  const row = rows.find((r) => r.platform === activePlatform) ?? rows[0]
  const needsPlan = !!row && !!row.data && !row.ai_strategy

  // When the tab is open and this platform has no game plan yet, generate it once.
  useEffect(() => {
    if (!active || !row || !needsPlan) return
    if (tried.current.has(row.platform)) return
    tried.current.add(row.platform)
    setGen('loading')
    fetch('/api/insights/strategy', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: row.platform }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => { setGen('idle'); router.refresh() })
      .catch(() => setGen('error'))
  }, [active, row, needsPlan, router])

  useEffect(() => {
    if (gen !== 'loading') return
    setStep(0)
    const id = setInterval(() => setStep((s) => (s + 1) % GEN_STEPS.length), 2000)
    return () => clearInterval(id)
  }, [gen])

  function retry() {
    if (!row) return
    tried.current.delete(row.platform)
    setGen('loading')
    fetch('/api/insights/strategy', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: row.platform }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => { setGen('idle'); router.refresh() })
      .catch(() => setGen('error'))
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={Wand2}
        title="Your strategist appears once accounts sync"
        body="Connect a platform and sync your posts. The strategist reads your whole account, surfaces hidden patterns, flags risks, and lays out experiments to run, beyond what the charts show."
        steps={['Connect an account', 'We read your whole account', 'Get personalised direction']}
      />
    )
  }

  const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }

  return (
    <div>
      {rows.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <PlatformSwitcher platforms={rows.map((r) => r.platform)} active={row!.platform} onSelect={setActivePlatform} />
        </div>
      )}

      {needsPlan ? (
        <div style={{ ...CARD, padding: '34px 24px', textAlign: 'center' }}>
          {gen === 'error' ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Your game plan is taking a moment</div>
              <div style={{ fontSize: 13, color: '#545A66', marginTop: 6, lineHeight: 1.5, maxWidth: 380, marginInline: 'auto' }}>Give it another go, your insights are already in the Insights tab.</div>
              <button type="button" onClick={retry} className="btn-primary btn-sm" style={{ marginTop: 16 }}>Try again</button>
            </>
          ) : (
            <>
              <div style={{ width: 40, height: 40, margin: '0 auto 16px', borderRadius: 999, border: '3px solid rgba(20,30,80,.12)', borderTopColor: '#4B43C8', animation: 'cp-spin .8s linear infinite' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Writing your game plan</div>
              <div style={{ fontSize: 13, color: '#8A909C', marginTop: 6, minHeight: 18 }}>{GEN_STEPS[step]}…</div>
            </>
          )}
        </div>
      ) : (
        <StrategistPanel
          key={row!.platform}
          strategy={row!.ai_strategy ?? null}
          onDraft={onDraft ? (topic) => onDraft(topic, row!.platform) : undefined}
        />
      )}
    </div>
  )
}
