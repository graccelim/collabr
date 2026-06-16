'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatSGD } from '@/lib/utils'

interface Props {
  disputeId: string
  agreedRate: number
}

type Outcome = 'creator_wins' | 'brand_wins' | 'split' | 'mutual'

const OUTCOME_LABELS: Record<Outcome, string> = {
  creator_wins: 'Creator wins, full payout to creator',
  brand_wins: 'Brand wins, payment refunded to brand',
  split: 'Split, partial payout',
  mutual: 'Mutual resolution, payment voided',
}

export default function DisputeResolutionForm({ disputeId, agreedRate }: Props) {
  const router = useRouter()
  const [outcome, setOutcome] = useState<Outcome | ''>('')
  const [splitPct, setSplitPct] = useState(50)
  const [ruling, setRuling] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const creatorAmount = outcome === 'creator_wins'
    ? agreedRate
    : outcome === 'split'
      ? Math.round(agreedRate * (splitPct / 100))
      : 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!outcome) { toast.error('Select an outcome'); return }
    if (!ruling.trim()) { toast.error('Platform ruling is required'); return }
    setSubmitting(true)
    const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome,
        split_percentage: outcome === 'split' ? splitPct : undefined,
        platform_ruling: ruling.trim(),
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Resolution failed'); setSubmitting(false); return }
    toast.success('Dispute resolved')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="text-sm font-medium text-gray-900">Resolve dispute</h2>

      <div>
        <label className="label">Outcome</label>
        <div className="space-y-2">
          {(Object.entries(OUTCOME_LABELS) as [Outcome, string][]).map(([val, label]) => (
            <label key={val} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${outcome === val ? 'border-purple-400 bg-purple-50' : 'border-border hover:border-gray-300'}`}>
              <input type="radio" name="outcome" value={val} checked={outcome === val}
                onChange={() => setOutcome(val)} className="mt-0.5" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {outcome === 'split' && (
        <div>
          <label className="label">Creator receives (%)</label>
          <input type="range" min={0} max={100} step={5} value={splitPct}
            onChange={e => setSplitPct(Number(e.target.value))} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Creator: {splitPct}% = {formatSGD(Math.round(agreedRate * (splitPct / 100)))}</span>
            <span>Brand: {100 - splitPct}%</span>
          </div>
        </div>
      )}

      {outcome && (
        <div className="bg-surface rounded-lg p-3 text-xs text-gray-600">
          Creator will receive: <strong>{formatSGD(creatorAmount)}</strong>
        </div>
      )}

      <div>
        <label className="label">Platform ruling</label>
        <textarea
          className="input min-h-[100px] resize-y"
          value={ruling}
          onChange={e => setRuling(e.target.value)}
          placeholder="Explain the decision. This will be shared with both parties."
          required
        />
      </div>

      <button type="submit" disabled={submitting || !outcome} className="btn-primary w-full justify-center">
        {submitting ? 'Resolving…' : 'Resolve dispute'}
      </button>
    </form>
  )
}
