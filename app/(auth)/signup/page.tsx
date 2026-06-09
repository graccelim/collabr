'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, ShieldCheck } from 'lucide-react'

const NICHES = ['Food','Beauty','Fashion','Lifestyle','Wellness','Travel','Tech','Home','Parenting','Gaming']

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const defaultRole = (params.get('role') as 'brand' | 'creator') || 'creator'
  const [role, setRole] = useState<'brand' | 'creator'>(defaultRole)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [niches, setNiches] = useState<string[]>([])
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const isBrand = role === 'brand'

  function toggleNiche(n: string) {
    setNiches(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) { toast.error('Please accept the terms'); return }
    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Signup failed'); setLoading(false); return }
    toast.success('Account created!')
    router.push('/dashboard')
    router.refresh()
  }

  const brandBullets = [
    'Free during beta — no platform fees',
    'Your money stays in escrow until you confirm',
    'Pick from real, vetted creators',
  ]
  const creatorBullets = [
    'Free to join — keep 100% during beta',
    'Get paid automatically once you post',
    'Only campaigns that fit your niche',
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--paper)',
    }}>
      {/* Left branded rail */}
      <div style={{
        width: 400, flexShrink: 0,
        padding: '48px 40px',
        background: isBrand
          ? 'linear-gradient(165deg, #1C1917, #0F0D0C)'
          : 'linear-gradient(195deg, #E8A598, #C4756A)',
        color: isBrand ? '#fff' : '#1C1917',
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
          color: isBrand ? 'rgba(255,255,255,.05)' : 'rgba(28,25,23,.07)',
          pointerEvents: 'none', userSelect: 'none',
        }}>{isBrand ? 'B' : 'C'}</div>

        <Link href="/" style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
          letterSpacing: '-0.04em',
          color: isBrand ? '#fff' : '#1C1917',
          position: 'relative',
        }}>
          collabr<span style={{ color: isBrand ? 'var(--creator)' : 'rgba(28,25,23,.6)' }}>.</span>
        </Link>

        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <span className="badge" style={{
            background: isBrand ? 'rgba(255,255,255,.13)' : 'rgba(28,25,23,.1)',
            color: isBrand ? '#fff' : '#1C1917',
            marginBottom: 20,
          }}>
            {isBrand ? 'Brand account' : 'Creator account'}
          </span>
          <h2 style={{
            fontSize: 30, color: isBrand ? '#fff' : '#1C1917',
            lineHeight: 1.08, marginBottom: 24,
          }}>
            {isBrand
              ? "Let's get your first campaign live."
              : "Let's start earning from your content."}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(isBrand ? brandBullets : creatorBullets).map(t => (
              <div key={t} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                fontSize: 14.5,
                color: isBrand ? 'rgba(255,255,255,.82)' : 'rgba(28,25,23,.78)',
              }}>
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
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

            <div>
              <label className="label">{isBrand ? 'What does your brand sell?' : 'Your niche'}</label>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
                Pick all that apply — we use this to match you
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {NICHES.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNiche(n)}
                    className={`chip${niches.includes(n) ? ' on' : ''}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

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
                This is a beta — it&apos;s free now, with 30 days&apos; notice before any fees.
              </span>
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading || !agree}
              style={{ marginTop: 4 }}
            >
              {loading
                ? 'Creating account…'
                : <><span>Create {isBrand ? 'brand' : 'creator'} account</span><ArrowRight size={17} /></>
              }
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
