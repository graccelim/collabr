'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  CREATOR_NICHES, SOCIAL_PLATFORMS, NICHE_LABELS,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'
import type { SocialAccount } from '@/types'

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState('')
  const [niche, setNiche] = useState<CreatorNiche | ''>('')
  const [baseRate, setBaseRate] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)

  // Social accounts (normalized, managed via /api/socials)
  const [socials, setSocials] = useState<SocialAccount[]>([])
  const [newPlatform, setNewPlatform] = useState<SocialPlatform>('instagram')
  const [newHandle, setNewHandle] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [addingSocial, setAddingSocial] = useState(false)

  const loadSocials = useCallback(async () => {
    const res = await fetch('/api/socials')
    if (res.ok) setSocials(await res.json())
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmailVerified(Boolean(user.email_confirmed_at))
      const { data } = await supabase.from('creator_profiles')
        .select('id, user_id, bio, niche, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, onboarding_completed_at, created_at')
        .eq('user_id', user.id).single()
      if (data) {
        setBio(data.bio || '')
        setNiche((data.niche as CreatorNiche) || '')
        setBaseRate(data.base_rate ? String(data.base_rate / 100) : '')
      }
      await loadSocials()
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('creator_profiles').update({
      bio,
      niche: niche || null,
      base_rate: baseRate ? parseInt(baseRate) * 100 : 0,
    }).eq('user_id', user!.id)
    if (error) toast.error(error.message)
    else toast.success('Profile saved')
    setSaving(false)
  }

  async function addSocial(e: React.FormEvent) {
    e.preventDefault()
    if (!newHandle.trim() || addingSocial) return
    setAddingSocial(true)
    const res = await fetch('/api/socials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: newPlatform,
        handle: newHandle,
        follower_count: newFollowers ? parseInt(newFollowers, 10) : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Could not add account')
    else {
      toast.success('Account added')
      setNewHandle(''); setNewFollowers('')
      await loadSocials()
    }
    setAddingSocial(false)
  }

  async function removeSocial(id: string) {
    const res = await fetch(`/api/socials/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Could not remove account')
    else { toast.success('Account removed'); await loadSocials() }
  }

  async function makePrimary(id: string) {
    const res = await fetch(`/api/socials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    })
    if (!res.ok) toast.error('Could not update')
    else await loadSocials()
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>

  const completionItems = [bio, niche, baseRate, socials.length > 0]
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">My profile</h1>
          {emailVerified
            ? <span className="badge badge-teal">Email verified</span>
            : <span className="badge badge-gray">Email not verified</span>}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{completion}% complete</p>
        <div className="w-full bg-surface rounded-full h-1.5 mt-2">
          <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">About you</h2>
        <div>
          <label className="label">Bio (what brands see first)</label>
          <textarea className="input min-h-[80px] resize-none" value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Food and lifestyle creator based in SG. I make honest content about things I actually use." />
        </div>
        <div>
          <label className="label">Base rate from (SGD per post)</label>
          <input className="input" type="number" value={baseRate}
            onChange={e => setBaseRate(e.target.value)} placeholder="150" />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Your niche</h2>
        <div className="flex flex-wrap gap-2">
          {CREATOR_NICHES.map(n => (
            <button key={n} type="button" onClick={() => setNiche(n)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${niche === n ? 'bg-teal-400 text-white border-teal-400' : 'border-border text-gray-600 hover:border-teal-300'}`}>
              {NICHE_LABELS[n]}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Social accounts</h2>
        {socials.length === 0 && (
          <p className="text-xs text-gray-400">No accounts connected yet — add at least one to complete onboarding.</p>
        )}
        {socials.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-700 capitalize">{s.platform}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-400 ml-2 hover:text-gray-600">@{s.handle}</a>
              {s.is_primary && <span className="badge badge-purple ml-2 text-xs">Primary</span>}
              {s.verification_status === 'verified' && <span className="badge badge-teal ml-2 text-xs">Verified</span>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {s.follower_count != null && (
                <span className="text-xs text-gray-500">{s.follower_count.toLocaleString()} followers</span>
              )}
              {!s.is_primary && (
                <button type="button" onClick={() => makePrimary(s.id)}
                  className="text-xs text-gray-400 hover:text-gray-600">Make primary</button>
              )}
              <button type="button" onClick={() => removeSocial(s.id)}
                className="text-xs text-red-400 hover:text-red-600">Remove</button>
            </div>
          </div>
        ))}

        <form onSubmit={addSocial} className="grid grid-cols-[110px_1fr_1fr_auto] gap-2 items-center">
          <select className="input" value={newPlatform}
            onChange={e => setNewPlatform(e.target.value as SocialPlatform)}>
            {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="input" placeholder="@handle" value={newHandle}
            onChange={e => setNewHandle(e.target.value)} />
          <input className="input" type="number" min="0" placeholder="Followers" value={newFollowers}
            onChange={e => setNewFollowers(e.target.value)} />
          <button type="submit" className="btn-secondary text-sm" disabled={addingSocial || !newHandle.trim()}>
            {addingSocial ? 'Adding…' : 'Add'}
          </button>
        </form>
        <p className="text-xs text-gray-400">Handles are unique per platform across collabr. Follower verification coming soon.</p>
      </div>

      <button onClick={save} className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  )
}
