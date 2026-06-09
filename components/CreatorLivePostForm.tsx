'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check, Link2, Lock, AlertCircle } from 'lucide-react'
import { formatSGD } from '@/lib/utils'

interface Props {
  collabId: string
  brandName: string
  creatorPayout: number
}

const CHECKLIST = [
  { key: 'tag',        label: 'Tagged the brand and the product' },
  { key: 'ad',         label: '#ad or #sponsored disclosure is in the caption' },
  { key: 'caption',    label: 'Caption matches the approved draft' },
  { key: 'partnership',label: 'Added the "Paid partnership" label' },
]

export default function CreatorLivePostForm({ collabId, brandName, creatorPayout }: Props) {
  const router = useRouter()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const allChecked = CHECKLIST.every(item => checked[item.key])
  const ready = allChecked && url.trim().length > 6

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/submit-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Live post submitted — brand has 72 hours to confirm')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Submission failed')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* approved banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'var(--safe-tint)', borderRadius: 'var(--radius)', border: '1px solid rgba(22,163,74,.15)' }}>
        <Check size={18} color="var(--safe)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--safe-deep)' }}>Approved! You're cleared to post.</span>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 6 }}>
          Go live &amp; get paid
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
          Run through this checklist as you post — it protects your payment and keeps the post compliant.
        </p>

        {/* checklist */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 20, border: '1px solid var(--line)' }}>
          {CHECKLIST.map((item, i) => {
            const on = !!checked[item.key]
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setChecked(c => ({ ...c, [item.key]: !c[item.key] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  background: on ? 'rgba(22,163,74,.06)' : 'transparent',
                  borderBottom: i < CHECKLIST.length - 1 ? '1px solid var(--line)' : 'none',
                  border: 'none', fontFamily: 'inherit', transition: 'background .12s',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: on ? 'var(--safe)' : 'var(--surface)',
                  border: on ? 'none' : '2px solid var(--line-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', transition: 'all .12s',
                }}>
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span style={{ fontSize: 14, fontWeight: on ? 600 : 500, color: 'var(--ink)' }}>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* URL input */}
        <label className="label">Live post URL</label>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            type="url"
            className="input"
            placeholder="instagram.com/p/… or tiktok.com/@handle/video/…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{ paddingLeft: 42 }}
            required
          />
          <Link2 size={16} color="var(--ink-faint-solid)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {!allChecked && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <AlertCircle size={14} color="var(--ink-faint-solid)" />
            <span style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>Tick every box before you submit</span>
          </div>
        )}

        <button type="submit" className="btn btn-block btn-lg" style={{ background: 'var(--creator)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--radius-pill)', justifyContent: 'center' }} disabled={!ready || submitting}>
          <Check size={18} strokeWidth={2.5} />
          {submitting ? 'Submitting…' : "I've posted — submit the link"}
        </button>

        {/* 72h auto-release notice */}
        <div style={{ marginTop: 16, padding: '13px 15px', background: 'var(--safe-tint)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Lock size={15} color="var(--safe)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--safe-deep)', lineHeight: 1.5, margin: 0 }}>
            Once {brandName} confirms, <strong>{formatSGD(creatorPayout)}</strong> releases to you.
            If they don't respond, it <strong>auto-releases in 72 hours</strong>.
          </p>
        </div>
      </form>
    </div>
  )
}
