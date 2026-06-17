'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { AlertTriangle, Upload, Link2, X, Check, FileVideo } from 'lucide-react'

interface Props {
  collabId: string
  collabStatus: string
  latestFeedback?: string | null
  revisionCount?: number
}

const SUBMITTABLE_STATUSES = ['briefed', 'in_revision', 'draft_approved']

export default function DraftSubmitForm({ collabId, collabStatus, latestFeedback, revisionCount = 0 }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'upload' | 'link'>('upload')
  const [note, setNote] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!SUBMITTABLE_STATUSES.includes(collabStatus)) return null

  const MAX_VIDEO_BYTES = 500 * 1024 * 1024
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    const isImage = file.type === 'image/jpeg' || file.type === 'image/png'

    if (!isVideo && !isImage) {
      toast.error('Only MP4, MOV, JPG, or PNG files are accepted')
      return
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      toast.error('Video must be under 500 MB')
      return
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be under 20 MB')
      return
    }
    setSelectedFile(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let storagePath: string | null = null
    let externalUrl: string | null = null

    if (mode === 'upload') {
      if (!selectedFile) { toast.error('Select a file to upload'); return }
      setUploading(true)
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${collabId}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('draft-submissions')
        .upload(path, selectedFile)

      if (uploadError) {
        toast.error('Upload failed: ' + uploadError.message)
        setUploading(false)
        return
      }

      storagePath = path
      setUploading(false)
    } else {
      if (!linkUrl.trim()) { toast.error('Paste a link to your draft'); return }
      externalUrl = linkUrl.trim()
    }

    setSubmitting(true)
    const res = await fetch(`/api/collabs/${collabId}/submit-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storage_path: storagePath,
        external_url: externalUrl,
        creator_note: note.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Submission failed')
      setSubmitting(false)
      return
    }
    toast.success('Draft sent, the brand has 48 hours to take a look')
    router.refresh()
  }

  const busy = uploading || submitting
  const isRevision = collabStatus === 'in_revision'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* brand feedback - shown when in revision */}
      {isRevision && latestFeedback && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>B</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Brand's feedback</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Round {revisionCount} of 2</div>
            </div>
            <span className="badge badge-warn" style={{ marginLeft: 'auto' }}>Changes requested</span>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>"{latestFeedback}"</p>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 6 }}>
          {isRevision ? `Upload revision ${revisionCount > 0 ? `(v${revisionCount + 1})` : ''}` : 'Submit your draft'}
        </h2>

        {/* DO NOT POST warning */}
        <div style={{ display: 'flex', gap: 11, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--warn-tint)', border: '1px solid rgba(217,119,6,.2)', marginBottom: 20 }}>
          <AlertTriangle size={17} color="var(--warn)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--warn-deep)' }}>Do not post this publicly yet</div>
            <p style={{ fontSize: 12.5, color: 'var(--warn-deep)', margin: '2px 0 0', lineHeight: 1.45 }}>
              This is a private review. Posting before approval can put your payment at risk.
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 16 }}>
          {(['upload', 'link'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '9px 12px', fontSize: 13.5, fontWeight: 600, borderRadius: 8,
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--ink)' : 'var(--ink-soft)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                transition: 'all .14s',
              }}
            >
              {m === 'upload' ? <Upload size={14} /> : <Link2 size={14} />}
              {m === 'upload' ? 'Upload file' : 'Paste a link'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'upload' ? (
            <div>
              {selectedFile ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--safe-tint)', border: '1.5px solid rgba(22,163,74,.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--safe)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileVideo size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--safe-deep)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Check size={12} strokeWidth={3} /> Ready to send · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                    style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', borderRadius: 6 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--line-strong)', borderRadius: 'var(--radius-sm)', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--creator)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--creator-tint)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line-strong)'; (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: 'var(--shadow-sm)' }}>
                    <Upload size={22} color="var(--creator-deep)" />
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>Click to upload your draft</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>MP4, MOV · up to 500 MB · JPG, PNG · up to 20 MB</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {uploading && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    <span>Uploading…</span>
                  </div>
                  <div style={{ width: '100%', background: 'var(--surface-2)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--creator)', height: 6, borderRadius: 999, width: '75%', animation: 'skelPulse 1.6s ease-in-out infinite' }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="label">Link to your draft</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/… or Dropbox, Frame.io, WeTransfer"
                  style={{ paddingLeft: 40 }}
                />
                <Link2 size={15} color="var(--ink-faint-solid)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>Make sure the link is viewable by anyone.</p>
            </div>
          )}

          <div>
            <label className="label">{isRevision ? 'Reply to the brand' : 'Note to brand'} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-soft)' }}>- optional</span></label>
            <textarea
              className="textarea"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isRevision ? "Let them know what you changed…" : "Any context, creative choices, or questions for the brand."}
              style={{ minHeight: 80 }}
            />
          </div>

          <button type="submit" className="btn btn-block btn-lg" style={{ background: 'var(--creator)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--radius-pill)', justifyContent: 'center' }} disabled={busy}>
            {uploading ? 'Uploading…' : submitting ? 'Submitting…' : isRevision ? 'Submit revised draft' : 'Send draft to brand'}
          </button>
        </form>
      </div>
    </div>
  )
}
