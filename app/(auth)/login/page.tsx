'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { ArrowRight, Loader2 } from 'lucide-react'
import AuthShell from '@/components/AuthShell'

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
  }

  const busy = status !== 'idle'

  return (
    <AuthShell>
      <h1 style={{ fontSize: 28, fontWeight: 560, letterSpacing: '-0.02em' }}>Welcome back</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 8, marginBottom: 28 }}>
        Sign in to pick up where you left off.
      </p>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink)' }}>Password</span>
            <Link href="/forgot-password" style={{ fontSize: 12.5, fontWeight: 530, color: 'var(--accent)' }}>
              Forgot password?
            </Link>
          </span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••"
            required
            disabled={busy}
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn-primary btn-lg btn-block" disabled={busy}>
          {status === 'success' ? (
            <><Loader2 size={16} className="animate-spin" /> Taking you to your dashboard…</>
          ) : status === 'loading' ? (
            <><Loader2 size={16} className="animate-spin" /> Signing in…</>
          ) : (
            <>Sign in <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 22 }}>
        New here?{' '}
        <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 530 }}>Create an account</Link>
      </p>
    </AuthShell>
  )
}
