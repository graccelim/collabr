'use client'
import { useState } from 'react'
import { FlaskConical, Sparkles } from 'lucide-react'

const PLATFORMS = [
  ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['youtube', 'YouTube'],
  ['lemon8', 'Lemon8'], ['xhs', 'Xiaohongshu'], ['x', 'X'],
] as const

// AI Content Lab. Calls /api/insights/content-lab (Pro + AI gated). Graceful 503.
export default function ContentLab() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('tiktok')
  const [tone, setTone] = useState('')
  const [goal, setGoal] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function generate() {
    if (!topic.trim() || loading) return
    setLoading(true); setErr(null); setResult(null)
    try {
      const res = await fetch('/api/insights/content-lab', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), platform, tone: tone.trim() || undefined, goal: goal.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.result) setResult(data.result)
      else setErr(res.status === 503 ? 'Content Lab is being set up — check back soon.' : data.error || 'Could not generate ideas.')
    } catch { setErr('Could not generate ideas.') }
    setLoading(false)
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FlaskConical size={17} color="var(--accent)" />
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Content Lab</h3>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 14px' }}>
        Hooks, captions, CTAs, hashtags and video ideas for your next post — tailored to your own best-performing styles.
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic / idea (e.g. new ramen spot review)" style={{ fontSize: 14 }} />
        <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ fontSize: 14 }}>
            {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="input" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tone (optional)" style={{ fontSize: 14 }} />
        </div>
        <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (e.g. more saves, drive bookings) — optional" style={{ fontSize: 14 }} />
      </div>

      <button type="button" className="btn-primary" onClick={generate} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={14} /> {loading ? 'Generating…' : 'Generate ideas'}
      </button>

      {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #B23A33)', marginTop: 12 }}>{err}</div>}
      {result && (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)', marginTop: 14, background: 'var(--surface-2)', padding: 14, borderRadius: 10 }}>{result}</pre>
      )}
      <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 12 }}>
        Suggestions are based on available performance data and may not guarantee results.
      </p>
    </div>
  )
}
