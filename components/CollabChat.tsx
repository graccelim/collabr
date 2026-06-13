'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Send, ShieldAlert, MessageSquare } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface Message {
  id: string
  sender_id: string
  body: string
  flagged: boolean
  flag_reasons: string[]
  created_at: string
}

interface Props {
  collabId: string
  currentUserId: string
  counterpartName: string
}

/**
 * Collab chat (Phase 11). Scoped to the two parties; off-platform contact
 * sharing is flagged server-side for moderation and the sender is warned —
 * escrow only protects on-platform deals.
 */
export default function CollabChat({ collabId, currentUserId, counterpartName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/collabs/${collabId}/messages`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages || [])
    }
    setLoaded(true)
  }, [collabId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    const res = await fetch(`/api/collabs/${collabId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not send')
      setSending(false)
      return
    }
    setMessages(m => [...m, data.message])
    setDraft('')
    if (data.flagged) {
      toast(
        'Heads up — sharing contact details or moving off collabr may get your account reviewed. Escrow only protects on-platform deals.',
        { icon: '⚠️', duration: 6000 },
      )
    }
    setSending(false)
  }

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={16} style={{ color: 'var(--ink-soft)' }} />
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Messages</h2>
        <span className="micro" style={{ marginLeft: 'auto' }}>with {counterpartName}</span>
      </div>

      {/* thread */}
      <div ref={scrollRef} className="scroll-y" style={{ maxHeight: 360, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!loaded ? (
          <p className="small" style={{ color: 'var(--ink-faint-solid)', textAlign: 'center', padding: 20 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p className="small" style={{ color: 'var(--ink-faint-solid)', textAlign: 'center', padding: 20, lineHeight: 1.5 }}>
            No messages yet. Coordinate the brief, drafts and timing here —<br />keep everything on collabr so escrow stays in effect.
          </p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === currentUserId
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
                <div style={{
                  maxWidth: '78%', padding: '9px 13px', borderRadius: 14,
                  background: mine ? 'var(--accent)' : 'var(--surface-2)',
                  color: mine ? '#fff' : 'var(--ink)',
                  fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  borderBottomRightRadius: mine ? 4 : 14,
                  borderBottomLeftRadius: mine ? 14 : 4,
                }}>
                  {m.body}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.flagged && (
                    <span className="micro" style={{ color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ShieldAlert size={11} /> Flagged for review
                    </span>
                  )}
                  <span className="micro">
                    {mine ? 'You' : getInitials(counterpartName)} · {new Date(m.created_at).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* composer */}
      <form onSubmit={send} style={{ borderTop: '1px solid var(--line)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }}
            placeholder={`Message ${counterpartName.split(' ')[0]}…`}
            rows={1}
            style={{
              flex: 1, resize: 'none', minHeight: 40, maxHeight: 120,
              padding: '10px 13px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line-strong)', background: 'var(--surface)',
              fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.4,
            }}
          />
          <button type="submit" className="btn-primary" disabled={sending || !draft.trim()} style={{ height: 40, flexShrink: 0 }}>
            <Send size={15} />
          </button>
        </div>
        <p className="micro" style={{ lineHeight: 1.4 }}>
          Keep deals on collabr — escrow only protects on-platform payments. Sharing phone numbers, emails or handles is flagged for review.
        </p>
      </form>
    </div>
  )
}
