'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// After an account connects, the OAuth callback redirects here instantly (no
// inline sync). This runs the first sync on-page with a proper loading UI, then
// refreshes so the insights appear. Reads ?connected=<platform> from the URL.
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
const STEPS = ['Pulling your latest posts', 'Analysing your content', 'Building your insights', 'Writing your game plan']

type Acct = { id: string; platform: string; status: string }

export default function PostConnectSync({ accounts }: { accounts: Acct[] }) {
  const router = useRouter()
  const [phase, setPhase] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [label, setLabel] = useState('your account')
  const [step, setStep] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    const connected = new URLSearchParams(window.location.search).get('connected')
    if (!connected) return
    const acct = accounts.find((a) => a.platform === connected && a.status === 'connected')
    if (!acct) return
    started.current = true
    setLabel(LABEL[connected] || connected)
    setPhase('syncing')
    ;(async () => {
      try {
        const res = await fetch(`/api/connected/${acct.id}`, { method: 'POST' })
        if (!res.ok) throw new Error('sync failed')
        window.history.replaceState(null, '', '/studio?tab=insights')
        setPhase('idle')
        router.refresh()
      } catch {
        setPhase('error')
      }
    })()
  }, [accounts, router])

  useEffect(() => {
    if (phase !== 'syncing') return
    setStep(0)
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2000)
    return () => clearInterval(id)
  }, [phase])

  function dismiss() {
    window.history.replaceState(null, '', '/studio?tab=insights')
    setPhase('idle')
    router.refresh()
  }

  if (phase === 'idle') return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(8,10,30,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="card" style={{ width: 'min(420px, 100%)', padding: '32px 26px 30px', textAlign: 'center' }}>
        {phase === 'syncing' ? (
          <>
            <div style={{ width: 44, height: 44, margin: '0 auto 18px', borderRadius: 999, border: '3px solid var(--hairline, rgba(20,30,80,.12))', borderTopColor: 'var(--accent, #000435)', animation: 'cp-spin .8s linear infinite' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Setting up your {label}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 7, minHeight: 19 }}>{STEPS[step]}…</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 16 }}>This takes a few seconds. Hang tight.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Your {label} is connected</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.5 }}>We couldn&apos;t finish syncing just now. Open <strong>Manage</strong> and hit <strong>Sync now</strong> in a moment, or it will sync automatically soon.</div>
            <button type="button" onClick={dismiss} className="btn-primary btn-sm" style={{ marginTop: 18 }}>Go to Studio</button>
          </>
        )}
      </div>
    </div>
  )
}
