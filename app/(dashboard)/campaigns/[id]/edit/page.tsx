'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Shield, Lock, AlertTriangle } from 'lucide-react'
import DateField from '@/components/DateField'
import { normalizeNicheTags } from '@/lib/niches'

const NICHES = ['Food','Beauty','Fashion','Lifestyle','Wellness','Travel','Tech','Home','Parenting','Gaming']
const DELIVERABLES = ['IG Reel','TikTok video','IG Post','IG Stories','YouTube review','Blog post','Unboxing video']
const PLATFORMS = ['Instagram','TikTok','YouTube','X','Lemon8','RED (Xiaohongshu)']
const COMP_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'barter', label: 'Barter' },
  { value: 'both', label: 'Both' },
] as const

export default function EditCampaignPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [status, setStatus] = useState<string>('active')
  const [form, setForm] = useState({
    title: '', brief: '', comp_type: 'paid' as 'paid' | 'barter' | 'both',
    budget_min: '', budget_max: '', barter_detail: '',
    deadline: '', min_followers: '0', creators_needed: '1',
    niche_tags: [] as string[], deliverable_types: [] as string[],
    platforms: [] as string[],
  })

  // Load the campaign and pre-fill the form (cents → dollars, slugs → chips).
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/campaigns/${params.id}`)
      if (!res.ok) { toast.error('Campaign not found'); router.push('/campaigns'); return }
      const c = await res.json()
      setStatus(c.status || 'active')
      const slugSet = new Set<string>(c.niche_tags || [])
      const selectedNiches = NICHES.filter(label => {
        const slug = normalizeNicheTags([label])[0]
        return slug ? slugSet.has(slug) : false
      })
      setForm({
        title: c.title || '',
        brief: c.brief || '',
        comp_type: (c.comp_type as 'paid' | 'barter' | 'both') || 'paid',
        budget_min: c.budget_min ? String(Math.round(c.budget_min / 100)) : '',
        budget_max: c.budget_max ? String(Math.round(c.budget_max / 100)) : '',
        barter_detail: c.barter_detail || '',
        deadline: c.deadline ? String(c.deadline).slice(0, 10) : '',
        min_followers: String(c.min_followers ?? 0),
        creators_needed: String(c.creators_needed ?? 1),
        niche_tags: selectedNiches,
        deliverable_types: c.deliverable_types || [],
        platforms: c.platforms || [],
      })
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(field: 'niche_tags' | 'deliverable_types' | 'platforms', val: string) {
    setForm(f => ({
      ...f, [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val],
    }))
  }

  const hasPay = form.comp_type === 'paid' || form.comp_type === 'both'
  const hasBarter = form.comp_type === 'barter' || form.comp_type === 'both'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.brief) { toast.error('Title and brief are required'); return }
    setSaving(true)
    const res = await fetch(`/api/campaigns/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        budget_min: form.budget_min ? parseInt(form.budget_min) * 100 : null,
        budget_max: form.budget_max ? parseInt(form.budget_max) * 100 : null,
        min_followers: parseInt(form.min_followers || '0'),
        creators_needed: parseInt(form.creators_needed || '1'),
      }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Could not save'); setSaving(false); return }
    toast.success('Campaign updated. Applicants and selected creators have been notified.')
    router.push(`/campaigns/${params.id}`)
  }

  async function closeCampaign() {
    if (!confirm('Close this campaign? Creators can no longer apply. Any ongoing collabs are NOT affected and continue as normal.')) return
    setClosing(true)
    const res = await fetch(`/api/campaigns/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Could not close'); setClosing(false); return }
    toast.success('Campaign closed. Ongoing collabs are unaffected.')
    router.push('/campaigns')
  }

  async function reopenCampaign() {
    setClosing(true)
    const res = await fetch(`/api/campaigns/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Could not reopen'); setClosing(false); return }
    toast.success('Campaign reopened, creators can apply again.')
    setStatus('active'); setClosing(false)
  }

  if (loading) return <div style={{ color: 'var(--ink-soft)' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link href={`/campaigns/${params.id}`} className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8, color: 'var(--ink-faint-solid)' }}>
          <ArrowLeft size={13} /> Back to campaign
        </Link>
        <h1 style={{ fontSize: 28 }}>Edit campaign</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 4, fontSize: 15 }}>
          Changes notify everyone who applied. Selected creators are prompted to discuss in chat.
        </p>
      </div>

      {status === 'closed' && (
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--warn-tint)', borderColor: 'rgba(217,119,6,.3)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13.5, color: 'var(--warn-deep)' }}>This campaign is closed, creators can&rsquo;t apply.</span>
          <button type="button" onClick={reopenCampaign} disabled={closing} className="btn-secondary btn-sm">Reopen</button>
        </div>
      )}

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="label">Campaign title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Platforms</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PLATFORMS.map(p => (
                <button key={p} type="button" className={`chip${form.platforms.includes(p) ? ' on' : ''}`} onClick={() => toggle('platforms', p)}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Creator niche</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {NICHES.map(n => (
                <button key={n} type="button" className={`chip${form.niche_tags.includes(n) ? ' on' : ''}`} onClick={() => toggle('niche_tags', n)}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="label">Campaign brief</label>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>The reference document for any dispute.</p>
            <textarea className="input textarea" style={{ minHeight: 120 }} value={form.brief} onChange={e => setForm(f => ({ ...f, brief: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Deliverables</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DELIVERABLES.map(d => (
                <button key={d} type="button" className={`chip${form.deliverable_types.includes(d) ? ' on' : ''}`} onClick={() => toggle('deliverable_types', d)}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Go live by</label>
            <DateField value={form.deadline} onChange={iso => setForm(f => ({ ...f, deadline: iso }))} />
          </div>
          <div>
            <label className="label">Min followers</label>
            <input className="input" type="number" min="0" value={form.min_followers} onChange={e => setForm(f => ({ ...f, min_followers: e.target.value }))} />
          </div>
        </div>

        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="label">Compensation</label>
            <div style={{ display: 'inline-flex', background: 'var(--surface-2)', padding: 3, borderRadius: 'var(--radius-sm)', gap: 2 }}>
              {COMP_OPTIONS.map(o => {
                const on = form.comp_type === o.value
                return (
                  <button key={o.value} type="button" onClick={() => setForm(f => ({ ...f, comp_type: o.value }))}
                    style={{ height: 36, padding: '0 14px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 530, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-faint-solid)', boxShadow: on ? '0 1px 2px rgba(0,0,0,.06)' : 'none', transition: 'all .15s ease' }}>
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
                  <input className="input" type="number" min="0" value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} style={{ paddingLeft: 36 }} />
                </div>
              </div>
              <div>
                <label className="label">Max budget per creator (SGD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--ink-soft)' }}>S$</span>
                  <input className="input" type="number" min="0" value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} style={{ paddingLeft: 36 }} />
                </div>
              </div>
            </div>
          )}
          {hasBarter && (
            <div>
              <label className="label">Barter offer detail</label>
              <input className="input" value={form.barter_detail} onChange={e => setForm(f => ({ ...f, barter_detail: e.target.value }))} placeholder="Meal for 2, product bundle, gift card…" />
            </div>
          )}
          <div>
            <label className="label">Creators needed</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setForm(f => ({ ...f, creators_needed: String(Math.max(1, parseInt(f.creators_needed || '1') - 1)) }))} style={{ width: 42, height: 42, borderRadius: 10, border: '1.5px solid var(--line-strong)', background: 'var(--surface)', fontSize: 20, color: 'var(--ink)', cursor: 'pointer' }}>–</button>
              <div className="input" style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, display: 'grid', placeItems: 'center', width: 64 }}>{form.creators_needed}</div>
              <button type="button" onClick={() => setForm(f => ({ ...f, creators_needed: String(parseInt(f.creators_needed || '1') + 1) }))} style={{ width: 42, height: 42, borderRadius: 10, border: '1.5px solid var(--line-strong)', background: 'var(--surface)', fontSize: 20, color: 'var(--ink)', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--money-tint)' }}>
            <Shield size={18} style={{ color: 'var(--money-deep)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--money-deep)', lineHeight: 1.45 }}>
              Editing doesn&rsquo;t touch escrow. You fund a creator only when you accept them.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingBottom: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', gap: 8 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/campaigns/${params.id}`} className="btn btn-ghost">Cancel</Link>
          {status !== 'closed' && (
            <button type="button" onClick={closeCampaign} disabled={closing} className="btn-secondary" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--danger)' }}>
              <Lock size={15} /> {closing ? 'Closing…' : 'Close campaign'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
