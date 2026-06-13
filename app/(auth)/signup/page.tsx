'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, Star, Megaphone } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import {
  CREATOR_NICHES, BRAND_INDUSTRIES, SOCIAL_PLATFORMS,
  NICHE_LABELS, INDUSTRY_LABELS, normalizeHandle,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
}

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

/* Composite social input: platform prefix · @handle · followers (mono) */
function SocialInput({ platform, handle, followers, onHandle, onFollowers }: {
  platform: string
  handle: string
  followers?: string
  onHandle: (v: string) => void
  onFollowers?: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)',
      overflow: 'hidden', height: 42, background: 'var(--surface)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px',
        background: 'var(--surface-2)', borderRight: '1px solid var(--line)',
        minWidth: 104, flexShrink: 0,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 6, background: 'var(--accent-tint)',
          color: 'var(--accent-deep)', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 10, fontWeight: 600,
        }}>{platform.slice(0, 2).toUpperCase()}</span>
        <span style={{ fontSize: 13, fontWeight: 530 }}>{platform}</span>
      </div>
      <input placeholder="@handle" value={handle} onChange={e => onHandle(e.target.value)}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 12px', fontSize: 14, fontFamily: 'var(--font-body)', minWidth: 0 }} />
      {onFollowers && (
        <input placeholder="Followers" value={followers} onChange={e => onFollowers(e.target.value)}
          inputMode="numeric"
          style={{ width: 88, border: 'none', borderLeft: '1px solid var(--line)', outline: 'none', background: 'transparent', padding: '0 12px', fontSize: 13, fontFamily: 'var(--font-mono)' }} />
      )}
    </div>
  )
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const defaultRole = (params.get('role') as 'brand' | 'creator') || 'creator'
  const [role, setRole] = useState<'brand' | 'creator'>(defaultRole)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const isBrand = role === 'brand'

  // Creator onboarding fields (single niche — matches our schema)
  const [niche, setNiche] = useState<CreatorNiche | ''>('')
  const [handles, setHandles] = useState<Record<SocialPlatform, { handle: string; followers: string }>>({
    instagram: { handle: '', followers: '' },
    tiktok: { handle: '', followers: '' },
    youtube: { handle: '', followers: '' },
  })

  // Brand onboarding fields
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [brandSocial, setBrandSocial] = useState('') // Instagram handle → social_url

  function setHandle(p: SocialPlatform, field: 'handle' | 'followers', val: string) {
    setHandles(prev => ({ ...prev, [p]: { ...prev[p], [field]: val } }))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) { toast.error('Please accept the terms'); return }
    if (status !== 'idle') return

    let payload: Record<string, unknown> = { email, password, name, role }
    if (isBrand) {
      if (!industry) { toast.error('Pick your industry'); return }
      const socialHandle = normalizeHandle(brandSocial)
      const socialUrl = socialHandle ? `https://instagram.com/${socialHandle}` : null
      if (!website.trim() && !socialUrl) {
        toast.error('Add a website or a brand social'); return
      }
      payload = {
        ...payload,
        industry,
        website: website.trim()
          ? (website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`)
          : null,
        social_url: socialUrl,
      }
    } else {
      if (!niche) { toast.error('Pick your niche'); return }
      const socials = SOCIAL_PLATFORMS
        .filter(p => handles[p].handle.trim())
        .map(p => ({
          platform: p,
          handle: handles[p].handle,
          follower_count: handles[p].followers ? parseInt(handles[p].followers, 10) : null,
        }))
      if (socials.length === 0) { toast.error('Connect at least one social account'); return }
      payload = { ...payload, niche, socials }
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
      toast.success('Check your inbox to verify your email, then log in')
      router.push('/login')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const busy = status !== 'idle'

  return (
    <AuthShell>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Create your account</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 22 }}>
        {isBrand ? 'Post a campaign and find the right creators.' : 'Set up your studio and start earning.'}
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
                <Field label="Website" optional>
                  <input className="input" value={website} onChange={e => setWebsite(e.target.value)} placeholder="yourcompany.com" disabled={busy} />
                </Field>
              </div>
            </div>
            <Field label="Brand social" optional hint="Helps creators trust you faster. A website or a social is required.">
              <SocialInput platform="Instagram" handle={brandSocial} onHandle={setBrandSocial} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Full name">
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Grace Lim" required disabled={busy} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required disabled={busy} autoComplete="email" />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" minLength={8} required disabled={busy} autoComplete="new-password" />
            </Field>
            <Field label="Your niche" hint="Pick what you make — we match you to the right campaigns.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CREATOR_NICHES.map(n => (
                  <button key={n} type="button" onClick={() => setNiche(n)} className={`chip${niche === n ? ' on' : ''}`}>
                    {NICHE_LABELS[n]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Connect your socials" hint="Add at least one — this is what brands see.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {SOCIAL_PLATFORMS.map(p => (
                  <SocialInput key={p} platform={PLATFORM_LABEL[p]}
                    handle={handles[p].handle} followers={handles[p].followers}
                    onHandle={v => setHandle(p, 'handle', v)}
                    onFollowers={v => setHandle(p, 'followers', v)} />
                ))}
              </div>
            </Field>
          </>
        )}

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
            style={{ width: 17, height: 17, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            I agree to collabr&rsquo;s terms.{' '}
            {isBrand
              ? 'Payments are protected by escrow; you fund a collab only when you accept a creator.'
              : 'A 12% platform fee applies to payouts.'}
          </span>
        </label>

        <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy || !agree}>
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
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 530 }}>Sign in</Link>
      </p>
    </AuthShell>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
