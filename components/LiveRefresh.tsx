'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Lightweight near-live updates without a websocket: periodically re-fetches the
 * server components (notifications, invite badges, collab state) so new activity
 * appears without a manual browser refresh. Only fires while the tab is visible.
 */
export default function LiveRefresh({ seconds = 45 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') router.refresh()
    }
    const id = setInterval(tick, Math.max(15, seconds) * 1000)
    // Also refresh as soon as the tab regains focus.
    const onVisible = () => { if (document.visibilityState === 'visible') router.refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [router, seconds])
  return null
}
