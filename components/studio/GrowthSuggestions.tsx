'use client'
import { useState } from 'react'
import { Sparkles, Lightbulb, RefreshCw } from 'lucide-react'

export interface GrowthSuggestion { title: string; why: string; evidence: string; action: string }

// Proactive AI growth insights from the creator's OWN data (replaces the chat).
// Server passes cached suggestions when fresh; otherwise the creator generates them
// with one click. No typing, no conversation.
export default function GrowthSuggestions({ initial, hasData }: {
  initial: GrowthSuggestion[]
  hasData: boolean
}) {
  const [items, setItems] = useState<GrowthSuggestion[]>(initial)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function generate() {
    if (loading) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/insights/suggestions', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setItems(Array.isArray(data.suggestions) ? data.suggestions : [])
      else setErr(res.status === 503 ? 'AI insights are being set up — check back soon.' : data.error || 'Could not generate insights.')
    } catch { setErr('Could not generate insights.') }
    setLoading(false)
  }

  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Sparkles size={16} color="var(--accent)" />
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>AI Growth Suggestions</h3>
        {items.length > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={generate} disabled={loading}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={12} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', margin: '0 0 14px' }}>
        Generated from your own performance — never compared to other creators.
      </p>

      {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #B23A33)', marginBottom: 10 }}>{err}</div>}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <Lightbulb size={22} color="var(--ink-faint-solid)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
            {hasData ? 'Generate personalised insights from your synced performance.' : 'Connect accounts and let posts sync to unlock insights.'}
          </p>
          <button type="button" className="btn-primary" onClick={generate} disabled={loading || !hasData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> {loading ? 'Generating…' : 'Generate insights'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((s, i) => (
            <div key={i} className="card" style={{ padding: '13px 15px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
              {s.why && <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 5px', lineHeight: 1.5 }}><strong style={{ color: 'var(--ink)' }}>Why:</strong> {s.why}</p>}
              {s.evidence && <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', margin: '0 0 5px', lineHeight: 1.5 }}><strong>Your data:</strong> {s.evidence}</p>}
              {s.action && <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0, fontWeight: 600 }}>→ {s.action}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
