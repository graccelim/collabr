'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, Star, Megaphone } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import {
  CREATOR_NICHES, BRAND_INDUSTRIES,
  NICHE_LABELS, INDUSTRY_LABELS, normalizeUrl,
  extractHandle, socialUrl as buildSocialUrl,
  type CreatorNiche,
} from '@/lib/onboarding'
import SocialProfileBuilder, { type SocialRow } from '@/components/SocialProfileBuilder'
import { safeNextPath } from '@/lib/nav'

const MAX_SIGNUP_NICHES = 3

/* Field wrapper per design: label · optional tag · hint */
function Field({ label, hint, optional, children }: {
  label: string; hint?: string; optional?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>{label}</span>
        {optional && <span style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)' }}>optional</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', lineHeight: 1.4 }}>{hint}</span>}
    </div>
  )
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  // After signup, return to the page the visitor came from (?next=), falling
  // back to the dashboard. Sanitized to block open redirects.
  const next = safeNextPath(params.get('next'))
  const loginHref = next === '/dashboard' ? '/login' : `/login?next=${encodeURIComponent(next)}`
  const defaultRole = (params.get('role') as 'brand' | 'creator') || 'creator'
  const [role, setRole] = useState<'brand' | 'creator'>(defaultRole)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const isBrand = role === 'brand'

  // Creator onboarding fields - up to 3 niches; first is the primary niche.
  const [niches, setNiches] = useState<CreatorNiche[]>([])
  const [socialRows, setSocialRows] = useState<SocialRow[]>([
    { platform: 'instagram', username: '', followers: '' },
  ])

  // Brand onboarding fields
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [brandAbout, setBrandAbout] = useState('')
  const [brandLocation, setBrandLocation] = useState('')

  function toggleNiche(n: CreatorNiche) {
    setNiches(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n)
      if (prev.length >= MAX_SIGNUP_NICHES) { toast.error(`You can pick up to ${MAX_SIGNUP_NICHES} niches`); return prev }
      return [...prev, n]
    })
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) { toast.error('Please tick the box to accept the terms'); return }
    if (status !== 'idle') return

    let payload: Record<string, unknown> = { email, password, name, role }
    if (isBrand) {
      if (!industry) { toast.error('Pick your industry first'); return }
      // Brand socials (first row = primary); social_url mirrors the primary.
      const brandSocials = socialRows
        .filter(r => r.username.trim())
        .map((r, i) => {
          const handle = extractHandle(r.platform, r.username)
          return {
            platform: r.platform, handle, url: buildSocialUrl(r.platform, handle),
            is_primary: i === 0, follower_count: r.followers ? parseInt(r.followers, 10) : null,
          }
        })
      const websiteUrl = normalizeUrl(website)
      if (!websiteUrl && brandSocials.length === 0) {
        toast.error('Add a website, a social profile, or a Google Maps link'); return
      }
      payload = {
        ...payload, industry, website: websiteUrl,
        social_url: brandSocials[0]?.url || null,
        socials: brandSocials,
        company_description: brandAbout.trim() || null,
        location: brandLocation.trim() || null,
      }
    } else {
      if (niches.length === 0) { toast.error('Pick at least one niche so we can match you'); return }
      // Row order preserved → first profile becomes primary server-side.
      const socials = socialRows
        .filter(r => r.username.trim())
        .map(r => ({
          platform: r.platform,
          handle: r.username.trim(),
          follower_count: r.followers ? parseInt(r.followers, 10) : null,
        }))
      if (socials.length === 0) { toast.error('Add at least one social profile'); return }
      if (socials.some(s => s.follower_count == null || !(s.follower_count >= 0))) {
        toast.error('Add a follower count for each social profile'); return
      }
      payload = { ...payload, niche: niches[0], niche_tags: niches, socials }
    }

    setStatus('loading')
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Signup failed'); setStatus('idle'); return }
    if (data.warning) toast(data.warning)
    setStatus('success')
    if (data.requiresEmailVerification) {
      toast.success('Check your inbox to verify your email, then log in.')
      router.push(loginHref)
      return
    }
    router.push(next)
    router.refresh()
  }

  const busy = status !== 'idle'

  // The submit button stays disabled until EVERY required field is filled (not
  // just the terms box). Mirrors the server-side validation in handleSignup.
  const filledSocials = socialRows.filter(r => r.username.trim())
  const emailLooksValid = /.+@.+\..+/.test(email.trim())
  const baseComplete = name.trim().length >= 2 && emailLooksValid && password.length >= 8
  const creatorComplete = baseComplete
    && niches.length > 0
    && filledSocials.length > 0
    && filledSocials.every(r => r.followers.trim() !== '' && Number(r.followers) >= 0)
  const brandComplete = baseComplete
    && industry.trim() !== ''
    && (Boolean(normalizeUrl(website)) || filledSocials.length > 0)
  const formComplete = isBrand ? brandComplete : creatorComplete

  return (
    <AuthShell role={role}>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Create your account</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 22 }}>
        {isBrand ? 'Post a campaign and find creators who fit.' : 'Set up your profile and start getting paid.'}
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

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {isBrand ? (
          <>
            <Field label="Company name">
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Glow Works Pte Ltd" required disabled={busy} />
            </Field>
            <Field label="Work email">
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required disabled={busy} autoComplete="email" />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" minLength={8} required disabled={busy} autoComplete="new-password" />
            </Field>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <Field label="Industry">
                  <select className="input" value={industry} onChange={e => setIndustry(e.target.value)} required disabled={busy}>
                    <option value="">Select industry</option>
                    {BRAND_INDUSTRIES.map(i => <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 170 }}>
                <Field label="Location" optional>
                  <input className="input" value={brandLocation} onChange={e => setBrandLocation(e.target.value)} placeholder="Singapore" disabled={busy} maxLength={120} />
                </Field>
              </div>
            </div>
            <Field label="About" optional hint="A line or two about your brand. Creators will see this on your profile.">
              <textarea className="textarea" value={brandAbout} onChange={e => setBrandAbout(e.target.value)}
                placeholder="We're a neighbourhood kopitiam in Tiong Bahru serving…" disabled={busy} maxLength={2000} style={{ minHeight: 72 }} />
            </Field>
            <Field label="Website or Google Maps" hint="Your site or even your Google Maps listing works. We just need a website or a social below.">
              <input className="input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="yourcompany.com  ·  or  maps.app.goo.gl/…" disabled={busy} />
            </Field>
            <Field label="Brand socials" hint="This helps creators trust you faster. Pick a platform and pop in your handle, we build the link. Your first profile shows as primary.">
              <SocialProfileBuilder rows={socialRows} onChange={setSocialRows} showFollowers={false} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Full name">
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Tan" required disabled={busy} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required disabled={busy} autoComplete="email" />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" minLength={8} required disabled={busy} autoComplete="new-password" />
            </Field>
            <Field label="Your niches" hint={`Pick up to ${MAX_SIGNUP_NICHES} so we can match you to the right campaigns. ${niches.length}/${MAX_SIGNUP_NICHES} selected`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CREATOR_NICHES.map(n => (
                  <button key={n} type="button" onClick={() => toggleNiche(n)} className={`chip${niches.includes(n) ? ' on' : ''}`}>
                    {NICHE_LABELS[n]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Connect your socials" hint="Add at least one. Your first profile is the one brands see as primary.">
              <SocialProfileBuilder rows={socialRows} onChange={setSocialRows} />
            </Field>
          </>
        )}

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
            style={{ width: 17, height: 17, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            I agree to collabr&rsquo;s{' '}
            <Link href="/terms" target="_blank" style={{ color: 'var(--accent)', fontWeight: 530, textDecoration: 'underline' }}>
              terms and conditions
            </Link>.
          </span>
        </label>

        <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy || !agree || !formComplete}>
          {status === 'success' ? (
            <><Loader2 size={17} className="animate-spin" /> Taking you in…</>
          ) : status === 'loading' ? (
            <><Loader2 size={17} className="animate-spin" /> Creating account…</>
          ) : (
            <>Create {role} account <ArrowRight size={17} /></>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
        Already have an account?{' '}
        <Link href={loginHref} style={{ color: 'var(--accent)', fontWeight: 530 }}>Sign in</Link>
      </p>
    </AuthShell>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
