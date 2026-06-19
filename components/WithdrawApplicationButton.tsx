'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

/**
 * Lets a creator withdraw their own still-open application (pending/shortlisted).
 * Asks for confirmation first; the server enforces the allowed states.
 */
export default function WithdrawApplicationButton({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function withdraw() {
    if (!window.confirm('Withdraw this application? You won’t be able to re-apply to this campaign.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Application withdrawn')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not withdraw')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={withdraw} disabled={busy}
      style={{ border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {busy ? 'Withdrawing…' : 'Withdraw'}
    </button>
  )
}
