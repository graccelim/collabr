'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function BoostPage() {
  const supabase = createClient()
  const [boostUntil, setBoostUntil] = useState<string | null>(null)
  const [loading, setLoading] = useState<'monthly' | 'per_app' | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('creator_profiles')
        .select('boost_active_until').eq('user_id', user.id).single()
      setBoostUntil(data?.boost_active_until || null)
      setFetching(false)
    }
    load()
  }, [])

  const isActive = boostUntil && new Date(boostUntil) > new Date()
  const daysLeft = isActive
    ? Math.ceil((new Date(boostUntil!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  async function purchase(plan: 'monthly' | 'per_app') {
    setLoading(plan)
    const res = await fetch('/api/payments/boost-creator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Purchase failed'); setLoading(null); return }
    setBoostUntil(data.boost_active_until)
    toast.success('Boost activated!')
    setLoading(null)
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Boost</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stand out to brands and get selected faster</p>
      </div>

      {/* Active status */}
      {!fetching && isActive && (
        <div className="card bg-purple-50 border-purple-200">
          <p className="text-sm font-medium text-purple-700">Boost is active</p>
          <p className="text-xs text-purple-500 mt-1">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</p>
          <p className="text-xs text-purple-400 mt-0.5">
            Expires {new Date(boostUntil!).toLocaleDateString('en-SG')}
          </p>
        </div>
      )}

      {/* What boost does */}
      <div className="card space-y-2">
        <h2 className="text-sm font-medium text-gray-900">What Boost does</h2>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li className="flex gap-2"><span className="text-purple-500">→</span> Your application appears at the top of every brand's applicant list</li>
          <li className="flex gap-2"><span className="text-purple-500">→</span> A "Boosted" badge appears on your profile and applications</li>
          <li className="flex gap-2"><span className="text-purple-500">→</span> Brands notice boosted creators first — especially useful during launch campaigns</li>
          <li className="flex gap-2"><span className="text-purple-500">→</span> No limit on how many campaigns you can apply to while boosted</li>
        </ul>
      </div>

      {/* Pricing options */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Per application</p>
            <p className="text-2xl font-semibold text-gray-900">S$4</p>
            <p className="text-xs text-gray-500 mt-1">7 days of priority placement</p>
            <p className="text-xs text-gray-400 mt-3">Best if you have a specific campaign in mind right now.</p>
          </div>
          <button
            onClick={() => purchase('per_app')}
            disabled={!!loading}
            className="btn-secondary mt-4 text-sm"
          >
            {loading === 'per_app' ? 'Activating…' : 'Buy — S$4'}
          </button>
        </div>

        <div className="card flex flex-col border-purple-300 bg-purple-50/30">
          <div className="flex-1">
            <p className="text-xs text-purple-600 mb-1 font-medium">Monthly · Best value</p>
            <p className="text-2xl font-semibold text-gray-900">S$20</p>
            <p className="text-xs text-gray-500 mt-1">30 days of priority placement</p>
            <p className="text-xs text-gray-400 mt-3">Best if you're actively looking for multiple collabs.</p>
          </div>
          <button
            onClick={() => purchase('monthly')}
            disabled={!!loading}
            className="btn-primary mt-4 text-sm"
          >
            {loading === 'monthly' ? 'Activating…' : 'Buy — S$20/mo'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        During beta, boosts are activated instantly. Card payment will be required from v1.0.
      </p>
    </div>
  )
}
