'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { BRAND_INDUSTRIES, INDUSTRY_LABELS, normalizeUrl } from '@/lib/onboarding'
import { brandCompletion } from '@/lib/profile-completion'

export default function SettingsPage() {
  const supabase = createClient()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [role, setRole] = useState<'brand' | 'creator' | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [socialUrl, setSocialUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')

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
        const { data: brand } = await supabase.from('brand_profiles')
          .select('company_name, company_description, industry, website, social_url, logo_url')
          .eq('user_id', user.id).single()
        if (brand) {
          setCompanyName(brand.company_name || '')
          setCompanyDescription(brand.company_description || '')
          setIndustry(brand.industry || '')
          setWebsite(brand.website || '')
          setSocialUrl(brand.social_url || '')
          setLogoUrl(brand.logo_url || '')
        }
      }
    }
    load()
  }, [])

  async function uploadLogo(file: File) {
    setLogoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `logos/${userId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
    if (error) { toast.error('Logo upload failed'); setLogoUploading(false); return }
    const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
    setLogoUrl(data.publicUrl)
    setLogoUploading(false)
    toast.success('Logo uploaded')
  }

  async function save() {
    if (saving) return
    setSaving(true)

    if (role === 'brand') {
      if (!companyName.trim()) { toast.error('Company name is required'); setSaving(false); return }
      // Server-side validation (zod) lives in the profile API.
      const res = await fetch('/api/profile/brand', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_description: companyDescription.trim() || null,
          industry: industry || null,
          website: normalizeUrl(website),
          social_url: normalizeUrl(socialUrl),
          logo_url: logoUrl.trim() || null,
          display_name: displayName.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Save failed'); setSaving(false); return }
    } else {
      await supabase.from('users').update({ display_name: displayName }).eq('id', userId)
    }

    toast.success('Settings saved')
    setSaving(false)
  }

  const completion = role === 'brand' ? brandCompletion({
    logo_url: logoUrl,
    company_name: companyName,
    company_description: companyDescription,
    industry,
    website,
    social_url: socialUrl,
  }) : null

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <div className="eyebrow" style={{ marginBottom: 7 }}>Workspace</div>
        <h1 style={{ fontSize: 28 }}>{role === 'brand' ? 'Brand profile' : 'Settings'}</h1>
        {role === 'brand' && (
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
            This is what creators see before applying — a complete profile gets 3× more replies.
          </p>
        )}
      </div>

      {/* Account */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Account</h2>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
      </div>

      {/* Brand profile — only shown for brand users */}
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
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover border border-border" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-surface border border-dashed border-border flex items-center justify-center text-gray-400 text-xs">
                  No logo
                </div>
              )}
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

          <div>
            <label className="label">Industry</label>
            <select className="input" value={industry} onChange={e => setIndustry(e.target.value)}>
              <option value="">Select industry</option>
              {BRAND_INDUSTRIES.map(i => <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>)}
            </select>
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
            <label className="label">Social account link</label>
            <input
              className="input"
              value={socialUrl}
              onChange={e => setSocialUrl(e.target.value)}
              placeholder="instagram.com/yourbrand"
              type="text" inputMode="url"
            />
            <p className="text-xs text-gray-400 mt-1">A website or a social account is required</p>
          </div>
        </div>
      )}

      <button onClick={save} className="btn-primary" disabled={saving || logoUploading}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      {/* Support */}
      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Support</h2>
        <p className="text-sm text-gray-500">hello@collabr.sg — we read every email.</p>
        <p className="text-sm text-gray-500">disputes@collabr.sg — for active dispute cases.</p>
      </div>
    </div>
  )
}
