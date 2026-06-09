'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const defaultRole = (params.get('role') as 'brand' | 'creator') || 'creator'
  const [role, setRole] = useState<'brand' | 'creator'>(defaultRole)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error || !data.user) { toast.error(error?.message || 'Signup failed'); setLoading(false); return }
    // Create user row
    const { error: userErr } = await supabase.from('users').insert({
      id: data.user.id, role, email, display_name: name
    })
    if (userErr) { toast.error('Could not create profile'); setLoading(false); return }
    // Create role-specific profile
    if (role === 'brand') {
      await supabase.from('brand_profiles').insert({ user_id: data.user.id, company_name: name })
    } else {
      await supabase.from('creator_profiles').insert({ user_id: data.user.id })
    }
    toast.success('Account created!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold text-gray-900">collabr.</Link>
          <p className="text-gray-500 text-sm mt-1">Create your free account</p>
        </div>
        {/* Role toggle */}
        <div className="flex border border-border rounded-lg p-1 mb-4 bg-white">
          {(['creator','brand'] as const).map(r => (
            <button key={r} type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${role === r ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {r === 'creator' ? "I'm a creator" : "I'm a brand"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSignup} className="card space-y-4">
          <div>
            <label className="label">{role === 'brand' ? 'Company name' : 'Your name'}</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder={role === 'brand' ? 'Glow Works' : 'Sara Reyes'} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required />
          </div>
          <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account — free'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Free during beta. Fees introduced with 6 weeks notice.
          </p>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account? <Link href="/login" className="text-purple-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
