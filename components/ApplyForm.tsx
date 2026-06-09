'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Props {
  campaignId: string
  creatorId: string
  isPaid: boolean
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
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="text-sm font-medium text-gray-900">Apply for this campaign</h2>

      <div>
        <label className="label">Your pitch</label>
        <textarea
          className="input min-h-[100px] resize-y"
          value={pitch}
          onChange={e => setPitch(e.target.value)}
          placeholder="Tell the brand why you're the right fit. Be specific about your audience and past work."
          required
        />
        <p className="text-xs text-gray-400 mt-1">{pitch.length} / 500 characters</p>
      </div>

      {isPaid && (
        <div>
          <label className="label">Your rate (S$) — optional</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">S$</span>
            <input
              type="number"
              min="0"
              step="1"
              className="input pl-9"
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="Leave blank to negotiate"
            />
          </div>
        </div>
      )}

      <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send application'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Your collabr. profile will be shared with the brand.
      </p>
    </form>
  )
}
