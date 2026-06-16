'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Scale } from 'lucide-react'

interface Props {
  collabId: string
  isBrand: boolean
  brandName: string
  creatorName: string
}

const BRAND_REASONS = [
  "The live post doesn't match the approved draft",
  "The creator never posted the content",
  "Required tags or #ad disclosure are missing",
  "Something else",
]

const CREATOR_REASONS = [
  "The brand won't approve a post that meets the brief",
  "I was asked for work beyond what we agreed",
  "The brand has gone unresponsive",
  "Something else",
]

export default function DisputeForm({ collabId, isBrand, brandName, creatorName }: Props) {
  const router = useRouter()
  const [party, setParty] = useState<'brand' | 'creator'>(isBrand ? 'brand' : 'creator')
  const [reasonIdx, setReasonIdx] = useState<number | null>(null)
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const reasons = party === 'brand' ? BRAND_REASONS : CREATOR_REASONS
  const accent = party === 'brand' ? 'var(--ink)' : 'var(--creator-deep)'
  const accentTint = party === 'brand' ? 'var(--brand-tint)' : 'var(--creator-tint)'

  const fullReason = reasonIdx !== null
    ? `${reasons[reasonIdx]}${detail.trim() ? `: ${detail.trim()}` : ''}`
    : detail.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (reasonIdx === null) { toast.error('Please select a reason'); return }
    if (fullReason.length < 20) { toast.error('Please describe the issue in more detail'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: fullReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSubmitted(true)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Submission failed')
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Scale size={32} color="var(--ink)" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, marginBottom: 10 }}>Dispute opened</h1>
        <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 20px' }}>
          Your case is with our mediation team. The escrow is <strong>frozen</strong>, neither side can touch it until this is resolved.
        </p>
        <div style={{ padding: '12px 16px', background: 'var(--warn-tint)', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--warn-deep)' }}>
          A mediator will reach out to both sides within <strong>3 business days</strong>.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <span className="badge badge-danger" style={{ marginBottom: 12, display: 'inline-flex' }}>Dispute center</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em', marginBottom: 8 }}>Raise a dispute</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          Tell us what went wrong. We'll freeze the escrow and a neutral mediator will review both sides.
        </p>
      </div>

      {/* party selector (only shown if can be either) */}
      <div>
        <label className="label" style={{ marginBottom: 10 }}>I'm raising this as the…</label>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 4, maxWidth: 320 }}>
          {(['brand', 'creator'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setParty(p); setReasonIdx(null) }}
              style={{
                flex: 1, padding: '10px 12px', fontSize: 13.5, fontWeight: 600, borderRadius: 8,
                background: party === p ? 'var(--surface)' : 'transparent',
                color: party === p ? (p === 'brand' ? 'var(--ink)' : 'var(--creator-deep)') : 'var(--ink-soft)',
                border: 'none', cursor: 'pointer', boxShadow: party === p ? 'var(--shadow-sm)' : 'none',
                transition: 'all .14s',
              }}
            >
              {p === 'brand' ? brandName : creatorName}
            </button>
          ))}
        </div>
      </div>

      {/* reason */}
      <div>
        <label className="label" style={{ marginBottom: 10 }}>What's the issue?</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reasons.map((r, i) => {
            const on = reasonIdx === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setReasonIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  background: on ? accentTint : 'var(--surface)',
                  border: on ? `1.5px solid ${accent}` : '1.5px solid var(--line)',
                  transition: 'all .12s', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: on ? `6px solid ${accent}` : '2px solid var(--line)',
                  background: 'var(--surface)', transition: 'all .12s',
                }} />
                <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: on ? 600 : 500 }}>{r}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* detail */}
      <div>
        <label className="label">Explain what happened <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-soft)' }}>- required</span></label>
        <textarea
          className="textarea"
          value={detail}
          onChange={e => setDetail(e.target.value)}
          placeholder="Walk us through the timeline and what you'd like to see happen…"
          style={{ minHeight: 120 }}
        />
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 6 }}>
          The more specific you are, the faster we can resolve it.
        </p>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg btn-block"
        disabled={submitting || reasonIdx === null || fullReason.length < 20}
      >
        <Scale size={18} />
        {submitting ? 'Submitting…' : 'Submit dispute'}
      </button>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: 0 }}>
        Frivolous disputes may affect your collabr standing.
      </p>
    </form>
  )
}
