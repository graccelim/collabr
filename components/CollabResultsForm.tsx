'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BarChart3 } from 'lucide-react'

// Creator self-reports their post's real metrics for a completed/live collab.
// Free feature; numbers are shown to the brand labelled "self-reported".
type Existing = { views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null } | null

const FIELDS: { key: 'views' | 'likes' | 'comments' | 'shares' | 'saves'; label: string }[] = [
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
]

export default function CollabResultsForm({ collabId, existing }: { collabId: string; existing?: Existing }) {
  const router = useRouter()
  const init = (k: string) => {
    const v = existing ? (existing as any)[k] : null
    return v == null ? '' : String(v)
  }
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, init(f.key)])),
  )
  const [busy, setBusy] = useState(false)

  const num = (s: string): number | null => {
    const t = s.replace(/[, ]/g, '').trim()
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }
  const hasAny = FIELDS.some((f) => num(vals[f.key]) != null)

  async function submit() {
    if (busy) return
    if (!hasAny) return toast.error('Add at least one number.')
    setBusy(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/results`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, num(vals[f.key])]))),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast.success(existing ? 'Results updated' : 'Results added'); router.refresh() }
      else toast.error(data.error || 'Could not save your results.')
    } catch { toast.error('Could not save your results.') }
    setBusy(false)
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <BarChart3 size={16} style={{ color: 'var(--accent-deep, #2A3157)' }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{existing ? 'Update your results' : 'Add your results'}</h3>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Share how your post did so {`the brand`} can see the results. It only takes a minute and makes you far more likely to get booked again.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }} className="resp-stats">
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>{f.label}</span>
            <input className="input" inputMode="numeric" placeholder="0" value={vals[f.key]}
              onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.value }))}
              style={{ fontSize: 14 }} />
          </label>
        ))}
      </div>

      <button type="button" onClick={submit} disabled={busy} className="btn-primary" style={{ marginTop: 14 }}>
        {busy ? 'Saving…' : existing ? 'Update results' : 'Add results'}
      </button>
      <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', margin: '10px 0 0' }}>
        These are self-reported and shown to the brand as such.
      </p>
    </div>
  )
}
