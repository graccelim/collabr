'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Send } from 'lucide-react'

interface Props {
  campaignId: string
  creatorId: string
  isPaid: boolean
  brandName?: string
}

export default function ApplyForm({ campaignId, creatorId, isPaid }: Props) {
  const router = useRouter()
  const [pitch, setPitch] = useState('')
  const [rate, setRate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pitch.trim().length < 30) {
      toast.error('Pitch must be at least 30 characters')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: campaignId,
        pitch: pitch.trim(),
        proposed_rate: rate ? Math.round(parseFloat(rate) * 100) : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Application failed')
      setSubmitting(false)
      return
    }
    toast.success('Application sent!')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Apply for this campaign</h2>

      {/* Pitch */}
      <div>
        <label className="label" htmlFor="apply-pitch">Your pitch</label>
        <textarea
          id="apply-pitch"
          className="textarea"
          style={{ minHeight: 110 }}
          value={pitch}
          onChange={e => setPitch(e.target.value)}
          placeholder="I post weekly content to a Singapore audience that actually buys…"
          required
        />
        <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 7, lineHeight: 1.4 }}>
          Be specific about your audience and a past result. Brands skim, lead with why you fit.
        </p>
      </div>

      {/* Rate */}
      {isPaid && (
        <div>
          <label className="label" htmlFor="apply-rate">Your rate (S$), optional</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-faint-solid)', fontSize: 14, pointerEvents: 'none',
            }}>S$</span>
            <input
              id="apply-rate"
              type="number"
              min="0"
              step="1"
              className="input"
              style={{ paddingLeft: 36 }}
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="Leave blank to negotiate"
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 7, lineHeight: 1.4 }}>
            Leave blank to negotiate. The brand funds escrow at your agreed rate.
          </p>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
        disabled={submitting}
      >
        <Send size={16} />
        {submitting ? 'Sending…' : 'Send application'}
      </button>
    </form>
  )
}
