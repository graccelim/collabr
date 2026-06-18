'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react'
import AuthShell from '@/components/AuthShell'

export default function ResetPasswordPage() {
  const router = useRouter()
  // 'checking' until we confirm a recovery session exists; 'invalid' if the
  // link is bad/expired; 'ready' shows the form.
  const [phase, setPhase] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

  useEffect(() => {
    const supabase = createClient()
    let resolved = false
    const ready = () => { resolved = true; setPhase('ready') }

    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    // An expired/used/invalid link comes back with an error in the URL.
    if (search.get('error') || search.get('error_description') || hash.get('error') || hash.get('error_description')) {
      setPhase('invalid')
      return
    }

    // SECURITY: we must NEVER reset whatever account happens to already be signed
    // in on this browser. Only treat the session as a recovery session if auth
    // actually happened on THIS page load:
    //
    //  - verified=1: the server token_hash flow (/auth/confirm) just verified the
    //    recovery token and set the correct user's session, then redirected here.
    //  - SIGNED_IN / PASSWORD_RECOVERY: the PKCE `?code` was exchanged on load for
    //    the link's user (this fires even if a different user was signed in
    //    before — the exchange replaces the session).
    //
    // A bare pre-existing session (INITIAL_SESSION) is intentionally ignored.
    if (search.get('verified') === '1') {
      supabase.auth.getSession().then(({ data }) => { data.session ? ready() : setPhase('invalid') })
      return
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') ready()
    })

    // If no recovery auth happened, the link is missing/invalid/expired.
    const t = setTimeout(() => { if (!resolved) setPhase('invalid') }, 4000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'idle') return
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setStatus('loading')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { toast.error(error.message); setStatus('idle'); return }
    setStatus('success')
    toast.success('Password updated')
    router.push('/dashboard')
    router.refresh()
  }

  const busy = status !== 'idle'

  return (
    <AuthShell>
      {phase === 'checking' ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p style={{ marginTop: 14, fontSize: 14.5, color: 'var(--ink-soft)' }}>Verifying your reset link…</p>
        </div>
      ) : phase === 'invalid' ? (
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--warn-tint)', color: 'var(--warn-deep)', marginBottom: 18 }}>
            <AlertCircle size={20} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>This link has expired</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 24 }}>
            Your password reset link is invalid or has expired. Request a fresh one and we&rsquo;ll email it right over.
          </p>
          <Link href="/forgot-password" className="btn-primary btn-lg btn-block" style={{ justifyContent: 'center' }}>
            Request a new link <ArrowRight size={16} />
          </Link>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 530 }}>Back to sign in</Link>
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--accent-tint)', color: 'var(--accent-deep)', marginBottom: 18 }}>
            <KeyRound size={20} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Set a new password</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 28 }}>
            Choose a strong password you don&rsquo;t use anywhere else.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>New password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                disabled={busy}
                autoComplete="new-password"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Confirm password</span>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••••"
                required
                disabled={busy}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy}>
              {status === 'success' ? (
                <><Loader2 size={16} className="animate-spin" /> Signing you in…</>
              ) : status === 'loading' ? (
                <><Loader2 size={16} className="animate-spin" /> Updating…</>
              ) : (
                <>Update password <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 18 }}>
            <ShieldCheck size={13} /> Your password is encrypted and never shared.
          </p>
        </>
      )}
    </AuthShell>
  )
}
