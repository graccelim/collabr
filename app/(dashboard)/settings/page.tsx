'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { BRAND_INDUSTRIES, INDUSTRY_LABELS, normalizeUrl, extractHandle, socialUrl as buildSocialUrl } from '@/lib/onboarding'
import { brandCompletion } from '@/lib/profile-completion'
import { friendlyUploadError, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import SocialProfileBuilder, { type SocialRow } from '@/components/SocialProfileBuilder'

interface SettingsFields {
  role: 'brand' | 'creator' | null
  displayName: string; companyName: string; companyDescription: string
  industry: string; location: string; website: string; socials: SocialRow[]; logoUrl: string
}

// Convert builder rows → only the ones with a username, deduped by platform.
function rowsWithInput(rows: SocialRow[]): SocialRow[] {
  return rows.filter(r => r.username.trim())
}

// Detect a platform from a legacy single social_url so existing brands keep it.
function platformFromUrl(url: string): SocialRow['platform'] | null {
  const u = url.toLowerCase()
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('tiktok.com')) return 'tiktok'
  if (u.includes('youtube.com')) return 'youtube'
  if (u.includes('x.com') || u.includes('twitter.com')) return 'x'
  if (u.includes('lemon8')) return 'lemon8'
  if (u.includes('xiaohongshu')) return 'xiaohongshu'
  return null
}

