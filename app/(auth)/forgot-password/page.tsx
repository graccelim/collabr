'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, MailCheck } from 'lucide-react'
import AuthShell from '@/components/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    const supabase = createClient()
    // Production domain when configured; falls back to the current origin.
    // (With the token_hash recovery template this redirectTo is ignored; the
    // template's own ?next= controls where the link lands.)
    const base = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${base}/reset-password`,
    })
    if (error) {
      // Surface delivery/config errors so the user can retry; don't reveal
      // whether the email exists for any other case.
      const friendly = /sending.*email|recovery email/i.test(error.message)
        ? "We couldn't send the email right now. Please try again in a few minutes."
        : error.message
      toast.error(friendly)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <AuthShell>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--money-tint)', color: 'var(--money-deep)', marginBottom: 18 }}>
          <MailCheck size={20} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Check your email</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 28, lineHeight: 1.6 }}>
          If an account exists for <strong style={{ color: 'var(--ink)' }}>{email}</strong>, we&rsquo;ve sent a link to reset your password. It expires in 1 hour. Check your spam folder if it doesn&rsquo;t arrive.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-secondary btn-lg btn-block" style={{ justifyContent: 'center' }}>
          Use a different email
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 530 }}>Back to sign in</Link>
        </p>
      </AuthShell>
    )
  }

  const busy = status === 'loading'

  return (
    <AuthShell>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Reset your password</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 28 }}>
        Enter your email and we&rsquo;ll send you a secure link to set a new password.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
        <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? (
            <><Loader2 size={16} className="animate-spin" /> Sending…</>
          ) : (
            <>Send reset link <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
        Remembered it?{' '}
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 530 }}>Sign in</Link>
      </p>
    </AuthShell>
  )
}
