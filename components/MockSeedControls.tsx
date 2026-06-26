'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

// Dev-only seed controls (rendered inside MockBanner). Seeds/clears mock analytics
// for the logged-in profile via /api/dev/seed-analytics, then refreshes so every
// Studio tab (Insights · Reports) populates. Content Lab is on-demand (live AI).
export default function MockSeedControls() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function seed(density: 'rich' | 'thin' | 'reset') {
    if (busy) return
    setBusy(density)
    try {
      const res = density === 'reset'
        ? await fetch('/api/dev/seed-analytics', { method: 'DELETE' })
        : await fetch(`/api/dev/seed-analytics?density=${density}&pro=active`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast.success(density === 'reset' ? 'Mock data cleared' : `Seeded ${density} data`); router.refresh() }
      else toast.error(data.error || 'Seed failed')
    } catch { toast.error('Seed failed') }
    setBusy(null)
  }

  const btn: React.CSSProperties = {
    cursor: 'pointer', border: '1px solid rgba(178,106,30,.4)', background: 'rgba(255,255,255,.6)',
    color: 'var(--warn-deep, #8a531a)', fontSize: 11.5, fontWeight: 700, borderRadius: 8, padding: '5px 10px',
  }
  return (
    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
      <button type="button" style={btn} onClick={() => seed('rich')} disabled={!!busy}>{busy === 'rich' ? 'Seeding…' : 'Seed rich'}</button>
      <button type="button" style={btn} onClick={() => seed('thin')} disabled={!!busy}>{busy === 'thin' ? 'Seeding…' : 'Seed thin'}</button>
      <button type="button" style={btn} onClick={() => seed('reset')} disabled={!!busy}>{busy === 'reset' ? 'Clearing…' : 'Reset'}</button>
    </div>
  )
}
