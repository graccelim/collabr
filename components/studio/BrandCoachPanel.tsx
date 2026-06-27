'use client'
import { useState } from 'react'
import { Briefcase, Sparkles } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

export interface CoachCollab { id: string; title: string }

// Collaboration analysis — grounded read of one of the creator's own collabs. Calls
// /api/insights/brand-coach (Pro + AI gated). Self-referential, guides not predicts.
export default function BrandCoachPanel({ collabs }: { collabs: CoachCollab[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!collabs.length) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Your collaborations show up here"
        body="Once you have collaborations, tap Analyse on any of them for tailored advice, why it fits you, what to showcase, negotiation points and risks, all from your own history."
      />
    )
  }

  async function analyze(collabId: string) {
    setLoading(collabId); setErr(null); setOpenId(collabId)
    try {
      const res = await fetch('/api/insights/brand-coach', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ collabId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.analysis) setResults((r) => ({ ...r, [collabId]: data.analysis }))
      else setErr(res.status === 503 ? 'Collaboration analysis is being set up. Check back soon.' : data.error || 'Could not analyse.')
    } catch { setErr('Could not analyse.') }
    setLoading(null)
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Recent collaborations</h3>
      {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #B23A33)', marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {collabs.map((c) => (
          <div key={c.id} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => analyze(c.id)} disabled={loading === c.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} /> {loading === c.id ? 'Analysing…' : 'Analyse'}
              </button>
            </div>
            {openId === c.id && results[c.id] && (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', marginTop: 12, background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>{results[c.id]}</pre>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 12 }}>
        Advice is based on your own history and may not guarantee results.
      </p>
    </div>
  )
}
