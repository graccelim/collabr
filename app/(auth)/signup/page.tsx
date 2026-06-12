'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import {
  CREATOR_NICHES, BRAND_INDUSTRIES, SOCIAL_PLATFORMS,
  NICHE_LABELS, INDUSTRY_LABELS,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'

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

  // Creator onboarding fields
  const [niche, setNiche] = useState<CreatorNiche | ''>('')
  const [handles, setHandles] = useState<Record<SocialPlatform, { handle: string; followers: string }>>({
    instagram: { handle: '', followers: '' },
    tiktok: { handle: '', followers: '' },
    youtube: { handle: '', followers: '' },
  })

  // Brand onboarding fields
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [socialUrl, setSocialUrl] = useState('')

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
      if (!website.trim() && !socialUrl.trim()) {
        toast.error('Add a website or a social account link'); return
      }
      payload = {
        ...payload,
        industry,
        website: website.trim() || null,
        social_url: socialUrl.trim() || null,
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
    // status stays 'success' — component unmounts when dashboard loads
  }

  const brandBullets = [
    'Free to post during beta — you pay only your creator’s rate',
    'Your money stays in escrow until you confirm',
    'Pick from real, vetted creators',
  ]
  const creatorBullets = [
    'Free to join — a 12% platform fee applies only when you get paid',
    'Get paid automatically once you post',
    'Only campaigns that fit your niche',
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--paper)',
    }}>
      {/* Left branded rail — graphite, role marked by accent only */}
      <div style={{
        width: 400, flexShrink: 0,
        padding: '48px 40px',
        background: 'linear-gradient(165deg, #17181C, #0E0F12)',
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}
        className="sidebar-desktop"
      >
        {/* Big letter watermark */}
        <div style={{
          position: 'absolute', top: '-6%', right: '-8%',
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 300, lineHeight: .8,
          color: 'rgba(255,255,255,.04)',
          pointerEvents: 'none', userSelect: 'none',
        }}>{isBrand ? 'B' : 'C'}</div>

        <Link href="/" style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19,
          letterSpacing: '-0.03em',
          color: '#fff',
          position: 'relative',
        }}>
          collabr<span style={{ color: '#FDA4AF' }}>.</span>
        </Link>

        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <span className="badge" style={{
            background: 'rgba(255,255,255,.1)',
            color: isBrand ? '#A5B4FC' : '#FDA4AF',
            border: '1px solid rgba(255,255,255,.12)',
            marginBottom: 20,
          }}>
            {isBrand ? 'Brand account' : 'Creator account'}
          </span>
          <h2 style={{
            fontSize: 28, color: '#fff',
            lineHeight: 1.15, marginBottom: 24, fontWeight: 600,
            letterSpacing: '-0.02em',
          }}>
            {isBrand
              ? "Let's get your first campaign live."
              : "Let's start earning from your content."}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {(isBrand ? brandBullets : creatorBullets).map(t => (
              <div key={t} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                fontSize: 13.5,
                color: 'rgba(255,255,255,.75)',
              }}>
                <ShieldCheck size={16} style={{
                  flexShrink: 0, marginTop: 1,
                  color: isBrand ? '#A5B4FC' : '#FDA4AF',
                }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'grid', placeItems: 'start center',
        padding: '48px 32px 64px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          {/* Role toggle */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 10 }}>
              I am a…
            </div>
            <div style={{
              display: 'inline-flex',
              background: 'var(--paper-2)',
              borderRadius: 'var(--radius-pill)',
              padding: 4, gap: 4,
            }}>
              {(['creator', 'brand'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    border: 0,
                    background: role === r ? 'var(--surface)' : 'transparent',
                    color: role === r ? 'var(--ink)' : 'var(--ink-soft)',
                    fontWeight: 600, fontSize: 14,
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    boxShadow: role === r ? 'var(--shadow-sm)' : 'none',
                    transition: 'all .15s ease',
                  }}
                >
                  {r === 'creator' ? "I'm a creator" : "I'm a brand"}
                </button>
              ))}
            </div>
          </div>

          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Create your account</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginBottom: 28 }}>
            {isBrand ? 'Tell us about your business.' : 'Tell us about you and your channels.'}
          </p>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">{isBrand ? 'Company name' : 'Your name'}</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isBrand ? 'Glow Works Pte Ltd' : 'Sara Reyes'}
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>

            {isBrand ? (
              <>
                <div>
                  <label className="label">Industry</label>
                  <select
                    className="input"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    required
                  >
                    <option value="">Select industry</option>
                    {BRAND_INDUSTRIES.map(i => (
                      <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Website</label>
                  <input
                    className="input"
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://yourcompany.com"
                  />
                </div>
                <div>
                  <label className="label">Social account link</label>
                  <input
                    className="input"
                    type="url"
                    value={socialUrl}
                    onChange={e => setSocialUrl(e.target.value)}
                    placeholder="https://instagram.com/yourbrand"
                  />
                  <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>
                    A website or a social account is required
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Your niche</label>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
                    Pick your main niche — we use this to match you
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {CREATOR_NICHES.map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNiche(n)}
                        className={`chip${niche === n ? ' on' : ''}`}
                      >
                        {NICHE_LABELS[n]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Social accounts</label>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
                    Connect at least one — this is what brands see
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {SOCIAL_PLATFORMS.map(p => (
                      <div key={p} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          className="input"
                          value={handles[p].handle}
                          onChange={e => setHandle(p, 'handle', e.target.value)}
                          placeholder={`${p} @handle`}
                        />
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={handles[p].followers}
                          onChange={e => setHandle(p, 'followers', e.target.value)}
                          placeholder="Followers (optional)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              cursor: 'pointer', fontSize: 13.5, color: 'var(--ink-soft)',
            }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={e => setAgree(e.target.checked)}
                style={{ width: 17, height: 17, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span>
                I agree to collabr&apos;s terms and understand payments are protected by escrow.
                A 12% platform fee applies to creator payouts. We&apos;ll give 30 days&apos; notice before any pricing changes.
              </span>
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={status !== 'idle' || !agree}
              style={{ marginTop: 4, gap: 8 }}
            >
              {status === 'success' ? (
                <><Loader2 size={17} className="animate-spin" /> Taking you to dashboard…</>
              ) : status === 'loading' ? (
                <><Loader2 size={17} className="animate-spin" /> Creating account…</>
              ) : (
                <><span>Create {isBrand ? 'brand' : 'creator'} account</span><ArrowRight size={17} /></>
              )}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--accent-deep)', fontWeight: 600 }}>
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
