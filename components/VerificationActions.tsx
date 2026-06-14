'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check, X } from 'lucide-react'

export default function VerificationActions({ socialId }: { socialId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  async function act(action: 'approve' | 'reject') {
    if (busy) return
    if (action === 'reject' && reason.trim().length < 3) { toast.error('Add a short reason'); return }
    setBusy(action)
    const res = await fetch(`/api/admin/verifications/${socialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: reason.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Failed'); setBusy(null); return }
    toast.success(action === 'approve' ? 'Verified' : 'Rejected')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rejecting && (
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          className="input"
          style={{ fontSize: 13 }}
        />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-success btn-sm" disabled={!!busy} onClick={() => act('approve')}>
          <Check size={14} /> {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        {rejecting ? (
          <button className="btn-danger btn-sm" disabled={!!busy} onClick={() => act('reject')}>
            {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
          </button>
        ) : (
          <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => setRejecting(true)}>
            <X size={14} /> Reject
          </button>
        )}
      </div>
    </div>
  )
}
