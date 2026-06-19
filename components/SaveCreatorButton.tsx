'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Bookmark } from 'lucide-react'

interface Props {
  creatorId: string
  initialSaved: boolean
  compact?: boolean
}

export default function SaveCreatorButton({ creatorId, initialSaved, compact = false }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const res = saved
      ? await fetch(`/api/saved-creators?creator_id=${creatorId}`, { method: 'DELETE' })
      : await fetch('/api/saved-creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creator_id: creatorId }),
        })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Something went wrong')
    } else {
      setSaved(!saved)
      toast.success(saved ? 'Removed from saved creators' : 'Creator saved')
      router.refresh()
    }
    setBusy(false)
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={saved ? 'Unsave creator' : 'Save creator'}
        style={{
          border: '1px solid var(--line-strong)',
          background: saved ? 'var(--accent-tint)' : 'var(--surface)',
          color: saved ? 'var(--accent-deep)' : 'var(--ink-faint-solid)',
          width: 28, height: 28, borderRadius: 7,
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          transition: 'all .14s ease', flexShrink: 0,
        }}
      >
        <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
      </button>
    )
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} className="btn-secondary">
      <Bookmark className="bc-save-icon" size={14} fill={saved ? 'currentColor' : 'none'} />
      {saved ? 'Saved' : 'Save creator'}
    </button>
  )
}
