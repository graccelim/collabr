'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

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
    <div className="card border-amber-200 bg-amber-50">
      <p className="text-xs text-amber-700 font-medium mb-1">Set up payouts to get paid</p>
      <p className="text-xs text-amber-600 mb-3">
        Connect your bank account via Stripe to receive payments directly when collabs complete.
        Takes about 2 minutes.
      </p>
      <button
        onClick={startOnboarding}
        disabled={loading}
        className="btn-primary text-sm"
      >
        {loading ? 'Redirecting…' : 'Set up payouts with Stripe'}
      </button>
    </div>
  )
}
