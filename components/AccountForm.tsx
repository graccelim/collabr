'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, MailCheck, Check, Circle } from 'lucide-react'

/* Field wrapper per design: label · hint */
function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', lineHeight: 1.4 }}>{hint}</span>}
    </div>
  )
}

/**
 * The actual account-creation form - name/email/password/terms, submit,
 * "check your inbox" in place. Extracted so it can render in two places
 * without duplicating it: /signup (brand, always) and /join's "no existing
 * profile" outcome (creator, rendered directly there instead of bouncing
 * back to a separate signup page - that round trip was the exact "loopy"
 * feeling this exists to remove).
 */
export default function AccountForm({ role, next = '/dashboard' }: { role: 'brand' | 'creator'; next?: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const isBrand = role === 'brand'

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) { toast.error('Please tick the box to accept the terms'); return }
    if (status !== 'idle') return

    setStatus('loading')
    let res: Response
    let data: any
    try {
      res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      })
      data = await res.json().catch(() => ({}))
    } catch {
      toast.error('Network error — please check your connection and try again')
      setStatus('idle')
      return
    }
    if (!res.ok) { toast.error(data.error || 'Signup failed'); setStatus('idle'); return }
    if (data.requiresEmailVerification) {
      setStatus('sent')
      return
    }
    router.push(next)
    router.refresh()
  }

  async function resendVerification() {
    if (resending || resent) return
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Could not resend. Try again later.') }
      else { setResent(true); toast.success('A fresh link is on its way.') }
    } catch {
      toast.error('Network error — please try again.')
    }
    setResending(false)
  }

  if (status === 'sent') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{
          width: 52, height: 52, borderRadius: 14, background: 'var(--accent-tint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MailCheck size={26} style={{ color: 'var(--accent-deep)' }} />
        </span>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 560, letterSpacing: '-0.02em' }}>Check your inbox</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.6 }}>
            We sent a verification link to <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>.
            Click it and you&rsquo;ll land straight in your account — step 1 of your setup is already done.
          </p>
        </div>
        <div className="card" style={{ padding: '13px 16px', background: 'var(--paper-2)' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.55 }}>
            Nothing arriving? Check spam, or{' '}
            <button type="button" onClick={resendVerification} disabled={resending || resent}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--accent-deep)' }}>
              {resent ? 'sent ✓' : resending ? 'sending…' : 'resend the email'}
            </button>.
          </p>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>
          Wrong address?{' '}
          <button type="button" onClick={() => { setStatus('idle'); setResent(false) }}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 550, color: 'var(--accent)' }}>
            Edit and try again
          </button>
        </p>
      </div>
    )
  }

  const busy = status !== 'idle'
  const emailLooksValid = /.+@.+\..+/.test(email.trim())
  const formComplete = name.trim().length >= 2 && emailLooksValid && password.length >= 8

  const requirements = [
    { label: isBrand ? 'Company' : 'Name', done: name.trim().length >= 2 },
    { label: 'Email', done: emailLooksValid },
    { label: 'Password', done: password.length >= 8 },
    { label: 'Terms', done: agree },
  ]

  return (
    <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label={isBrand ? 'Company name' : 'Full name'}>
        <input className="input" value={name} onChange={e => setName(e.target.value)}
          placeholder={isBrand ? 'Glow Works Pte Ltd' : 'Alex Tan'} required disabled={busy} />
      </Field>
      <Field label={isBrand ? 'Work email' : 'Email'}>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={isBrand ? 'you@company.com' : 'you@example.com'} required disabled={busy} autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••••" minLength={8} required disabled={busy} autoComplete="new-password" />
      </Field>

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
          style={{ width: 17, height: 17, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          I agree to collabr&rsquo;s{' '}
          <Link href="/terms" target="_blank" style={{ color: 'var(--accent)', fontWeight: 530, textDecoration: 'underline' }}>
            terms and conditions
          </Link>{' '}and{' '}
          <Link href="/privacy" target="_blank" style={{ color: 'var(--accent)', fontWeight: 530, textDecoration: 'underline' }}>
            privacy policy
          </Link>.
        </span>
      </label>

      {!busy && (!formComplete || !agree) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '-4px 0 0' }}>
          {requirements.map(r => (
            <span key={r.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 550, padding: '4px 11px', borderRadius: 999,
              background: r.done ? 'var(--money-tint)' : 'var(--paper-2)',
              color: r.done ? 'var(--money-deep)' : 'var(--ink-faint-solid)',
              border: '1px solid',
              borderColor: r.done ? 'transparent' : 'var(--line)',
              transition: 'all .15s ease',
            }}>
              {r.done
                ? <Check size={12} strokeWidth={3} />
                : <Circle size={10} strokeWidth={2} />}
              {r.label}
            </span>
          ))}
        </div>
      )}

      <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy || !agree || !formComplete}>
        {status === 'loading' ? (
          <><Loader2 size={17} className="animate-spin" /> Creating account…</>
        ) : (
          <>Create {role} account <ArrowRight size={17} /></>
        )}
      </button>
    </form>
  )
}
