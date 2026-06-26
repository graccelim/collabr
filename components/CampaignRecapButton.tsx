'use client'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'

// Generates/views the AI Campaign Recap (deterministic metrics in). Graceful 503/404.
export default function CampaignRecapButton({ campaignId }: { campaignId: string }) {
  const [recap, setRecap] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function generate() {
    if (loading) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/insights/campaign-recap', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.recap) setRecap(data.recap)
      else setErr(res.status === 503 ? 'AI recaps are being set up — check back soon.' : data.error || 'Could not generate a recap.')
    } catch { setErr('Could not generate a recap.') }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn-secondary btn-sm" onClick={generate} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={13} /> {loading ? 'Generating…' : recap ? 'Regenerate AI recap' : 'AI Campaign Recap'}
      </button>
      {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #B23A33)', marginTop: 8 }}>{err}</div>}
      {recap && (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', marginTop: 12, background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>{recap}</pre>
      )}
    </div>
  )
}
