'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'

interface Props {
  hasConnectId: boolean
  justCompleted: boolean
  needsRefresh: boolean
}

export default function ConnectOnboarding({ hasConnectId, justCompleted, needsRefresh }: Props) {
  const [loading, setLoading] = useState(false)

  async function startOnboarding() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
      setLoading(false)
    }
  }

  if (justCompleted) {
    return (
      <div className="card bg-teal-50 border-teal-200">
        <p className="text-xs text-teal-600 font-medium mb-1">Payouts active</p>
        <p className="text-xs text-teal-500">
          Your Stripe account is connected. Payments will be transferred automatically when brands confirm your live posts.
        </p>
      </div>
    )
  }

  if (hasConnectId && !needsRefresh) {
    return (
      <div className="card bg-teal-50 border-teal-200">
        <p className="text-xs text-teal-600 font-medium mb-1">Payout account connected</p>
        <p className="text-xs text-teal-500">
          Payments are transferred to your Stripe account after brand confirmation.{' '}
          <button onClick={startOnboarding} className="underline hover:no-underline">
            Update payout details
          </button>
        </p>
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: 'var(--radius)', padding: 18,
      background: 'var(--warn-tint)', border: '1px solid var(--warn)',
      borderLeft: '4px solid var(--warn)',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: 'var(--warn)', color: '#fff', display: 'grid', placeItems: 'center' }}>
        <AlertTriangle size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-deep)' }}>Connect your payout account to get paid</div>
        <div style={{ fontSize: 12.5, color: 'var(--warn-deep)', opacity: .85, lineHeight: 1.45, marginTop: 1 }}>
          You haven&rsquo;t connected Stripe yet, payments can&rsquo;t reach you until you do. Takes about 2 minutes.
        </div>
      </div>
      <button onClick={startOnboarding} disabled={loading} className="btn-primary" style={{ flexShrink: 0 }}>
        {loading ? 'Redirecting…' : 'Connect payouts'}
      </button>
    </div>
  )
}
