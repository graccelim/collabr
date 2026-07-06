'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeNextPath } from '@/lib/nav'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2 } from 'lucide-react'
import AuthShell from '@/components/AuthShell'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  // After login, return to the page the visitor came from (?next=), falling back
  // to the dashboard. Sanitized to block open redirects.
  const next = safeNextPath(params.get('next'))
  const signupHref = next === '/dashboard' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  // Arriving from an expired/used verification link (auth/confirm redirects
  // here with ?error=link_expired). Offer a resend right on this page — an
  // unverified user cannot log in, so this must work without a session.
  const linkExpired = params.get('error') === 'link_expired'
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function resendVerification() {
    if (resending) return
    const target = email.trim()
    if (!/.+@.+\..+/.test(target)) {
      toast.error('Enter your email above first, then tap resend.')
      return
    }
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Could not resend. Try again later.'); setResending(false); return }
      setResent(true)
      toast.success('If that address has an unverified account, a fresh link is on its way.')
    } catch {
      toast.error('Network error — please try again.')
    }
    setResending(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'idle') return
    setStatus('loading')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setStatus('idle')
      return
    }
    setStatus('success')
    router.push(next)
    router.refresh()
  }

  const busy = status !== 'idle'

  return (
    <AuthShell>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Welcome back</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 28 }}>
        Log in and pick up right where you left off.
      </p>

      {linkExpired && (
        <div className="card" style={{ padding: '13px 16px', marginBottom: 20, background: 'var(--warn-tint, #FBF3E6)', border: '1px solid rgba(178,106,30,.25)' }}>
          <p style={{ fontSize: 13, color: 'var(--warn-deep, #8A5215)', margin: 0, lineHeight: 1.5 }}>
            That verification link has expired or was already used.{' '}
            {resent ? (
              <strong>A fresh link is on its way — check your inbox.</strong>
            ) : (
              <>
                Enter your email below, then{' '}
                <button type="button" onClick={resendVerification} disabled={resending}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 650, color: 'var(--warn-deep, #8A5215)', textDecoration: 'underline', font: 'inherit' }}>
                  {resending ? 'sending…' : 'resend the verification email'}
                </button>.
              </>
            )}
          </p>
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={busy}
            autoComplete="email"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Password</span>
            <Link href="/forgot-password" style={{ fontSize: 12.5, fontWeight: 530, color: 'var(--accent)' }}>
              Forgot password?
            </Link>
          </span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••"
            required
            disabled={busy}
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy}>
          {status === 'success' ? (
            <><Loader2 size={16} className="animate-spin" /> Taking you back…</>
          ) : status === 'loading' ? (
            <><Loader2 size={16} className="animate-spin" /> Logging in…</>
          ) : (
            <>Log in <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
        New here?{' '}
        <Link href={signupHref} style={{ color: 'var(--accent)', fontWeight: 530 }}>Create an account</Link>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
