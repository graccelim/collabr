'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  CREATOR_NICHES, SOCIAL_PLATFORMS, NICHE_LABELS,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'
import { AVAILABILITY_STATUSES, AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import { creatorCompletion } from '@/lib/profile-completion'
import { getInitials } from '@/lib/utils'
import type { SocialAccount } from '@/types'

export default function ProfilePage() {
  const supabase = createClient()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  const [bio, setBio] = useState('')
  const [niche, setNiche] = useState<CreatorNiche | ''>('')
  const [location, setLocation] = useState('')
  const [rate, setRate] = useState('')
  const [availability, setAvailability] = useState<AvailabilityStatus>('available')
  const [mediaKitUrl, setMediaKitUrl] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([])
  const [newPortfolioLink, setNewPortfolioLink] = useState('')

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
      setUserId(user.id)
      setEmailVerified(Boolean(user.email_confirmed_at))

      const { data: account } = await supabase.from('users')
        .select('display_name, avatar_url').eq('id', user.id).single()
      if (account) {
        setDisplayName(account.display_name || '')
        setAvatarUrl(account.avatar_url || '')
      }

      const { data } = await supabase.from('creator_profiles')
        .select('bio, niche, location, portfolio_links, media_kit_url, average_rate_sgd, availability_status')
        .eq('user_id', user.id).single()
      if (data) {
        setBio(data.bio || '')
        setNiche((data.niche as CreatorNiche) || '')
        setLocation(data.location || '')
        setRate(data.average_rate_sgd ? String(data.average_rate_sgd / 100) : '')
        setAvailability((data.availability_status as AvailabilityStatus) || 'available')
        setMediaKitUrl(data.media_kit_url || '')
        setPortfolioLinks(data.portfolio_links || [])
      }
      await loadSocials()
      setLoading(false)
    }
    load()
  }, [])

  async function uploadAvatar(file: File) {
    setAvatarUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { toast.error('Photo upload failed'); setAvatarUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: userErr } = await supabase.from('users')
      .update({ avatar_url: data.publicUrl }).eq('id', userId)
    if (userErr) toast.error('Could not save photo')
    else { setAvatarUrl(data.publicUrl); toast.success('Photo updated') }
    setAvatarUploading(false)
  }

  function addPortfolioLink() {
    const link = newPortfolioLink.trim()
    if (!link) return
    if (!/^https?:\/\//.test(link)) { toast.error('Links must start with https://'); return }
    if (portfolioLinks.includes(link)) { toast.error('Link already added'); return }
    if (portfolioLinks.length >= 10) { toast.error('Up to 10 portfolio links'); return }
    setPortfolioLinks(p => [...p, link])
    setNewPortfolioLink('')
  }

  async function save() {
    if (saving) return
    const parsedRate = rate ? Math.round(parseFloat(rate) * 100) : null
    if (parsedRate !== null && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      toast.error('Rate must be a positive number'); return
    }
    setSaving(true)
    const res = await fetch('/api/profile/creator', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: bio.trim() || null,
        niche: niche || null,
        location: location.trim() || null,
        portfolio_links: portfolioLinks,
        media_kit_url: mediaKitUrl.trim() || null,
        average_rate_sgd: parsedRate,
        availability_status: availability,
        display_name: displayName.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Could not save profile')
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

  const completion = creatorCompletion({
    avatar_url: avatarUrl,
    niche,
    bio,
    location,
    portfolio_links: portfolioLinks,
    socials_count: socials.length,
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">My profile</h1>
          {emailVerified
            ? <span className="badge badge-teal">Email verified</span>
            : <span className="badge badge-gray">Email not verified</span>}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{completion.score}% complete</p>
        <div className="w-full bg-surface rounded-full h-1.5 mt-2">
          <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${completion.score}%` }} />
        </div>
        {completion.score < 100 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {completion.items.filter(i => !i.done).map(i => (
              <span key={i.key} className="badge badge-gray text-xs">+ {i.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* Photo + name */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">About you</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 text-xl font-medium flex items-center justify-center shrink-0 overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile photo" className="w-16 h-16 object-cover" />
              : getInitials(displayName || 'C')}
          </div>
          <div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="btn-secondary text-sm"
            >
              {avatarUploading ? 'Uploading…' : avatarUrl ? 'Replace photo' : 'Upload photo'}
            </button>
            <p className="text-xs text-gray-400 mt-1">PNG or JPG, max 2 MB. Brands see this first.</p>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
          />
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName}
            onChange={e => setDisplayName(e.target.value)} placeholder="Sara Reyes" />
        </div>
        <div>
          <label className="label">Bio (what brands see first)</label>
          <textarea className="input min-h-[80px] resize-none" value={bio} maxLength={1000}
            onChange={e => setBio(e.target.value)}
            placeholder="Food and lifestyle creator based in SG. I make honest content about things I actually use." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Location</label>
            <input className="input" value={location} maxLength={120}
              onChange={e => setLocation(e.target.value)} placeholder="Singapore" />
          </div>
          <div>
            <label className="label">Average rate (SGD per post)</label>
            <input className="input" type="number" min="0" value={rate}
              onChange={e => setRate(e.target.value)} placeholder="150" />
          </div>
        </div>
        <div>
          <label className="label">Availability</label>
          <select className="input" value={availability}
            onChange={e => setAvailability(e.target.value as AvailabilityStatus)}>
            {AVAILABILITY_STATUSES.map(s => (
              <option key={s} value={s}>{AVAILABILITY_LABELS[s]}</option>
            ))}
          </select>
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

      {/* Portfolio */}
      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Portfolio</h2>
        {portfolioLinks.length === 0 && (
          <p className="text-xs text-gray-400">
            No links yet — add your best work so brands can see what you make.
          </p>
        )}
        {portfolioLinks.map(link => (
          <div key={link} className="flex items-center justify-between gap-2">
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gray-900 truncate">{link}</a>
            <button type="button" className="text-xs text-red-400 hover:text-red-600 shrink-0"
              onClick={() => setPortfolioLinks(p => p.filter(l => l !== link))}>
              Remove
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="input flex-1" type="url" value={newPortfolioLink}
            onChange={e => setNewPortfolioLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPortfolioLink() } }}
            placeholder="https://instagram.com/p/your-best-post" />
          <button type="button" className="btn-secondary text-sm shrink-0"
            onClick={addPortfolioLink} disabled={!newPortfolioLink.trim()}>
            Add
          </button>
        </div>
        <div>
          <label className="label">Media kit (optional)</label>
          <input className="input" type="url" value={mediaKitUrl}
            onChange={e => setMediaKitUrl(e.target.value)}
            placeholder="https://drive.google.com/your-media-kit" />
        </div>
      </div>

      {/* Social accounts */}
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

      <button onClick={save} className="btn-primary" disabled={saving || avatarUploading}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  )
}
