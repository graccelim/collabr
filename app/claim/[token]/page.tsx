'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, MailCheck, ShieldAlert, Check } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'

interface ClaimCreator {
  displayName: string
  bio: string | null
  nicheTags: string[]
  socials: { platform: string; handle: string; follower_count: number | null }[]
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  not_found: { title: 'Link not found', body: 'This claim link doesn’t exist. Double-check the link, or reach out to whoever sent it to you.' },
  expired: { title: 'This link has expired', body: 'Claim links expire after a while for security. Reach out to whoever sent it and ask for a fresh one.' },
  used: { title: 'This link was already used', body: 'This profile has already been claimed. If that wasn’t you, contact support.' },
  revoked: { title: 'This link is no longer active', body: 'Reach out to whoever sent it to you for a new one.' },
}

const BENEFITS = [
  'Receive collaboration requests',
  'Manage your campaigns',
  'Protected payments',
  'Everything is free during beta',
]

export default function ClaimPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('valid')
  const [creator, setCreator] = useState<ClaimCreator | null>(null)

  // Leads with the benefit, mechanics second: the visitor sees why claiming
  // helps them before any form. "Continue" just reveals the (unchanged)
  // email/password step below - same POST /api/claim/[token], same token
  // consumption, nothing about the auth flow itself changes.
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    fetch(`/api/claim/${params.token}`)
      .then(r => r.json())
      .then(data => {
        setStatus(data.status)
        if (data.status === 'valid') setCreator(data.creator)
      })
      .catch(() => setStatus('not_found'))
      .finally(() => setLoading(false))
  }, [params.token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (password !== confirmPassword) {
      toast.error('Passwords don’t match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/claim/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Could not claim this profile.'); setSubmitting(false); return }
      if (data.requiresEmailVerification) {
        setSent(true)
        setSubmitting(false)
        return
      }
      toast.success('Profile claimed — welcome to collabr.')
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error('Network error — please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AuthShell role="creator">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-faint-solid)' }} />
        </div>
      </AuthShell>
    )
  }

  if (status !== 'valid' || !creator) {
    const copy = STATUS_COPY[status] || STATUS_COPY.not_found
    return (
      <AuthShell role="creator">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--warn-tint, #FBF3E6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={26} style={{ color: 'var(--warn-deep, #8A5215)' }} />
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 560, letterSpacing: '-0.02em' }}>{copy.title}</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{copy.body}</p>
        </div>
      </AuthShell>
    )
  }

  if (sent) {
    return (
      <AuthShell role="creator">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MailCheck size={26} style={{ color: 'var(--accent-deep)' }} />
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 560, letterSpacing: '-0.02em' }}>Check your inbox</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            We sent a verification link to <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>.
            Click it and your profile — {creator.displayName} — will be all yours.
          </p>
        </div>
      </AuthShell>
    )
  }

  const followerTotal = creator.socials.reduce((sum, s) => sum + (s.follower_count || 0), 0)

  // Step 1: benefit-first, no form yet.
  if (!showForm) {
    return (
      <AuthShell role="creator">
        <h1 style={{ fontSize: 26, fontWeight: 560, letterSpacing: '-0.02em' }}>
          Brands are already looking for creators like you.
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 20, lineHeight: 1.6 }}>
          Join Collabr to receive collaboration requests directly, manage your campaigns, and get paid securely.
        </p>

        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{creator.displayName}</p>
          {creator.bio && <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{creator.bio}</p>}
          {creator.nicheTags.length > 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 6 }}>
              {creator.nicheTags.map(n => NICHE_LABELS[n as CreatorNiche] ?? n).join(', ')}
            </p>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 6 }}>
            {creator.socials.map(s => `@${s.handle}`).join(' · ')}
            {followerTotal > 0 && ` · ${followerTotal.toLocaleString()} followers`}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
          {BENEFITS.map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: 'var(--ink)' }}>
              <Check size={15} style={{ color: 'var(--money)', flexShrink: 0 }} />
              {b}
            </div>
          ))}
        </div>

        <button type="button" className="btn-primary btn-lg btn-block" onClick={() => setShowForm(true)}>
          Continue <ArrowRight size={17} />
        </button>
      </AuthShell>
    )
  }

  // Step 2: the actual (unchanged) auth form.
  return (
    <AuthShell role="creator">
      <h1 style={{ fontSize: 26, fontWeight: 560, letterSpacing: '-0.02em' }}>Set up your login</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 22 }}>
        Claiming <strong style={{ color: 'var(--ink)' }}>{creator.displayName}</strong> — this becomes how you sign in from now on.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Email</span>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required disabled={submitting} autoComplete="email" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Password</span>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••" minLength={8} required disabled={submitting} autoComplete="new-password" />
          <span style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)' }}>At least 8 characters.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Confirm password</span>
          <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••••" minLength={8} required disabled={submitting} autoComplete="new-password" />
        </div>
        <button type="submit" className="btn-primary btn-lg btn-block" disabled={submitting}>
          {submitting ? (
            <><Loader2 size={17} className="animate-spin" /> Claiming…</>
          ) : (
            <>Claim this profile <ArrowRight size={17} /></>
          )}
        </button>
        <button type="button" className="btn-ghost btn-block" onClick={() => setShowForm(false)} disabled={submitting}
          style={{ justifyContent: 'center' }}>
          Back
        </button>
      </form>
    </AuthShell>
  )
}
