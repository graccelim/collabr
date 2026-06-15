'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  CREATOR_NICHES, SOCIAL_PLATFORMS, NICHE_LABELS, normalizeUrl,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'
import { AVAILABILITY_STATUSES, AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import { creatorCompletion } from '@/lib/profile-completion'
import { getInitials } from '@/lib/utils'
import { Star, Instagram, Youtube, Music2 } from 'lucide-react'
import type { SocialAccount } from '@/types'

// Per-platform glyph for the social rows (lucide has no TikTok mark — Music2 reads as short-form video).
const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
}

// Stable serialization of the editable fields — used to detect whether anything
// changed since load so we can disable "Save profile" when there's no diff.
// (Avatar and socials save on their own, so they're excluded here.)
function profileSnapshot(f: {
  bio: string; niches: CreatorNiche[]; location: string; rate: string
  availability: AvailabilityStatus; mediaKitUrl: string; portfolioLinks: string[]; displayName: string
}) {
  return JSON.stringify({
    bio: f.bio.trim(), niches: f.niches, location: f.location.trim(), rate: f.rate.trim(),
    availability: f.availability, mediaKitUrl: f.mediaKitUrl.trim(),
    portfolioLinks: f.portfolioLinks, displayName: f.displayName.trim(),
  })
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  const [bio, setBio] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [niches, setNiches] = useState<CreatorNiche[]>([])
  const [location, setLocation] = useState('')
  const [rate, setRate] = useState('')
  const [availability, setAvailability] = useState<AvailabilityStatus>('available')
  const [mediaKitUrl, setMediaKitUrl] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([])
  const [newPortfolioLink, setNewPortfolioLink] = useState('')
  // Snapshot of the form as loaded — Save stays disabled until something differs.
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

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

      // All three reads key off user.id and are independent — fetch concurrently.
      const [{ data: account }, { data }] = await Promise.all([
        supabase.from('users').select('display_name, avatar_url').eq('id', user.id).single(),
        supabase.from('creator_profiles')
          .select('id, bio, niche, niche_tags, location, portfolio_links, media_kit_url, average_rate_sgd, availability_status, rating_avg, rating_count, collabs_completed')
          .eq('user_id', user.id).single(),
        loadSocials(),
      ])
      const loadedDisplayName = account?.display_name || ''
      if (account) {
        setDisplayName(loadedDisplayName)
        setAvatarUrl(account.avatar_url || '')
      }
      if (data) {
        const loadedNiches = ((data.niche_tags as CreatorNiche[])?.length
          ? (data.niche_tags as CreatorNiche[])
          : data.niche ? [data.niche as CreatorNiche] : [])
        const loadedRate = data.average_rate_sgd ? String(data.average_rate_sgd / 100) : ''
        const loadedAvailability = (data.availability_status as AvailabilityStatus) || 'available'
        setCreatorId((data as any).id || '')
        setBio(data.bio || '')
        setNiches(loadedNiches)
        setLocation(data.location || '')
        setRate(loadedRate)
        setAvailability(loadedAvailability)
        setMediaKitUrl(data.media_kit_url || '')
        setPortfolioLinks(data.portfolio_links || [])
        setInitialSnapshot(profileSnapshot({
          bio: data.bio || '', niches: loadedNiches, location: data.location || '', rate: loadedRate,
          availability: loadedAvailability, mediaKitUrl: data.media_kit_url || '',
          portfolioLinks: data.portfolio_links || [], displayName: loadedDisplayName,
        }))
      }
      setLoading(false)
    }
    load()
  }, [])

  // Keep the "add social" platform valid — skip ones already connected.
  useEffect(() => {
    if (socials.some(s => s.platform === newPlatform)) {
      const next = SOCIAL_PLATFORMS.find(p => !socials.some(s => s.platform === p))
      if (next) setNewPlatform(next)
    }
  }, [socials, newPlatform])

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

  function toggleNiche(n: CreatorNiche) {
    setNiches(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n)
      if (prev.length >= 4) { toast.error('Pick up to 4 niches'); return prev }
      return [...prev, n]
    })
  }

  function addPortfolioLink() {
    const link = normalizeUrl(newPortfolioLink) || ''
    if (!link) return
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
        niche: niches[0] || null,
        niche_tags: niches,
        location: location.trim() || null,
        portfolio_links: portfolioLinks,
        media_kit_url: normalizeUrl(mediaKitUrl),
        average_rate_sgd: parsedRate,
        availability_status: availability,
        display_name: displayName.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Could not save profile'); setSaving(false); return }
    toast.success('Profile saved')
    // Return to the public profile — the view brands actually see.
    if (creatorId) router.push(`/creators/${creatorId}`)
    else setSaving(false)
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
    niche: niches[0] || '',
    bio,
    location,
    portfolio_links: portfolioLinks,
    socials_count: socials.length,
  })

  // Nothing to save until the form differs from how it loaded.
  const isDirty = initialSnapshot !== null && profileSnapshot({
    bio, niches, location, rate, availability, mediaKitUrl, portfolioLinks, displayName,
  }) !== initialSnapshot

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="eyebrow" style={{ marginBottom: 7 }}>You</div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 style={{ fontSize: 28 }}>My profile</h1>
          {emailVerified
            ? <span className="badge badge-teal">Email verified</span>
            : <span className="badge badge-gray">Email not verified</span>}
        </div>
        <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
          Brands see this first. Make it easy to say yes.
        </p>
      </div>

      {/* Completion — circular ring + missing-item pills */}
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <CompletionRing pct={completion.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            Your profile is {completion.score}% complete
          </div>
          {completion.score < 100 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {completion.items.filter(i => !i.done).map(i => (
                <span key={i.key} className="badge badge-neutral" style={{ fontSize: 12 }}>+ {i.label}</span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
              All set — brands see a complete profile.
            </div>
          )}
        </div>
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
        <h2 className="text-sm font-medium text-gray-900">Your niches</h2>
        <p className="text-xs text-gray-400">
          Pick up to 4. Your first pick is your primary niche.{' '}
          <span style={{ color: 'var(--ink-soft)' }}>{niches.length}/4 selected</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {CREATOR_NICHES.map(n => (
            <button key={n} type="button" onClick={() => toggleNiche(n)}
              className={`chip${niches.includes(n) ? ' on' : ''}`}>
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
          <input className="input flex-1" type="text" inputMode="url" value={newPortfolioLink}
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
          <input className="input" type="text" inputMode="url" value={mediaKitUrl}
            onChange={e => setMediaKitUrl(e.target.value)}
            placeholder="https://drive.google.com/your-media-kit" />
        </div>
      </div>

      {/* Social accounts */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-medium text-gray-900">Social accounts</h2>
          {socials.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>
              {socials.length} connected
            </span>
          )}
        </div>
        {socials.length === 0 && (
          <p className="text-xs text-gray-400">No accounts connected yet — add at least one to complete onboarding.</p>
        )}
        {socials.map(s => {
          const Icon = PLATFORM_ICON[s.platform] || Star
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '12px 14px', borderRadius: 'var(--radius-sm)',
              border: s.is_primary ? '1.5px solid var(--accent)' : '1px solid var(--line)',
              background: s.is_primary ? 'var(--accent-tint)' : 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: s.is_primary ? 'var(--accent)' : 'var(--surface-2)',
                  color: s.is_primary ? '#fff' : 'var(--ink-soft)',
                }}>
                  <Icon size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="capitalize" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.platform}</span>
                    {s.is_primary && (
                      <span className="badge" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700,
                        background: 'var(--accent)', color: '#fff', padding: '2px 8px',
                      }}>
                        <Star size={10} fill="currentColor" /> Primary
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="hover:underline" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>@{s.handle}</a>
                    {s.follower_count != null && (
                      <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }} title="Self-reported">
                        · {s.follower_count.toLocaleString()} followers
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!s.is_primary && (
                  <button type="button" onClick={() => makePrimary(s.id)}
                    style={{ fontSize: 12, fontWeight: 540, color: 'var(--accent-deep)' }}>Make primary</button>
                )}
                <button type="button" onClick={() => removeSocial(s.id)}
                  className="text-red-400 hover:text-red-600" style={{ fontSize: 12 }}>Remove</button>
              </div>
            </div>
          )
        })}

        {SOCIAL_PLATFORMS.every(p => socials.some(s => s.platform === p)) ? (
          <p className="text-xs text-gray-400">All platforms connected.</p>
        ) : (
        <form onSubmit={addSocial} className="grid grid-cols-2 sm:grid-cols-[110px_1fr_1fr_auto] gap-2 items-center">
          <select className="input" value={newPlatform}
            onChange={e => setNewPlatform(e.target.value as SocialPlatform)}>
            {SOCIAL_PLATFORMS.filter(p => !socials.some(s => s.platform === p))
              .map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="input" placeholder="@handle" value={newHandle}
            onChange={e => setNewHandle(e.target.value)} />
          <input className="input" type="number" min="0" placeholder="Followers" value={newFollowers}
            onChange={e => setNewFollowers(e.target.value)} />
          <button type="submit" className="btn-secondary text-sm" disabled={addingSocial || !newHandle.trim()}>
            {addingSocial ? 'Adding…' : 'Add'}
          </button>
        </form>
        )}
        <p className="text-xs text-gray-400">Handles are unique per platform across collabr. Follower counts are self-reported. Your primary account is the one brands see first.</p>
      </div>

      <button onClick={save} className="btn-primary" disabled={saving || avatarUploading || !isDirty}>
        {saving ? 'Saving…' : !isDirty ? 'No changes to save' : 'Save profile'}
      </button>
    </div>
  )
}

// Circular completion ring — mirrors the dashboard CompletionNudge SVG tokens.
function CompletionRing({ pct }: { pct: number }) {
  const size = 44, sw = 4
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-2)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)' }} />
      </svg>
      <div className="mono-num" style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11.5, fontWeight: 600, color: 'var(--ink)',
      }}>{pct}%</div>
    </div>
  )
}
