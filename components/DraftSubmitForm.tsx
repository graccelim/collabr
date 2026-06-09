'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  collabId: string
  collabStatus: string
}

const SUBMITTABLE_STATUSES = ['briefed', 'in_revision', 'draft_approved']

export default function DraftSubmitForm({ collabId, collabStatus }: Props) {
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

    let fileUrl: string | null = null

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

      const { data: signedData, error: signError } = await supabase.storage
        .from('draft-submissions')
        .createSignedUrl(path, 3600)

      if (signError || !signedData?.signedUrl) {
        toast.error('Could not generate file URL')
        setUploading(false)
        return
      }

      fileUrl = signedData.signedUrl
      setUploading(false)
    } else {
      if (!linkUrl.trim()) { toast.error('Paste a link to your draft'); return }
      fileUrl = linkUrl.trim()
    }

    setSubmitting(true)
    const res = await fetch(`/api/collabs/${collabId}/submit-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_url: fileUrl, creator_note: note.trim() || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Submission failed')
      setSubmitting(false)
      return
    }
    toast.success('Draft submitted — brand has 48 hours to review')
    router.refresh()
  }

  const busy = uploading || submitting

  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-medium text-gray-900">Submit your draft</h2>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 text-xs py-1.5 rounded transition-colors ${mode === 'upload' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`flex-1 text-xs py-1.5 rounded transition-colors ${mode === 'link' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Paste a link
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'upload' ? (
          <div>
            <label className="label">Draft file</label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-purple-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  <p className="text-xs text-purple-600 hover:underline">Change file</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Click to select your file</p>
                  <p className="text-xs text-gray-400">MP4 / MOV up to 500 MB · JPG / PNG up to 20 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploading && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Uploading…</span>
                </div>
                <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-500 h-1.5 rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="label">Link to your draft</label>
            <input
              className="input"
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://drive.google.com/… or Dropbox, WeTransfer, etc."
            />
            <p className="text-xs text-gray-400 mt-1">Make sure the link is accessible to the brand.</p>
          </div>
        )}

        <div>
          <label className="label">Note to brand — optional</label>
          <textarea
            className="input min-h-[70px] resize-none"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Any context, creative choices, or questions for the brand."
          />
        </div>

        <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
          {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit draft'}
        </button>
      </form>
    </div>
  )
}
