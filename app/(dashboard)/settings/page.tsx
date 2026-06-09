'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('display_name').eq('id', user.id).single()
        .then(({ data }) => { if (data) setName(data.display_name || '') })
    })
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('users').update({ display_name: name }).eq('id', user!.id)
    toast.success('Settings saved')
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Account</h2>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <button onClick={save} className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Support</h2>
        <p className="text-sm text-gray-500">hello@collabr.sg — we read every email.</p>
        <p className="text-sm text-gray-500">disputes@collabr.sg — for active dispute cases.</p>
      </div>
    </div>
  )
}