// Serialized editable state, used to detect changes since load.
function settingsSnapshot(f: SettingsFields): string {
  if (f.role === 'brand') {
    return JSON.stringify({
      name: f.companyName.trim(), desc: f.companyDescription.trim(), industry: f.industry,
      location: f.location.trim(), website: f.website.trim(),
      socials: rowsWithInput(f.socials).map(r => ({ p: r.platform, u: r.username.trim(), f: r.followers.trim() })),
      logo: f.logoUrl.trim(), display: f.displayName.trim(),
    })
  }
  return JSON.stringify({ display: f.displayName.trim() })
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [role, setRole] = useState<'brand' | 'creator' | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  const [socialRows, setSocialRows] = useState<SocialRow[]>([])
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [brandId, setBrandId] = useState('')
  // Snapshot of the form as loaded; logo uploads count as an edit too. Together
  // they drive the Save changes / Cancel edit button.
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase.from('users')
        .select('display_name, role').eq('id', user.id).single()
      if (!profile) return
      setDisplayName(profile.display_name || '')
      setRole(profile.role as 'brand' | 'creator')

      if (profile.role === 'brand') {
        // `location` (020) and `socials` (021) are newer - fall back if not applied.
        const BCOLS = 'id, company_name, company_description, industry, website, social_url, logo_url, rating_avg, rating_count, completed_campaigns'
        let brand: any = null
        const r1 = await supabase.from('brand_profiles').select(`${BCOLS}, location, socials`).eq('user_id', user.id).single()
        brand = r1.data
        if (!brand) {
          const r2 = await supabase.from('brand_profiles').select(`${BCOLS}, location`).eq('user_id', user.id).single()
          brand = r2.data
        }
        if (!brand) {
          const r3 = await supabase.from('brand_profiles').select(BCOLS).eq('user_id', user.id).single()
          brand = r3.data
        }
        if (brand) {
          let rows: SocialRow[] = Array.isArray(brand.socials) && brand.socials.length > 0
            ? brand.socials.map((s: any) => ({ platform: s.platform, username: s.handle || '', followers: s.follower_count != null ? String(s.follower_count) : '' }))
            : []
          // Legacy fallback: seed the builder from the single social_url if present.
          if (rows.length === 0 && brand.social_url) {
            const p = platformFromUrl(brand.social_url)
            if (p) rows = [{ platform: p, username: extractHandle(p, brand.social_url), followers: '' }]
          }
          setBrandId((brand as any).id || '')
          setCompanyName(brand.company_name || '')
          setCompanyDescription(brand.company_description || '')
          setIndustry(brand.industry || '')
          setLocation((brand as any).location || '')
          setWebsite(brand.website || '')
          setSocialRows(rows)
          setLogoUrl(brand.logo_url || '')
          setInitialSnapshot(settingsSnapshot({
            role: 'brand', displayName: profile.display_name || '',
            companyName: brand.company_name || '', companyDescription: brand.company_description || '',
            industry: brand.industry || '', location: (brand as any).location || '',
            website: brand.website || '', socials: rows, logoUrl: brand.logo_url || '',
          }))
        }
      } else {
        setInitialSnapshot(settingsSnapshot({
          role: profile.role as 'creator', displayName: profile.display_name || '',
          companyName: '', companyDescription: '', industry: '', location: '', website: '', socials: [], logoUrl: '',
        }))
      }
    }
    load()
  }, [])

  async function uploadLogo(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error('Please upload a PNG, JPG or WebP image.'); return }
    if (file.size > MAX_IMAGE_BYTES) { toast.error('That image is too large. Please upload one under 2 MB.'); return }
    setLogoUploading(true)
    // The storage RLS policy keys the filename to auth.uid(); read it fresh so a
    // not-yet-loaded `userId` can never produce a rejected "logos/-..." path.
    const uid = userId || (await supabase.auth.getUser()).data.user?.id
    if (!uid) { toast.error('Please sign in again to upload your logo.'); setLogoUploading(false); return }
    const ext = file.name.split('.').pop()
    // Use the shared `avatars` bucket: its policy only requires the file be named
    // `{uid}-...`, which every authenticated user satisfies. (The legacy
    // brand-assets bucket needs a `logos/` folder policy that isn't reliably
    // applied, which was causing the RLS rejection.)
    const path = `${uid}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { toast.error(friendlyUploadError(error, 'logo')); setLogoUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setLogoUrl(data.publicUrl)
    setTouched(true)
    setLogoUploading(false)
    toast.success('Logo uploaded')
  }

  async function save() {
    if (saving) return
    setSaving(true)

    if (role === 'brand') {
      if (!companyName.trim()) { toast.error('Company name is required'); setSaving(false); return }
      // Build the brand's socials (first row = primary); social_url mirrors the primary.
      const socials = rowsWithInput(socialRows).map((r, i) => {
        const handle = extractHandle(r.platform, r.username)
        return {
          platform: r.platform, handle, url: buildSocialUrl(r.platform, handle),
          is_primary: i === 0, follower_count: r.followers ? parseInt(r.followers, 10) : null,
        }
      })
      const websiteUrl = normalizeUrl(website)
      if (!websiteUrl && socials.length === 0) {
        toast.error('Add a website or a social profile'); setSaving(false); return
      }
      // Server-side validation (zod) lives in the profile API.
      const res = await fetch('/api/profile/brand', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_description: companyDescription.trim() || null,
          industry: industry || null,
          location: location.trim() || null,
          website: websiteUrl,
          social_url: socials[0]?.url || null,
          socials,
          logo_url: logoUrl.trim() || null,
          display_name: displayName.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Save failed'); setSaving(false); return }
    } else {
      await supabase.from('users').update({ display_name: displayName }).eq('id', userId)
    }

    toast.success('Saved')
    // Brands: return to the public profile creators see.
    if (role === 'brand' && brandId) router.push(`/brands/${brandId}`)
    else setSaving(false)
  }

  const completion = role === 'brand' ? brandCompletion({
    logo_url: logoUrl,
    company_name: companyName,
    company_description: companyDescription,
    industry,
    website,
    social_url: rowsWithInput(socialRows).length > 0 ? 'set' : '',
  }) : null

  // Any edit (fields or logo) makes the form dirty → Save changes; else Cancel edit.
  const dirty = touched || (initialSnapshot !== null && settingsSnapshot({
    role, displayName, companyName, companyDescription, industry, location, website, socials: socialRows, logoUrl,
  }) !== initialSnapshot)

  function cancelEdit() {
    if (role === 'brand' && brandId) router.push(`/brands/${brandId}`)
    else router.push('/dashboard')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Workspace</div>
          <h1 style={{ fontSize: 28 }}>{role === 'brand' ? 'Brand profile' : 'Settings'}</h1>
          {role === 'brand' && (
            <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
              This is what creators see before applying, a complete profile gets 3× more replies.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={cancelEdit} className="btn-secondary" disabled={saving}>
            Cancel edit
          </button>
          {dirty && (
            <button type="button" onClick={save} className="btn-primary" disabled={saving || logoUploading}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {/* Account */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Account</h2>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
      </div>


      {/* Brand profile - only shown for brand users */}
      {role === 'brand' && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Brand profile</h2>
            {completion && (
              <>
                <p className="text-xs text-gray-500 mt-1">{completion.score}% complete</p>
                <div className="w-full bg-surface rounded-full h-1.5 mt-1.5">
                  <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${completion.score}%` }} />
                </div>
                {completion.score < 100 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {completion.items.filter(i => !i.done).map(i => (
                      <span key={i.key} className="badge badge-gray text-xs">+ {i.label}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Logo */}
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-4">
              <Avatar src={logoUrl} name={companyName} size={64} />
              <div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="btn-secondary text-sm"
                >
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload logo'}
                </button>
                <p className="text-xs text-gray-400 mt-1">PNG or JPG, max 2 MB</p>
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }}
            />
          </div>

          <div>
            <label className="label">Company name</label>
            <input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Pte Ltd" />
          </div>

          <div>
            <label className="label">About your company</label>
            <textarea
              className="input min-h-[80px] resize-none"
              value={companyDescription}
              maxLength={2000}
              onChange={e => setCompanyDescription(e.target.value)}
              placeholder="What you sell, who it's for, and what creators should know about working with you."
            />
            <p className="text-xs text-gray-400 mt-1">Creators see this before applying to your campaigns</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Industry</label>
              <select className="input" value={industry} onChange={e => setIndustry(e.target.value)}>
                <option value="">Select industry</option>
                {BRAND_INDUSTRIES.map(i => <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={location} maxLength={120}
                onChange={e => setLocation(e.target.value)} placeholder="Singapore" />
            </div>
          </div>

          <div>
            <label className="label">Website</label>
            <input
              className="input"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="yourcompany.com"
              type="text" inputMode="url"
            />
          </div>

          <div>
            <label className="label">Social profiles</label>
            <SocialProfileBuilder rows={socialRows} onChange={setSocialRows} showFollowers={false} />
            <p className="text-xs text-gray-400 mt-2">
              Pick a platform and enter your handle, we build the link. Your first profile is shown as primary. A website or a social profile is required.
            </p>
          </div>
        </div>
      )}

      {/* Support */}
      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Support</h2>
        <p className="text-sm text-gray-500">
          Questions, disputes, or anything else, email{' '}
          <a href="mailto:joincollabr@gmail.com" style={{ color: 'var(--accent-deep)', fontWeight: 600 }}>joincollabr@gmail.com</a>{' '}
          and we read every message.
        </p>
      </div>
    </div>
  )
}
