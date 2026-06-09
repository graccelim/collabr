'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

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
    router.push('/dashboard')
    router.refresh()
    // status stays 'success' — component unmounts when dashboard loads
  }

  const busy = status !== 'idle'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--paper)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800, fontSize: 28,
            letterSpacing: '-0.04em', color: 'var(--ink)',
          }}>
            collabr<span style={{ color: 'var(--creator)' }}>.</span>
          </Link>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15, marginTop: 6 }}>
            Sign in to your account
          </p>
        </div>

        {/* Form card */}
        <div className="card pop" style={{ padding: 28 }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">Email</label>
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="label" style={{ margin: 0 }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={busy}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy}
              style={{ marginTop: 4, gap: 8 }}
            >
              {status === 'success' ? (
                <><Loader2 size={16} className="animate-spin" /> Taking you to dashboard…</>
              ) : status === 'loading' ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                <><span>Sign in</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', marginTop: 20 }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent-deep)', fontWeight: 600 }}>
            Join free
          </Link>
        </p>
      </div>
    </div>
  )
}
