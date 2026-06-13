'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'

interface Props {
  inviteId: string
}

export default function InviteActions({ inviteId }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)

  async function respond(action: 'accept' | 'decline') {
    if (busy) return
    setBusy(action)
    const res = await fetch(`/api/invites/${inviteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Something went wrong')
      setBusy(null)
      return
    }
    if (action === 'accept') {
      toast.success('Invite accepted — your collab has been created!')
      if (data.collab_id) {
        router.push(`/collabs/${data.collab_id}`)
        return
      }
    } else {
      toast.success('Invite declined')
    }
    router.refresh()
    setBusy(null)
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => respond('decline')}>
        {busy === 'decline' ? 'Declining…' : 'Decline'}
      </button>
      <button className="btn-success btn-sm" disabled={!!busy} onClick={() => respond('accept')}>
        <Check size={14} />
        {busy === 'accept' ? 'Accepting…' : 'Accept invite'}
      </button>
    </div>
  )
}
