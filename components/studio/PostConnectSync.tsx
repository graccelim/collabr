'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// After an account connects, the OAuth callback redirects here instantly (no
// inline sync). This runs the first sync on-page with a proper loading UI, then
// refreshes so the insights appear. Reads ?connected=<platform> from the URL.
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
const STEPS = ['Pulling your latest posts', 'Analysing your content', 'Building your insights']

type Acct = { id: string; platform: string; status: string }

export default function PostConnectSync({ accounts }: { accounts: Acct[] }) {
  const router = useRouter()
  const [phase, setPhase] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [acct, setAcct] = useState<Acct | null>(null)
  const [label, setLabel] = useState('your account')
  const [step, setStep] = useState(0)
  const started = useRef(false)

  const runSync = useCallback(async (a: Acct, lbl: string) => {
    setAcct(a); setLabel(lbl); setPhase('syncing')
    try {
      const res = await fetch(`/api/connected/${a.id}`, { method: 'POST' })
      if (!res.ok) throw new Error('sync failed')
      window.history.replaceState(null, '', '/studio?tab=insights')
      setPhase('idle')
      router.refresh()
    } catch {
      setPhase('error')
    }
  }, [router])

  useEffect(() => {
    if (started.current) return
    const connected = new URLSearchParams(window.location.search).get('connected')
    if (!connected) return
    const a = accounts.find((x) => x.platform === connected && x.status === 'connected')
    if (!a) return
    started.current = true
    runSync(a, LABEL[connected] || connected)
  }, [accounts, runSync])

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
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.5 }}>That took longer than expected. Give it another go, or head in and your data will finish loading shortly.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <button type="button" onClick={() => acct && runSync(acct, label)} className="btn-primary btn-sm">Try again</button>
              <button type="button" onClick={dismiss} className="btn-secondary btn-sm">Go to Studio</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
