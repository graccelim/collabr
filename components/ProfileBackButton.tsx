'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Back control for standalone profile pages. Returns the viewer to wherever they
 * came from: an explicit `from` (e.g. set when arriving from a campaign's
 * applicants) wins and gives a precise label; otherwise it walks the browser
 * history, falling back to `fallback` when there's nowhere to go back to.
 */
export default function ProfileBackButton({
  from, fallback = '/dashboard',
}: { from?: string; fallback?: string }) {
  const router = useRouter()
  const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : null
  const label = safeFrom?.startsWith('/campaigns/') ? 'Back to applicants'
    : safeFrom?.startsWith('/collabs/') ? 'Back to collab'
    : 'Back'

  function go() {
    if (safeFrom) { router.push(safeFrom); return }
    if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); return }
    router.push(fallback)
  }

  return (
    <button type="button" onClick={go}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-faint-solid)', background: 'none', border: 0, cursor: 'pointer', padding: 0, marginBottom: 28 }}>
      <ChevronLeft size={15} /> {label}
    </button>
  )
}
