'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Send, Lock } from 'lucide-react'
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
 * sharing is flagged server-side for moderation and the sender is warned -
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
      const next: Message[] = data.messages || []
      // Only update state when something actually changed (avoids needless
      // re-renders + scroll jank on each poll tick).
      setMessages(prev =>
        prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id
          ? prev
          : next
      )
    }
    setLoaded(true)
  }, [collabId])

  useEffect(() => { load() }, [load])

  // Light polling so the other party's replies appear without a manual reload.
  // Only while the tab is visible; refresh immediately on regaining focus.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const id = setInterval(tick, 12_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [load])

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
    if (data.blocked) {
      // Not delivered - contact info detected. Keep the draft so they can edit.
      toast.error(
        "Not sent, phone numbers, emails and handles can't be shared in chat. Keep deals on collabr so your payment protection stays in effect.",
        { duration: 6000 },
      )
      setSending(false)
      return
    }
    setMessages(m => [...m, data.message])
    setDraft('')
    setSending(false)
  }

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-tint)', color: 'var(--accent-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12,
        }}>{getInitials(counterpartName)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{counterpartName}</div>
          <div className="micro">Messages</div>
        </div>
        <span className="badge badge-money" style={{ flexShrink: 0 }}>
          <Lock size={11} /> Protected chat
        </span>
      </div>

      {/* thread */}
      <div ref={scrollRef} className="scroll-y" style={{ maxHeight: 360, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!loaded ? (
          <p className="small" style={{ color: 'var(--ink-faint-solid)', textAlign: 'center', padding: 20 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p className="small" style={{ color: 'var(--ink-faint-solid)', textAlign: 'center', padding: 20, lineHeight: 1.5 }}>
            No messages yet. Coordinate the brief, drafts and timing here -<br />keep everything on collabr so your payment protection stays in effect.
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
                <span className="micro">
                  {mine ? 'You' : getInitials(counterpartName)} · {new Date(m.created_at).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })}
                </span>
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
          <button type="submit" className="btn btn-primary" aria-label="Send message" disabled={sending || !draft.trim()} style={{ height: 40, flexShrink: 0, gap: 6 }}>
            <Send size={15} />
            <span>Send</span>
          </button>
        </div>
        <p className="micro" style={{ lineHeight: 1.4 }}>
          Keep deals on collabr, payment protection only covers on-platform payments. Phone numbers, emails and handles can&rsquo;t be sent here.
        </p>
      </form>
    </div>
  )
}
