'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Clock, Check, RotateCcw, AlertTriangle, Send } from 'lucide-react'

interface Props {
  collabId: string
  creatorName: string
  revisionCount: number
  draftAutoApproveAt: string | null
}

function useCountdown(targetIso: string | null) {
  const calc = () =>
    targetIso ? Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)) : 48 * 3600
  const [secs, setSecs] = useState(calc)
  useEffect(() => {
    if (!targetIso) return
    const id = setInterval(() => setSecs(calc), 1000)
    return () => clearInterval(id)
  }, [targetIso])
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { h, m, s, pad }
}

export default function BrandReviewActions({ collabId, creatorName, revisionCount, draftAutoApproveAt }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'revise'>('idle')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { h, m, s, pad } = useCountdown(draftAutoApproveAt)
  const MAX_REVISIONS = 2
  const revisionsLeft = MAX_REVISIONS - revisionCount

  async function decide(decision: 'approved' | 'revision' | 'rejected') {
    if ((decision === 'revision' || decision === 'rejected') && feedback.trim().length < 20) {
      toast.error('Feedback must be at least 20 characters')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/review-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback: feedback.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (decision === 'approved') toast.success('Draft approved — creator can post live now')
      else if (decision === 'revision') toast.success('Revision request sent')
      else toast.success('Draft rejected')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
      setSubmitting(false)
    }
  }

  const CountBlock = ({ val, lbl }: { val: string; lbl: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26,
        color: 'var(--warn)', background: 'var(--warn-tint)',
        borderRadius: 10, padding: '7px 11px', minWidth: 50, textAlign: 'center', lineHeight: 1,
      }}>{val}</div>
      <span style={{ fontSize: 10, color: 'var(--ink-faint-solid)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* countdown */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <Clock size={15} color="var(--warn)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Auto-approves in
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CountBlock val={pad(h)} lbl="hours" />
          <span style={{ color: 'var(--warn)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>:</span>
          <CountBlock val={pad(m)} lbl="min" />
          <span style={{ color: 'var(--warn)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>:</span>
          <CountBlock val={pad(s)} lbl="sec" />
        </div>
        <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--warn-tint)', borderRadius: 10, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} color="var(--warn)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--warn-deep)', lineHeight: 1.5, margin: 0 }}>
            <strong>Auto-approve on:</strong> if you don't respond in time, this draft is approved automatically so the deal doesn't stall.
          </p>
        </div>
      </div>

      {/* actions */}
      <div className="card" style={{ padding: 20 }}>
        {mode === 'idle' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Revision rounds</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                {revisionCount} of {MAX_REVISIONS} used
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-block btn-lg"
                style={{ background: 'var(--safe)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', justifyContent: 'center' }}
                onClick={() => decide('approved')}
                disabled={submitting}
              >
                <Check size={18} strokeWidth={2.5} />
                Approve draft
              </button>
              {revisionsLeft > 0 && (
                <button className="btn btn-outline btn-block" onClick={() => setMode('revise')} disabled={submitting}>
                  <RotateCcw size={16} />
                  Request a revision
                </button>
              )}
              <a
                href="#dispute-section"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', fontSize: 14, fontWeight: 600, color: 'var(--danger)', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(220,38,38,.25)', textDecoration: 'none', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-tint)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Reject &amp; raise an issue
              </a>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>What needs to change?</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.5 }}>
              Be specific — {creatorName} gets this as a checklist.
              {revisionsLeft <= 1 && (
                <span style={{ color: 'var(--warn-deep)' }}> (Last revision round.)</span>
              )}
            </p>
            <textarea
              className="textarea"
              placeholder="e.g. Please add the discount code to the caption, and show the product clearly in the first 3 seconds."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              style={{ minHeight: 120, marginBottom: 8 }}
            />
            <p style={{ fontSize: 12, margin: '0 0 14px', color: feedback.trim().length < 20 ? 'var(--ink-faint-solid)' : 'var(--safe)' }}>
              {feedback.trim().length} / 20 minimum characters
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setMode('idle')} disabled={submitting}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => decide('revision')}
                disabled={submitting || feedback.trim().length < 20}
              >
                <Send size={15} />
                {submitting ? 'Sending…' : 'Send revision request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
