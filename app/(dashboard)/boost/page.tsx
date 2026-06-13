'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Zap, Star, TrendingUp, BadgeCheck, Eye } from 'lucide-react'

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

  async function purchase(type: 'monthly' | 'per_app') {
    setLoading(type)
    const res = await fetch('/api/payments/boost-creator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Purchase failed'); setLoading(null); return }
    setBoostUntil(data.boost_active_until)
    toast.success('Boost activated!')
    setLoading(null)
  }

  const BENEFITS: { label: string; icon: typeof Zap }[] = [
    { label: 'Top of every applicant list', icon: TrendingUp },
    { label: 'A “Boosted” badge on your profile', icon: BadgeCheck },
    { label: 'Brands notice you first', icon: Eye },
    { label: 'No limit on applications', icon: Zap },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* hero */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: 'var(--shadow)',
        }}>
          <Zap size={26} />
        </div>
        <h1 style={{ fontSize: 28 }}>Get picked first with Boost</h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, maxWidth: 460, margin: '8px auto 0', lineHeight: 1.55 }}>
          Boosted creators sit at the top of every brand&rsquo;s applicant list and wear a badge brands trust.
        </p>
      </div>

      {/* Active status */}
      {!fetching && isActive && (
        <div className="card" style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-2)', marginBottom: 28 }}>
          <p style={{ fontSize: 14, fontWeight: 560, color: 'var(--accent-deep)' }}>Boost is active</p>
          <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 3 }}>
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining · expires {new Date(boostUntil!).toLocaleDateString('en-SG')}
          </p>
        </div>
      )}

      {/* Pricing options */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {([
          { type: 'per_app' as const, t: 'Per application', price: 'S$4', unit: '7 days priority', note: 'Best for one campaign you really want.', best: false },
          { type: 'monthly' as const, t: 'Monthly', price: 'S$20', unit: '30 days priority', note: "Best if you're actively applying to several.", best: true },
        ]).map(p => (
          <div key={p.type} className="card" style={{
            padding: 24, position: 'relative', display: 'flex', flexDirection: 'column',
            border: p.best ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            boxShadow: p.best ? 'var(--shadow)' : 'var(--shadow-sm)',
          }}>
            {p.best && (
              <div style={{ position: 'absolute', top: -11, left: 24 }}>
                <span className="badge" style={{ background: 'var(--accent)', color: '#fff' }}>
                  <Star size={12} /> Best value
                </span>
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{p.t}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="mono-num" style={{ fontSize: 36, fontWeight: 600 }}>{p.price}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>· {p.unit}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '10px 0 18px', lineHeight: 1.5, flex: 1 }}>{p.note}</p>
            <button
              onClick={() => purchase(p.type)}
              disabled={!!loading}
              className={p.best ? 'btn-primary btn-block' : 'btn-secondary btn-block'}
            >{loading === p.type ? 'Activating…' : `Boost — ${p.price}`}</button>
          </div>
        ))}
      </div>

      {/* What boost does */}
      <div className="card" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>What Boost does</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {BENEFITS.map(({ label, icon: Icon }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: 'var(--accent-tint)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', textAlign: 'center', marginTop: 20 }}>
        During beta, boosts are activated instantly. Card payment will be required from v1.0.
      </p>
    </div>
  )
}
