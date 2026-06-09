'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const NICHES = ['Food','Beauty','Fashion','Lifestyle','Wellness','Travel','Tech','Home','Parenting','Gaming']
const PLATFORMS = ['instagram','tiktok','youtube']

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [bio, setBio] = useState('')
  const [niches, setNiches] = useState<string[]>([])
  const [baseRate, setBaseRate] = useState('')
  const [platforms, setPlatforms] = useState<Record<string,any>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('creator_profiles').select('*').eq('user_id', user.id).single()
      if (data) {
        setProfile(data)
        setBio(data.bio || '')
        setNiches(data.niches || [])
        setBaseRate(data.base_rate ? String(data.base_rate / 100) : '')
        setPlatforms(data.platforms || {})
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleNiche(n: string) {
    setNiches(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev,n])
  }

  function updatePlatform(p: string, field: string, val: string) {
    setPlatforms(prev => ({ ...prev, [p]: { ...prev[p], [field]: val } }))
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('creator_profiles').update({
      bio, niches,
      base_rate: baseRate ? parseInt(baseRate) * 100 : 0,
      platforms,
    }).eq('user_id', user!.id)
    if (error) toast.error(error.message)
    else toast.success('Profile saved')
    setSaving(false)
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>

  const completionItems = [bio, niches.length > 0, baseRate, Object.keys(platforms).length > 0]
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">{completion}% complete</p>
        <div className="w-full bg-surface rounded-full h-1.5 mt-2">
          <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">About you</h2>
        <div>
          <label className="label">Bio (what brands see first)</label>
          <textarea className="input min-h-[80px] resize-none" value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Food and lifestyle creator based in SG. I make honest content about things I actually use." />
        </div>
        <div>
          <label className="label">Base rate from (SGD per post)</label>
          <input className="input" type="number" value={baseRate}
            onChange={e => setBaseRate(e.target.value)} placeholder="150" />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Your niche</h2>
        <div className="flex flex-wrap gap-2">
          {NICHES.map(n => (
            <button key={n} type="button" onClick={() => toggleNiche(n)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${niches.includes(n) ? 'bg-teal-400 text-white border-teal-400' : 'border-border text-gray-600 hover:border-teal-300'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Platforms</h2>
        {PLATFORMS.map(p => (
          <div key={p} className="space-y-2">
            <label className="label capitalize">{p}</label>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder={`@handle`}
                value={platforms[p]?.handle || ''}
                onChange={e => updatePlatform(p, 'handle', e.target.value)} />
              <input className="input" type="number" placeholder="Followers"
                value={platforms[p]?.followers || ''}
                onChange={e => updatePlatform(p, 'followers', e.target.value)} />
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400">Connect your accounts to get the Verified badge — verification coming soon.</p>
      </div>

      <button onClick={save} className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  )
}
