'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { ArrowRight, Shield, Eye } from 'lucide-react'
import { INDUSTRY_LABELS, type BrandIndustry } from '@/lib/onboarding'
import { getInitials } from '@/lib/utils'
import DateField from '@/components/DateField'

const NICHES = ['Food','Beauty','Fashion','Lifestyle','Wellness','Travel','Tech','Home','Parenting','Gaming']
const DELIVERABLES = ['IG Reel','TikTok video','IG Post','IG Stories','YouTube review','Blog post','Unboxing video']
const PLATFORMS = ['Instagram','TikTok','YouTube','X','Lemon8','RED (Xiaohongshu)']

const COMP_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'barter', label: 'Barter' },
  { value: 'both', label: 'Both' },
] as const

export default function PostJobPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState<{ company_name: string; industry: string | null; logo_url: string | null } | null>(null)
  const [form, setForm] = useState({
    title: '', brief: '', comp_type: 'paid' as 'paid' | 'barter' | 'both',
    budget_min: '', budget_max: '', barter_detail: '',
    deadline: '', min_followers: '0', creators_needed: '1',
    niche_tags: [] as string[], deliverable_types: [] as string[],
    platforms: [] as string[],
  })

  function toggle(field: 'niche_tags' | 'deliverable_types' | 'platforms', val: string) {
    setForm(f => ({
      ...f, [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val]
    }))
  }

  // Load the brand's own profile so the live "Creator sees" preview shows real
  // company name / industry / logo (browser client, RLS scopes to own row).
  useEffect(() => {
    async function loadBrand() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('brand_profiles')
        .select('company_name, industry, logo_url').eq('user_id', user.id).single()
      if (data) setBrand(data)
    }
    loadBrand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasPay   = form.comp_type === 'paid' || form.comp_type === 'both'
  const hasBarter = form.comp_type === 'barter' || form.comp_type === 'both'

  // Derived values for the live "Creator sees" preview card.
  const brandIndustryLabel = brand?.industry
    ? (INDUSTRY_LABELS[brand.industry as BrandIndustry] || brand.industry)
    : ''
  const previewPay = hasPay
    ? form.budget_min
      ? `S$${form.budget_min}${form.budget_max ? `–S$${form.budget_max}` : ''}`
      : 'Paid'
    : hasBarter
      ? (form.barter_detail || 'Barter')
      : 'TBD'
  const previewDeliverable = form.deliverable_types[0] || 'TBD'
  const previewDue = form.deadline
    ? new Date(form.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
    : 'Flexible'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.brief) { toast.error('Title and brief are required'); return }
    setLoading(true)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        budget_min: form.budget_min ? parseInt(form.budget_min) * 100 : null,
        budget_max: form.budget_max ? parseInt(form.budget_max) * 100 : null,
        min_followers: parseInt(form.min_followers),
        creators_needed: parseInt(form.creators_needed),
      })
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error); setLoading(false); return }
    toast.success('Campaign is live, creators can apply now. Applications appear on the campaign page.')
    router.push('/campaigns')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Post a campaign</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 4, fontSize: 15 }}>
            Live in under 5 minutes. Free during beta.
          </p>
        </div>
        <Link href="/campaigns" className="btn btn-ghost">Cancel</Link>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }} className="pc-grid">

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Section 1 - Basics */}
          <div className="card" style={{ padding: 24 }}>
            <SectionHead n="1" label="The basics" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Campaign title</label>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  Say it like a person would, creators see this first
                </p>
                <input className="input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Launch our new barrier-repair serum" required />
              </div>
              <div>
                <label className="label">Platforms</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {PLATFORMS.map(p => (
                    <button key={p} type="button"
                      className={`chip${form.platforms.includes(p) ? ' on' : ''}`}
                      onClick={() => toggle('platforms', p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Creator niche</label>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  We&apos;ll surface this to the right creators
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {NICHES.map(n => (
                    <button key={n} type="button"
                      className={`chip${form.niche_tags.includes(n) ? ' on' : ''}`}
                      onClick={() => toggle('niche_tags', n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 - What you need */}
          <div className="card" style={{ padding: 24 }}>
            <SectionHead n="2" label="What you need" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Campaign brief</label>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  Be specific, this is the reference document for any dispute
                </p>
                <textarea className="input textarea" style={{ minHeight: 120 }} value={form.brief}
                  onChange={e => setForm(f => ({ ...f, brief: e.target.value }))}
                  placeholder="What to create, what to say, what to avoid, key messages…" required />
              </div>
              <div>
                <label className="label">Deliverables</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DELIVERABLES.map(d => (
                    <button key={d} type="button"
                      className={`chip${form.deliverable_types.includes(d) ? ' on' : ''}`}
                      onClick={() => toggle('deliverable_types', d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Go live by</label>
                <DateField value={form.deadline} onChange={iso => setForm(f => ({ ...f, deadline: iso }))} />
              </div>
              <div>
                <label className="label">Min followers</label>
                <input className="input" type="number" min="0" value={form.min_followers}
                  onChange={e => setForm(f => ({ ...f, min_followers: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Section 3 - Budget */}
          <div className="card" style={{ padding: 24 }}>
            <SectionHead n="3" label="Budget & escrow" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Compensation</label>
                <div style={{ display: 'inline-flex', background: 'var(--surface-2)', padding: 3, borderRadius: 'var(--radius-sm)', gap: 2 }}>
                  {COMP_OPTIONS.map(o => {
                    const on = form.comp_type === o.value
                    return (
                      <button key={o.value} type="button"
                        onClick={() => setForm(f => ({ ...f, comp_type: o.value }))}
                        style={{
                          height: 36, padding: '0 14px', border: 'none', cursor: 'pointer',
                          borderRadius: 'calc(var(--radius-sm), 2px)',
                          fontSize: 13, fontWeight: 530, letterSpacing: '-0.005em',
                          background: on ? 'var(--surface)' : 'transparent',
                          color: on ? 'var(--ink)' : 'var(--ink-faint-solid)',
                          boxShadow: on ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                          transition: 'all .15s ease',
                        }}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {hasPay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="label">Min budget per creator (SGD)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--ink-soft)' }}>S$</span>
                      <input className="input" type="number" min="0" value={form.budget_min}
                        onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))}
                        placeholder="150" style={{ paddingLeft: 36 }} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Max budget per creator (SGD)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--ink-soft)' }}>S$</span>
                      <input className="input" type="number" min="0" value={form.budget_max}
                        onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))}
                        placeholder="300" style={{ paddingLeft: 36 }} />
                    </div>
                  </div>
                </div>
              )}
              {hasBarter && (
                <div>
                  <label className="label">Barter offer detail</label>
                  <input className="input" value={form.barter_detail}
                    onChange={e => setForm(f => ({ ...f, barter_detail: e.target.value }))}
                    placeholder="Meal for 2, product bundle, gift card…" />
                </div>
              )}
              <div>
                <label className="label">Creators needed</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, creators_needed: String(Math.max(1, parseInt(f.creators_needed || '1') - 1)) }))}
                    style={{ width: 42, height: 42, borderRadius: 10, border: '1.5px solid var(--line-strong)', background: 'var(--surface)', fontSize: 20, color: 'var(--ink)', cursor: 'pointer' }}>
                    –
                  </button>
                  <div className="input" style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, display: 'grid', placeItems: 'center', width: 64 }}>
                    {form.creators_needed}
                  </div>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, creators_needed: String(parseInt(f.creators_needed || '1') + 1) }))}
                    style={{ width: 42, height: 42, borderRadius: 10, border: '1.5px solid var(--line-strong)', background: 'var(--surface)', fontSize: 20, color: 'var(--ink)', cursor: 'pointer' }}>
                    +
                  </button>
                </div>
              </div>

              {/* Secure-tinted escrow reassurance strip */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--money-tint)' }}>
                <Shield size={18} style={{ color: 'var(--money-deep)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--money-deep)', lineHeight: 1.45 }}>
                  You&rsquo;re not charged now. You fund escrow only when you accept a specific creator.
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, paddingBottom: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', gap: 8 }}>
              {loading ? 'Posting…' : <><span>Post campaign</span><ArrowRight size={15} /></>}
            </button>
          </div>
        </form>

        {/* Live preview - exactly the card a creator sees */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Creator sees</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 8, background: 'var(--accent)' }} />
            <div style={{ padding: 18 }}>
              {/* brand row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                    background: 'var(--paper-2)', border: '1px solid var(--line)',
                    display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)',
                  }}>
                    {brand?.logo_url
                      ? <img src={brand.logo_url} alt={brand.company_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitials(brand?.company_name || 'Your brand')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 580, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {brand?.company_name || 'Your brand'}
                    </div>
                    <div className="micro" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {brandIndustryLabel}{brandIndustryLabel ? ' · ' : ''}Singapore
                    </div>
                  </div>
                </div>
                <span className="badge badge-money" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <Shield size={12} /> Escrow
                </span>
              </div>

              {/* live title */}
              <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3 }}>
                {form.title || 'Your campaign title'}
              </div>

              {/* live niche chips */}
              {form.niche_tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {form.niche_tags.map(n => (
                    <span key={n} style={{ fontSize: 11.5, color: 'var(--ink-soft)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 99 }}>{n}</span>
                  ))}
                </div>
              )}

              {/* live 2×2 facts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                {([
                  ['Pay', previewPay],
                  ['Deliverable', previewDeliverable],
                  ['Due', previewDue],
                  ['Spots', `${form.creators_needed} open`],
                ] as const).map(([k, v]) => (
                  <div key={k}>
                    <div className="micro" style={{ textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 540, marginTop: 2, color: 'var(--ink)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, color: 'var(--ink-faint-solid)' }}>
            <Eye size={14} />
            <span className="micro">Live preview updates as you type</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHead({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <span style={{
        width: 24, height: 24, borderRadius: 99, background: 'var(--ink)', color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
      }}>{n}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
    </div>
  )
}
