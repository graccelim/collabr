'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'

const NICHES = ['Food','Beauty','Fashion','Lifestyle','Wellness','Travel','Tech','Home','Parenting','Gaming']
const DELIVERABLES = ['IG Reel','TikTok video','IG Post','IG Stories','YouTube review','Blog post','Unboxing video']
const PLATFORMS = ['Instagram','TikTok','YouTube']

export default function PostJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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

  const totalMin = (parseInt(form.budget_min) || 0) * parseInt(form.creators_needed || '1')
  const totalMax = (parseInt(form.budget_max) || 0) * parseInt(form.creators_needed || '1')
  const hasPay   = form.comp_type === 'paid' || form.comp_type === 'both'
  const hasBarter = form.comp_type === 'barter' || form.comp_type === 'both'

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
    toast.success('Campaign posted!')
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
          {/* Section 1 — Basics */}
          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>1 · The basics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Campaign title</label>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  Say it like a person would — creators see this first
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

          {/* Section 2 — What you need */}
          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>2 · What you need</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Campaign brief</label>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  Be specific — this is the reference document for any dispute
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="label">Content deadline</label>
                  <input className="input" type="date" value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Min followers</label>
                  <input className="input" type="number" min="0" value={form.min_followers}
                    onChange={e => setForm(f => ({ ...f, min_followers: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 — Budget */}
          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>3 · Budget & spots</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">Compensation type</label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--radius-pill)', overflow: 'hidden', border: '1.5px solid var(--line-strong)', background: 'var(--surface-2)', width: 'fit-content' }}>
                  {(['paid', 'barter', 'both'] as const).map((t, i) => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, comp_type: t }))}
                      style={{
                        border: 0,
                        background: form.comp_type === t ? 'var(--ink)' : 'transparent',
                        color: form.comp_type === t ? 'var(--paper)' : 'var(--ink-soft)',
                        fontWeight: 600, fontSize: 14,
                        padding: '9px 20px', cursor: 'pointer',
                        transition: 'all .15s ease',
                        borderLeft: i > 0 ? '1px solid var(--line-strong)' : 'none',
                      }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
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
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, paddingBottom: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', gap: 8 }}>
              {loading ? 'Posting…' : <><span>Post campaign</span><ArrowRight size={15} /></>}
            </button>
          </div>
        </form>

        {/* Sticky summary sidebar */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div className="card" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Campaign preview</div>

            {/* Mini preview card */}
            <div style={{
              border: '1px solid var(--line)',
              borderRadius: 14, overflow: 'hidden', marginBottom: 20,
            }}>
              <div style={{
                height: 64,
                background: 'linear-gradient(135deg, var(--accent-tint), var(--accent-tint-2))',
                display: 'flex', alignItems: 'flex-end', padding: 12,
              }}>
                <span style={{ fontSize: 24 }}>✨</span>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.3, color: 'var(--ink)', marginBottom: 10 }}>
                  {form.title || 'Your campaign title'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge badge-money" style={{ fontSize: 12 }}>
                    {hasPay && form.budget_min ? `S$${form.budget_min}` : hasBarter ? 'Barter' : 'TBD'}{hasPay && form.budget_max ? `–S$${form.budget_max}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)', fontVariantNumeric: 'tabular-nums' }}>
                    {form.creators_needed} spot{parseInt(form.creators_needed) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost breakdown */}
            {hasPay && (form.budget_min || form.budget_max) && (
              <>
                <div style={{ height: 1, background: 'var(--line)', margin: '0 0 14px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>{form.creators_needed} creator{parseInt(form.creators_needed) !== 1 ? 's' : ''} × S${form.budget_min || '?'}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {totalMin > 0 ? `S$${totalMin.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Commission <span className="badge badge-accent" style={{ fontSize: 10, padding: '1px 6px' }}>0% beta</span>
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-faint-solid)', textDecoration: 'line-through' }}>S$0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--accent-tint-2)', borderRadius: 10, marginTop: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>To fund in escrow</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--accent-deep)', fontVariantNumeric: 'tabular-nums' }}>
                      S${totalMin.toLocaleString()}{totalMax > totalMin ? `–${totalMax.toLocaleString()}` : ''}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-faint-solid)', lineHeight: 1.4 }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              You only pay when you select creators. Funds stay in escrow until you confirm posts.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
