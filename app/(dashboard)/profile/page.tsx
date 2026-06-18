'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  CREATOR_NICHES, SOCIAL_PLATFORMS, NICHE_LABELS, SOCIAL_LABELS, normalizeUrl,
  socialHandleLabel,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'
import { AVAILABILITY_STATUSES, AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import { creatorCompletion } from '@/lib/profile-completion'
import { friendlyUploadError, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import { Star, X } from 'lucide-react'
import { socialIcon } from '@/components/SocialIcon'
import type { SocialAccount } from '@/types'

// Stable serialization of the editable fields - used to detect whether anything
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
  // Staged photo: held locally and only committed when the user clicks Save, so
  // navigating away (or Cancel edit) discards it - nothing saves implicitly.
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
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
  // Snapshot of the form as loaded - Save stays disabled until something differs.
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)
  // Avatar uploads and social add/remove save on their own, but they still count
  // as "edits made" so the button reads Save changes (not Cancel edit).
  const [touched, setTouched] = useState(false)

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

      // All three reads key off user.id and are independent - fetch concurrently.
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

  // Keep the "add social" platform valid - skip ones already connected.
  useEffect(() => {
    if (socials.some(s => s.platform === newPlatform)) {
      const next = SOCIAL_PLATFORMS.find(p => !socials.some(s => s.platform === p))
      if (next) setNewPlatform(next)
    }
  }, [socials, newPlatform])

  // Stage a chosen photo locally (no upload yet) - it commits only on Save.
  function selectAvatar(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error('Please upload a PNG, JPG or WebP image.'); return }
    if (file.size > MAX_IMAGE_BYTES) { toast.error('That image is too large. Please upload one under 2 MB.'); return }
    setAvatarPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
    setAvatarFile(file)
    setTouched(true)
  }

  // Upload the staged photo and persist it. Returns false on failure.
  async function commitAvatar(): Promise<boolean> {
    if (!avatarFile) return true
    setAvatarUploading(true)
    const ext = avatarFile.name.split('.').pop()
    const path = `${userId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
    if (error) { toast.error(friendlyUploadError(error, 'photo')); setAvatarUploading(false); return false }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: userErr } = await supabase.from('users')
      .update({ avatar_url: data.publicUrl }).eq('id', userId)
    if (userErr) { toast.error('We couldn’t save your photo. Please try again.'); setAvatarUploading(false); return false }
    setAvatarUrl(data.publicUrl)
    setAvatarFile(null)
    setAvatarUploading(false)
    return true
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
    if (displayName.trim().length < 2) {
      toast.error('Your name is required, this is what brands see.'); return
    }
    const parsedRate = rate ? Math.round(parseFloat(rate) * 100) : null
    if (parsedRate !== null && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      toast.error('Rate must be a positive number'); return
    }
    setSaving(true)
    // Commit the staged photo first; abort the save if it fails.
    if (!(await commitAvatar())) { setSaving(false); return }
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
        display_name: displayName.trim(),
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Could not save profile'); setSaving(false); return }
    toast.success('Profile saved')
    // Return to the public profile - the view brands actually see.
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
      setNewHandle(''); setNewFollowers(''); setTouched(true)
      await loadSocials()
    }
    setAddingSocial(false)
  }

  async function removeSocial(id: string) {
    if (socials.length <= 1) { toast.error('Keep at least one social profile.'); return }
    const prev = socials
    // Optimistic: drop it instantly, and promote the first remaining if we just
    // removed the primary (mirrors the server's reassignment).
    setSocials(list => {
      const removed = list.find(x => x.id === id)
      let next = list.filter(x => x.id !== id)
      if (removed?.is_primary && next.length && !next.some(x => x.is_primary)) {
        next = next.map((x, i) => (i === 0 ? { ...x, is_primary: true } : x))
      }
      return next
    })
    setTouched(true)
    const res = await fetch(`/api/socials/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not remove account')
      setSocials(prev) // revert
    }
  }

  async function makePrimary(id: string) {
    const prev = socials
    setSocials(list => list.map(x => ({ ...x, is_primary: x.id === id }))) // instant
    setTouched(true)
    const res = await fetch(`/api/socials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    })
    if (!res.ok) { toast.error('Could not update'); setSocials(prev) } // revert
  }

  // Edit the follower count of an already-connected account (saved on blur).
  async function updateFollowers(id: string, raw: string) {
    const trimmed = raw.trim()
    const value = trimmed === '' ? null : Math.max(0, parseInt(trimmed, 10) || 0)
    const prev = socials
    const target = socials.find(s => s.id === id)
    if (!target || target.follower_count === value) return
    setSocials(list => list.map(s => (s.id === id ? { ...s, follower_count: value } : s)))
    setTouched(true)
    const res = await fetch(`/api/socials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ follower_count: value }),
    })
    if (!res.ok) { toast.error('Could not update followers'); setSocials(prev) }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>

  const completion = creatorCompletion({
    avatar_url: avatarUrl || avatarPreview,
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
  // Any edit (form fields, photo, socials) makes the profile dirty.
  const dirty = isDirty || touched

  function cancelEdit() {
    if (creatorId) router.push(`/creators/${creatorId}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
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
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={cancelEdit} className="btn-secondary" disabled={saving}>
            Cancel edit
          </button>
          {dirty && (
            <button type="button" onClick={save} className="btn-primary" disabled={saving || avatarUploading}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {/* Completion - circular ring + missing-item pills */}
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
              Nicely done. Brands see a complete profile.
            </div>
          )}
        </div>
      </div>


      {/* Photo + name */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">About you</h2>
        <div className="flex items-center gap-4">
          <Avatar src={avatarPreview || avatarUrl} name={displayName} size={64} />
          <div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="btn-secondary text-sm"
            >
              {avatarPreview || avatarUrl ? 'Replace photo' : 'Upload photo'}
            </button>
            <p className="text-xs text-gray-400 mt-1">
              {avatarPreview ? 'Photo ready. Click Save changes to apply it.' : 'PNG or JPG, max 2 MB. This is the first thing brands see.'}
            </p>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) selectAvatar(f) }}
          />
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName} required minLength={2}
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
            Nothing here yet. Add a few of your best posts so brands can see what you make.
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
          <p className="text-xs text-gray-400">No accounts yet. Add at least one so brands can find you.</p>
        )}
        {socials.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {socials.map((s, i) => {
              const Icon = socialIcon(s.platform)
              return (
                <div key={s.id} className="social-row" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '13px 14px',
                  borderTop: i ? '1px solid var(--line)' : 'none',
                  background: s.is_primary ? 'var(--accent-tint)' : 'var(--surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ width: 34, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                      <Icon size={28} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{SOCIAL_LABELS[s.platform as SocialPlatform] || s.platform}</span>
                        {s.is_primary && (
                          <span className="badge" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700,
                            background: 'var(--accent)', color: '#fff', padding: '2px 7px',
                          }}>
                            <Star size={9.5} fill="currentColor" /> Primary
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{socialHandleLabel(s.platform as SocialPlatform, s.handle)}</a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <input
                          type="number" min="0" inputMode="numeric"
                          className="input"
                          style={{ height: 30, width: 130, fontSize: 12.5, padding: '4px 9px' }}
                          placeholder="Follower count"
                          defaultValue={s.follower_count ?? ''}
                          onBlur={e => updateFollowers(s.id, e.target.value)}
                        />
                        <span style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)' }}>followers</span>
                        {s.follower_count == null && (
                          <span className="badge badge-gray" style={{ fontSize: 10 }}>add this</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {!s.is_primary && (
                      <button type="button" onClick={() => makePrimary(s.id)} className="social-action"
                        style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--accent-deep)', padding: '6px 10px', borderRadius: 8, background: 'transparent', border: 0, cursor: 'pointer' }}>
                        Make primary
                      </button>
                    )}
                    <button type="button" onClick={() => removeSocial(s.id)} className="social-remove" title="Remove" aria-label="Remove"
                      style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, color: 'var(--ink-faint-solid)', background: 'transparent', border: 0, cursor: 'pointer' }}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {SOCIAL_PLATFORMS.every(p => socials.some(s => s.platform === p)) ? (
          <p className="text-xs text-gray-400">All platforms connected.</p>
        ) : (
        <form onSubmit={addSocial} className="space-y-2" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
          <select className="input" value={newPlatform}
            onChange={e => setNewPlatform(e.target.value as SocialPlatform)}>
            {SOCIAL_PLATFORMS.filter(p => !socials.some(s => s.platform === p))
              .map(p => <option key={p} value={p}>{SOCIAL_LABELS[p]}</option>)}
          </select>
          <input className="input"
            inputMode="text"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="@username"
            value={newHandle} onChange={e => setNewHandle(e.target.value)} />
          <div className="flex gap-2">
            <input className="input" type="number" min="0" placeholder="Follower count" style={{ flex: 1 }}
              value={newFollowers} onChange={e => setNewFollowers(e.target.value)} />
            <button type="submit" className="btn-secondary text-sm shrink-0" disabled={addingSocial || !newHandle.trim() || !newFollowers.trim()}>
              {addingSocial ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
        )}
        <p className="text-xs text-gray-400">Each handle can only be used once per platform on collabr. Follower counts are self-reported. Your primary account is the one brands see first.</p>
      </div>
    </div>
  )
}

// Circular completion ring - mirrors the dashboard CompletionNudge SVG tokens.
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
