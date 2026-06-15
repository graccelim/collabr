'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  CREATOR_NICHES, BRAND_INDUSTRIES, SOCIAL_PLATFORMS,
  NICHE_LABELS, INDUSTRY_LABELS, SOCIAL_LABELS, normalizeUrl,
  extractHandle, socialUrl as buildSocialUrl,
  type CreatorNiche, type SocialPlatform,
} from '@/lib/onboarding'
import { socialIcon } from '@/components/SocialIcon'
import { Plus, X } from 'lucide-react'

const MAX_NICHES = 4

// One repeatable social-profile row. `url` accepts a handle or a pasted profile
// URL — extractHandle() normalizes either to the canonical stored handle.
interface SocialRow { platform: SocialPlatform; url: string; followers: string }

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
  // Repeatable social-profile builder — starts with one row. Order matters: the
  // first row is submitted first and the API marks it primary.
  const [socialRows, setSocialRows] = useState<SocialRow[]>([
    { platform: 'instagram', url: '', followers: '' },
  ])

  // Brand state
  const [companyName, setCompanyName] = useState(initial.company_name || '')
  const [industry, setIndustry] = useState(initial.industry || '')
  const [website, setWebsite] = useState(initial.website || '')
  const [socialUrl, setSocialUrl] = useState(initial.social_url || '')

  function updateRow(i: number, patch: Partial<SocialRow>) {
    setSocialRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function changePlatform(i: number, platform: SocialPlatform) {
    // Guard against duplicates (the <select> already disables taken platforms).
    setSocialRows(rows => rows.some((r, idx) => idx !== i && r.platform === platform)
      ? rows
      : rows.map((r, idx) => (idx === i ? { ...r, platform } : r)))
  }
  function addRow() {
    setSocialRows(rows => {
      const used = new Set(rows.map(r => r.platform))
      const next = SOCIAL_PLATFORMS.find(p => !used.has(p))
      return next ? [...rows, { platform: next, url: '', followers: '' }] : rows
    })
  }
  function removeRow(i: number) {
    setSocialRows(rows => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows))
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
      // Row order is preserved → the first profile becomes primary server-side.
      // `handle` carries the raw URL/handle; the schema's extractHandle() normalizes it.
      const socials = socialRows
        .filter(r => r.url.trim())
        .map(r => ({
          platform: r.platform,
          handle: r.url.trim(),
          follower_count: r.followers ? parseInt(r.followers, 10) : null,
        }))
      if (socials.length === 0) { toast.error('Add at least one social profile'); return }
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

        <div className="card space-y-3">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Social profiles</h2>
            <p className="text-xs text-gray-400 mt-1">
              Add at least one — this is what brands open to check you out. Your first profile is shown to brands as your primary.
            </p>
          </div>

          {(() => {
            const usedPlatforms = new Set(socialRows.map(r => r.platform))
            const canAddMore = usedPlatforms.size < SOCIAL_PLATFORMS.length
            return (
              <>
                <div className="space-y-3">
                  {socialRows.map((row, i) => {
                    const Icon = socialIcon(row.platform)
                    const normalized = row.url.trim() ? buildSocialUrl(row.platform, extractHandle(row.platform, row.url)) : ''
                    const example = buildSocialUrl(row.platform, 'username').replace(/^https?:\/\//, '')
                    return (
                      <div key={i} className="space-y-2" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                        <div className="flex items-center gap-2">
                          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
                            <Icon size={15} />
                          </span>
                          <select className="input" style={{ flex: 1, minWidth: 0 }} value={row.platform}
                            onChange={e => changePlatform(i, e.target.value as SocialPlatform)}>
                            {SOCIAL_PLATFORMS.map(p => (
                              <option key={p} value={p} disabled={p !== row.platform && usedPlatforms.has(p)}>
                                {SOCIAL_LABELS[p]}
                              </option>
                            ))}
                          </select>
                          {i === 0 && (
                            <span className="badge badge-accent" style={{ fontSize: 10.5, flexShrink: 0 }}>Primary</span>
                          )}
                          {socialRows.length > 1 && (
                            <button type="button" onClick={() => removeRow(i)} aria-label="Remove profile"
                              style={{ flexShrink: 0, border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8 }}>
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        <input className="input" inputMode="url"
                          placeholder={row.platform === 'xiaohongshu' ? 'Paste your profile link' : `Profile URL — e.g. ${example}`}
                          value={row.url}
                          onChange={e => updateRow(i, { url: e.target.value })} />
                        <input className="input" type="number" min="0" placeholder="Follower count (optional)"
                          value={row.followers}
                          onChange={e => updateRow(i, { followers: e.target.value })} />
                        {normalized && (
                          <p className="text-xs" style={{ color: 'var(--ink-faint-solid)', wordBreak: 'break-all' }}>
                            → {normalized.replace(/^https?:\/\//, '')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {canAddMore && (
                  <button type="button" onClick={addRow}
                    className="btn-secondary text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={15} /> Add another platform
                  </button>
                )}
              </>
            )
          })()}
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
