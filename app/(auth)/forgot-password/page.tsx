'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="text-2xl font-semibold text-gray-900">collabr.</Link>
          <div className="card mt-8 space-y-3">
            <p className="text-sm font-medium text-gray-900">Check your email</p>
            <p className="text-sm text-gray-500">
              We sent a reset link to <strong>{email}</strong>. Check your spam folder if it doesn't arrive.
            </p>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            <Link href="/login" className="text-purple-600 hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold text-gray-900">collabr.</Link>
          <p className="text-gray-500 text-sm mt-1">Reset your password</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link href="/login" className="text-purple-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
