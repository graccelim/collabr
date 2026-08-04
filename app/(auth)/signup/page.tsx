'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, Star, Megaphone, MailCheck, Check, Circle, Search } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import { safeNextPath } from '@/lib/nav'

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
 * Minimal signup (2026-07 onboarding redesign): role + name + email + password.
 * Everything else (socials, niches, company details) moved into the in-product
 * onboarding checklist shown after email verification. On success this page
 * flips to a "check your inbox" state in place — no bounce to /login — with
 * the resend flow right there.
 */
function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  // After signup, return to the page the visitor came from (?next=), falling
  // back to the dashboard. Sanitized to block open redirects.
  const next = safeNextPath(params.get('next'))
  const loginHref = next === '/dashboard' ? '/login' : `/login?next=${encodeURIComponent(next)}`
  const roleParam = params.get('role')
  // Defaults to brand, not creator: every creator-facing "join" button in the
  // app (landing page, profile pages) already points to /join, which checks
  // for a profile we may have already seeded before deciding whether to
  // activate or create one. A bare, context-less link into /signup (e.g. from
  // /login) landing on the creator form by default was the one remaining path
  // that could bypass that check entirely.
  const defaultRole = roleParam === 'brand' || roleParam === 'creator' ? roleParam : 'brand'
  const [role, setRole] = useState<'brand' | 'creator'>(defaultRole)
  // Set only by /join's own "no profile found, create a new account" link -
  // the one legitimate way to reach the real creator form directly, since
  // /join already did the lookup. Every other path that ends with role
  // set to 'creator' has NOT been checked yet, so it must not be possible to
  // submit a creator account without going through that check first - a text
  // hint next to the form isn't enough, since a creator we've already seeded
  // but haven't contacted yet has no reason to think to click it.
  const fromJoin = params.get('from') === 'join'
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
      // Stay right here: show the verify state with the resend flow attached.
      setStatus('sent')
      return
    }
    // Email confirmation disabled (e.g. local dev) → session exists, go in.
    router.push(next)
    router.refresh()
  }

  // Resend uses the signed-out endpoint (enumeration-safe, rate-limited).
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

  // ── Post-signup: verify-your-email state (in place, no redirect) ──────────
  if (status === 'sent') {
    return (
      <AuthShell role={role}>
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
      </AuthShell>
    )
  }

  const busy = status !== 'idle'
  const emailLooksValid = /.+@.+\..+/.test(email.trim())
  const formComplete = name.trim().length >= 2 && emailLooksValid && password.length >= 8

  // Requirement chips: each pill flips grey → green as it's satisfied, so a
  // disabled button never feels mysterious. Progress, not error — no red
  // before the user has even tried.
  const requirements = [
    { label: isBrand ? 'Company' : 'Name', done: name.trim().length >= 2 },
    { label: 'Email', done: emailLooksValid },
    { label: 'Password', done: password.length >= 8 },
    { label: 'Terms', done: agree },
  ]

  return (
    <AuthShell role={role}>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Create your account</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 22 }}>
        {isBrand ? 'Post a campaign and find creators who fit.' : 'Set up your profile and start getting paid.'}
        {' '}Takes under a minute.
      </p>

      {/* role toggle */}
      <div style={{ display: 'flex', background: 'var(--paper-2)', padding: 4, borderRadius: 'var(--radius)', gap: 3, marginBottom: 26 }}>
        {([['creator', "I'm a creator", Star], ['brand', "I'm a brand", Megaphone]] as const).map(([r, lbl, Ic]) => (
          <button key={r} type="button" onClick={() => setRole(r)} style={{
            flex: 1, height: 44, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 540,
            background: role === r ? 'var(--surface)' : 'transparent',
            color: role === r ? 'var(--ink)' : 'var(--ink-faint-solid)',
            boxShadow: role === r ? 'var(--shadow-sm)' : 'none', transition: 'all .15s',
          }}>
            <Ic size={16} /> {lbl}
          </button>
        ))}
      </div>

      {/* Creator + not arrived via /join's own "no profile found" link: don't
          render the form at all. A hint next to the form only helps someone
          who already suspects they might have a profile - a creator we've
          seeded but haven't contacted yet has no reason to expect that, so
          the check has to be unavoidable, not optional. */}
      {role === 'creator' && !fromJoin ? (
        <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <span style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--accent-tint)', color: 'var(--accent)',
            display: 'inline-grid', placeItems: 'center', marginBottom: 16,
          }}>
            <Search size={22} />
          </span>
          <h2 className="display-face" style={{ fontSize: 'clamp(19px,2.4vw,23px)', letterSpacing: '-0.02em', marginBottom: 18 }}>
            You could be seconds from getting discovered.
          </h2>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 9, textAlign: 'left', marginBottom: 22 }}>
            {[
              'Receive collaboration requests directly',
              'Manage your campaigns in one place',
              'Protected payments',
              'Everything is free during beta',
            ].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: 'var(--ink)' }}>
                <Check size={15} style={{ color: 'var(--money)', flexShrink: 0 }} /> {b}
              </div>
            ))}
          </div>
          <Link href="/join" className="btn-primary btn-lg btn-block" style={{ justifyContent: 'center' }}>
            Continue <ArrowRight size={16} />
          </Link>
          <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 12 }}>
            We source some creators before they've signed up — takes a few seconds either way.
          </p>
        </div>
      ) : (
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
      )}

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
        Already have an account?{' '}
        <Link href={loginHref} style={{ color: 'var(--accent)', fontWeight: 530 }}>Log in</Link>
      </p>
    </AuthShell>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
