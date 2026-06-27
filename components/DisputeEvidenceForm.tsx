'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Paperclip, Plus, X, Send, Upload, FileText } from 'lucide-react'

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

/**
 * Lets either party add evidence to an open dispute: a written explanation,
 * uploaded files (screenshots / images / docs), and/or pasted links.
 */
export default function DisputeEvidenceForm({ collabId }: { collabId: string }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [urls, setUrls] = useState<string[]>([''])
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const setUrl = (i: number, v: string) => setUrls(u => u.map((x, idx) => (idx === i ? v : x)))
  const addUrl = () => setUrls(u => (u.length < 10 ? [...u, ''] : u))
  const removeUrl = (i: number) => setUrls(u => (u.length > 1 ? u.filter((_, idx) => idx !== i) : ['']))

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    const tooBig = picked.find(f => f.size > MAX_SIZE)
    if (tooBig) { toast.error(`"${tooBig.name}" is over 25MB`); return }
    setFiles(prev => [...prev, ...picked].slice(0, 10))
  }
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const cleanUrls = urls.map(u => u.trim()).filter(Boolean)
    if (!body.trim() && cleanUrls.length === 0 && files.length === 0) {
      toast.error('Add a note, a file, or a link'); return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      if (body.trim()) fd.append('body', body.trim())
      cleanUrls.forEach(u => fd.append('urls', u))
      files.forEach(f => fd.append('files', f))
      const res = await fetch(`/api/collabs/${collabId}/dispute/evidence`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const failed: string[] = data.failed_files || []
      if (failed.length) {
        // Partial success: the note + links + other files were saved; tell the
        // user exactly which files didn't upload so they can retry just those.
        toast.success('Your note and links were saved.')
        toast.error(`Couldn't upload: ${failed.join(', ')}. Try those again.`, { duration: 6000 })
      } else {
        toast.success('Evidence submitted, both sides can see it')
      }
      setBody(''); setUrls([''])
      // Keep only the files that failed so the user can re-attempt them.
      setFiles(prev => prev.filter(f => failed.includes(f.name)))
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
        placeholder="Explain your side, what happened, the timeline, and what you'd like to see happen."
        style={{ minHeight: 90 }}
        maxLength={5000}
      />

      {/* Uploaded files */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input ref={fileInput} type="file" multiple hidden
          onChange={e => { addFiles(e.target.files); if (fileInput.current) fileInput.current.value = '' }} />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary"
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
          <Upload size={15} /> Upload files (screenshots, images, docs)
        </button>
        {files.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' }}>
            <FileText size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            <button type="button" onClick={() => removeFile(i)} aria-label="Remove file"
              style={{ flexShrink: 0, border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 7 }}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Pasted links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {urls.map((u, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Paperclip size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
            <input
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              value={u}
              onChange={e => setUrl(i, e.target.value)}
              placeholder="…or paste a link (post URL, Drive, etc.)"
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
