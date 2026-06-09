'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import StripePaymentButton from './StripePaymentButton'

interface Props {
  collabId: string
  collabStatus: string
  isBrand: boolean
  agreedRate: number
  creatorName: string
  stripePaymentIntentId: string | null
  creatorHasConnect: boolean
  livePostUrl: string | null
}

export default function CollabActions({
  collabId, collabStatus, isBrand, agreedRate, creatorName,
  stripePaymentIntentId, creatorHasConnect, livePostUrl,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  async function confirmLive() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/confirm-live`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Payment released to creator!')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setConfirming(false)
    }
  }

  // Brand: collab briefed → needs to pay to lock in escrow
  if (isBrand && collabStatus === 'briefed' && !stripePaymentIntentId) {
    if (!creatorHasConnect) {
      return (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-700 font-medium mb-1">Waiting on creator</p>
          <p className="text-xs text-amber-600">
            {creatorName} hasn't connected a payout account yet. Payment will be available once they do.
          </p>
        </div>
      )
    }
    return (
      <div className="card">
        <p className="text-sm font-medium text-gray-900 mb-1">Lock in escrow to start</p>
        <p className="text-xs text-gray-500 mb-4">
          Funds are held securely and only released to {creatorName} after you confirm their live post.
        </p>
        <StripePaymentButton
          collabId={collabId}
          amountCents={agreedRate}
          label={`collabr. — ${creatorName}`}
          onSuccess={() => router.refresh()}
        />
      </div>
    )
  }

  // Brand: payment already made, waiting on creator
  if (isBrand && collabStatus === 'briefed' && stripePaymentIntentId) {
    return (
      <div className="card bg-teal-50 border-teal-200">
        <p className="text-xs text-teal-600 font-medium mb-1">Escrow active</p>
        <p className="text-xs text-teal-500">Funds are held and will release to {creatorName} once you confirm the live post.</p>
      </div>
    )
  }

  // Brand: live post submitted → confirm to release payment
  if (isBrand && collabStatus === 'live_submitted') {
    return (
      <div className="card">
        <p className="text-sm font-medium text-gray-900 mb-1">Confirm live post to release payment</p>
        {livePostUrl && (
          <a href={livePostUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-purple-600 underline mb-3 block">View {creatorName}'s post →</a>
        )}
        <p className="text-xs text-gray-500 mb-4">
          Once you confirm, the payment is captured and sent to {creatorName}. This cannot be undone.
        </p>
        <button onClick={confirmLive} disabled={confirming} className="btn-primary">
          {confirming ? 'Releasing…' : 'Confirm & release payment'}
        </button>
      </div>
    )
  }

  return null
}
