'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Send } from 'lucide-react'

interface CampaignOption {
  id: string
  title: string
}

interface Props {
  creatorId: string
  creatorName: string
  campaigns: CampaignOption[]
  /** Campaign ids that already have a pending invite for this creator. */
  pendingCampaignIds: string[]
}

export default function InviteCreatorForm({ creatorId, creatorName, campaigns, pendingCampaignIds }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || '')
  const [rate, setRate] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const first = creatorName.split(' ')[0]

  if (campaigns.length === 0) {
    return (
      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          You need an active paid campaign to invite {first}.
        </p>
        <a href="/post-job" className="btn-primary btn-sm" style={{ marginTop: 10 }}>Post a campaign</a>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(rate) * 100)
    if (!campaignId) { toast.error('Pick a campaign'); return }
    if (!rate || !Number.isFinite(cents) || cents <= 0) {
      toast.error('Enter the rate you’re offering'); return
    }
    setSending(true)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_id: creatorId,
        campaign_id: campaignId,
        proposed_rate: cents,
        message: message.trim() || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not send invite')
      setSending(false)
      return
    }
    toast.success(`Invite sent to ${first}, you'll be notified when they respond`)
    setOpen(false)
    setRate(''); setMessage('')
    setSending(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Send size={14} />
        Invite to campaign
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3" style={{ width: '100%' }}>
      <h2 style={{ fontSize: 14, fontWeight: 600 }}>Invite {first} to a campaign</h2>
      <div>
        <label className="label">Campaign</label>
        <select className="input" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
          {campaigns.map(c => (
            <option key={c.id} value={c.id} disabled={pendingCampaignIds.includes(c.id)}>
              {c.title}{pendingCampaignIds.includes(c.id) ? ', invite pending' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Your offer (SGD)</label>
        <input className="input" type="number" min="1" step="1" value={rate}
          onChange={e => setRate(e.target.value)} placeholder="250" required />
        <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 4 }}>
          This becomes the escrowed deal value if {first} accepts.
        </p>
      </div>
      <div>
        <label className="label">Message, optional</label>
        <textarea className="input" style={{ minHeight: 70, resize: 'none' }} maxLength={1000}
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder={`Tell ${first} why they're a great fit.`} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? 'Sending…' : 'Send invite'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}
