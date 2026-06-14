'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  CREATOR_NICHES, BRAND_INDUSTRIES, SOCIAL_PLATFORMS,
  NICHE_LABELS, INDUSTRY_LABELS, normalizeUrl,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'

const MAX_NICHES = 4

interface Props {
  role: 'brand' | 'creator'
  initial: {
    niche?: string | null
    niche_tags?: string[] | null
    company_name?: string | null
    industry?: string | null
    website?: string | null
    social_url?: string | null
  }
}

export default function OnboardingForm({ role, initial }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Creator state — multi-niche, capped. First selected is the primary niche.
  const [niches, setNiches] = useState<CreatorNiche[]>(
    (initial.niche_tags?.length ? initial.niche_tags : initial.niche ? [initial.niche] : []) as CreatorNiche[]
  )
  const [handles, setHandles] = useState<Record<SocialPlatform, { handle: string; followers: string }>>({
    instagram: { handle: '', followers: '' },
    tiktok: { handle: '', followers: '' },
    youtube: { handle: '', followers: '' },
  })

  // Brand state
  const [companyName, setCompanyName] = useState(initial.company_name || '')
  const [industry, setIndustry] = useState(initial.industry || '')
  const [website, setWebsite] = useState(initial.website || '')
  const [socialUrl, setSocialUrl] = useState(initial.social_url || '')

  function setHandle(p: SocialPlatform, field: 'handle' | 'followers', val: string) {
    setHandles(prev => ({ ...prev, [p]: { ...prev[p], [field]: val } }))
  }

  function toggleNiche(n: CreatorNiche) {
    setNiches(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n)
      if (prev.length >= MAX_NICHES) { toast.error(`Pick up to ${MAX_NICHES} niches`); return prev }
      return [...prev, n]
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    let endpoint: string
    let payload: Record<string, unknown>

    if (role === 'creator') {
      if (niches.length === 0) { toast.error('Pick at least one niche'); return }
      const socials = SOCIAL_PLATFORMS
        .filter(p => handles[p].handle.trim())
        .map(p => ({
          platform: p,
          handle: handles[p].handle,
          follower_count: handles[p].followers ? parseInt(handles[p].followers, 10) : null,
        }))
      if (socials.length === 0) { toast.error('Connect at least one social account'); return }
      endpoint = '/api/onboarding/creator'
      payload = { niche: niches[0], niche_tags: niches, socials }
    } else {
      if (!companyName.trim()) { toast.error('Company name is required'); return }
      if (!industry) { toast.error('Pick your industry'); return }
      const websiteUrl = normalizeUrl(website)
      const social = normalizeUrl(socialUrl)
      if (!websiteUrl && !social) {
        toast.error('Add a website or a social account link'); return
      }
      endpoint = '/api/onboarding/brand'
      payload = {
        company_name: companyName.trim(),
        industry,
        website: websiteUrl,
        social_url: social,
      }
    }

    setSaving(true)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not complete onboarding')
      setSaving(false)
      return
    }
    toast.success('Onboarding complete!')
    router.push('/dashboard')
    router.refresh()
  }

  if (role === 'creator') {
    return (
      <form onSubmit={submit} className="space-y-6">
        <div className="card space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Your niches</h2>
          <p className="text-xs text-gray-400">
            Pick up to {MAX_NICHES} — brands use these to find you. Your first pick is your primary niche.
            {' '}<span style={{ color: 'var(--ink-soft)' }}>{niches.length}/{MAX_NICHES} selected</span>
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

        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Social accounts</h2>
          <p className="text-xs text-gray-400">Connect at least one — this is what brands see</p>
          {SOCIAL_PLATFORMS.map(p => (
            <div key={p} className="space-y-2">
              <label className="label capitalize">{p}</label>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="@handle"
                  value={handles[p].handle}
                  onChange={e => setHandle(p, 'handle', e.target.value)} />
                <input className="input" type="number" min="0" placeholder="Followers (optional)"
                  value={handles[p].followers}
                  onChange={e => setHandle(p, 'followers', e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Complete onboarding'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card space-y-4">
        <div>
          <label className="label">Company name</label>
          <input className="input" value={companyName}
            onChange={e => setCompanyName(e.target.value)} placeholder="Acme Pte Ltd" required />
        </div>
        <div>
          <label className="label">Industry</label>
          <select className="input" value={industry} onChange={e => setIndustry(e.target.value)} required>
            <option value="">Select industry</option>
            {BRAND_INDUSTRIES.map(i => <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" type="text" inputMode="url" value={website}
            onChange={e => setWebsite(e.target.value)} placeholder="yourcompany.com" />
        </div>
        <div>
          <label className="label">Social account link</label>
          <input className="input" type="text" inputMode="url" value={socialUrl}
            onChange={e => setSocialUrl(e.target.value)} placeholder="instagram.com/yourbrand" />
          <p className="text-xs text-gray-400 mt-1">A website or a social account is required</p>
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Complete onboarding'}
      </button>
    </form>
  )
}
