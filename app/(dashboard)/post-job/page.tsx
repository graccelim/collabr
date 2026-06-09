'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const NICHES = ['Food','Beauty','Fashion','Lifestyle','Wellness','Travel','Tech','Home','Parenting','Gaming']
const DELIVERABLES = ['IG Reel','TikTok video','IG Post','IG Stories','YouTube review','Blog post','Unboxing video']

export default function PostJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', brief: '', comp_type: 'paid',
    budget_min: '', budget_max: '', barter_detail: '',
    deadline: '', min_followers: '0', creators_needed: '1',
    niche_tags: [] as string[], deliverable_types: [] as string[],
  })

  function toggle(field: 'niche_tags'|'deliverable_types', val: string) {
    setForm(f => ({
      ...f, [field]: f[field].includes(val) ? f[field].filter(x=>x!==val) : [...f[field], val]
    }))
  }

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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Post a campaign</h1>
        <p className="text-sm text-gray-500 mt-0.5">Takes about 5 minutes. Free during beta.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Campaign basics</h2>
          <div>
            <label className="label">Campaign title</label>
            <input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
              placeholder="Skincare launch reel — Summer 2025" required />
          </div>
          <div>
            <label className="label">Brief — what to create, what to avoid, key messages</label>
            <textarea className="input min-h-[120px] resize-none" value={form.brief}
              onChange={e=>setForm(f=>({...f,brief:e.target.value}))}
              placeholder="Describe exactly what you need. Be specific — this is the reference document for any dispute." required />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Deliverables</h2>
          <div className="flex flex-wrap gap-2">
            {DELIVERABLES.map(d => (
              <button key={d} type="button" onClick={()=>toggle('deliverable_types',d)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.deliverable_types.includes(d) ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-gray-600 hover:border-purple-300'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Compensation</h2>
          <div className="flex gap-2">
            {(['paid','barter','both'] as const).map(t => (
              <button key={t} type="button" onClick={()=>setForm(f=>({...f,comp_type:t}))}
                className={`flex-1 py-2 text-sm rounded border transition-colors ${form.comp_type===t ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-gray-600'}`}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          {(form.comp_type==='paid'||form.comp_type==='both') && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Min budget (SGD)</label>
                <input className="input" type="number" value={form.budget_min} onChange={e=>setForm(f=>({...f,budget_min:e.target.value}))} placeholder="150" /></div>
              <div><label className="label">Max budget (SGD)</label>
                <input className="input" type="number" value={form.budget_max} onChange={e=>setForm(f=>({...f,budget_max:e.target.value}))} placeholder="300" /></div>
            </div>
          )}
          {(form.comp_type==='barter'||form.comp_type==='both') && (
            <div><label className="label">Barter offer detail</label>
              <input className="input" value={form.barter_detail} onChange={e=>setForm(f=>({...f,barter_detail:e.target.value}))} placeholder="Meal for 2, product bundle, etc." /></div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Creator requirements</h2>
          <div>
            <label className="label">Niche</label>
            <div className="flex flex-wrap gap-2">
              {NICHES.map(n => (
                <button key={n} type="button" onClick={()=>toggle('niche_tags',n)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.niche_tags.includes(n) ? 'bg-teal-400 text-white border-teal-400' : 'border-border text-gray-600 hover:border-teal-300'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Min followers</label>
              <input className="input" type="number" value={form.min_followers} onChange={e=>setForm(f=>({...f,min_followers:e.target.value}))} /></div>
            <div><label className="label">Creators needed</label>
              <input className="input" type="number" value={form.creators_needed} onChange={e=>setForm(f=>({...f,creators_needed:e.target.value}))} /></div>
          </div>
          <div><label className="label">Content deadline</label>
            <input className="input" type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} /></div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Posting…' : 'Post campaign'}
          </button>
        </div>
      </form>
    </div>
  )
}
