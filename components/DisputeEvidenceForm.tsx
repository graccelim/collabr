'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Paperclip, Plus, X, Send } from 'lucide-react'

/**
 * Lets either party add evidence to an open dispute: a written explanation plus
 * links to screenshots / images / files / posts (paste a shareable link).
 */
export default function DisputeEvidenceForm({ collabId }: { collabId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [urls, setUrls] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)

  const setUrl = (i: number, v: string) => setUrls(u => u.map((x, idx) => (idx === i ? v : x)))
  const addUrl = () => setUrls(u => (u.length < 10 ? [...u, ''] : u))
  const removeUrl = (i: number) => setUrls(u => (u.length > 1 ? u.filter((_, idx) => idx !== i) : ['']))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const cleanUrls = urls.map(u => u.trim()).filter(Boolean)
    if (!body.trim() && cleanUrls.length === 0) { toast.error('Add a note or an attachment link'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/dispute/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), attachment_urls: cleanUrls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Evidence submitted, both sides can see it')
      setBody(''); setUrls([''])
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not submit your evidence')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Submit evidence</div>
      <textarea
        className="textarea"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Explain your side — what happened, the timeline, and what you'd like to see happen."
        style={{ minHeight: 90 }}
        maxLength={5000}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {urls.map((u, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Paperclip size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
            <input
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              value={u}
              onChange={e => setUrl(i, e.target.value)}
              placeholder="Link to a screenshot, image, file or post (https://…)"
              inputMode="url"
            />
            {(urls.length > 1 || u) && (
              <button type="button" onClick={() => removeUrl(i)} aria-label="Remove link"
                style={{ flexShrink: 0, border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 7 }}>
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        {urls.length < 10 && (
          <button type="button" onClick={addUrl} className="btn-ghost"
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Plus size={14} /> Add another link
          </button>
        )}
      </div>
      <button type="submit" className="btn-primary" disabled={submitting}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <Send size={15} /> {submitting ? 'Submitting…' : 'Submit evidence'}
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', margin: 0 }}>
        Both sides can see submitted evidence. A Collabr mediator reviews everything before deciding.
      </p>
    </form>
  )
}
