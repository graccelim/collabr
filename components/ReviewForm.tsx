'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface ExistingReview {
  rating: number
  note: string | null
}

interface Props {
  collabId: string
  collabStatus: string
  existingReview: ExistingReview | null
}

export default function ReviewForm({ collabId, collabStatus, existingReview }: Props) {
  const router = useRouter()
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(existingReview?.rating || 0)
  const [note, setNote] = useState(existingReview?.note || '')
  const [submitting, setSubmitting] = useState(false)

  if (collabStatus !== 'completed') return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) { toast.error('Select a star rating'); return }
    setSubmitting(true)
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collab_id: collabId, rating: selected, note: note.trim() || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not submit review')
      setSubmitting(false)
      return
    }
    toast.success('Review submitted, thanks for building trust on collabr')
    router.refresh()
  }

  const display = hovered || selected

  if (existingReview) {
    return (
      <div className="card space-y-2">
        <h2 className="text-sm font-medium text-gray-900">Your review</h2>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <span key={star} className={`text-xl ${star <= existingReview.rating ? 'text-amber-400' : 'text-gray-200'}`}>
              ★
            </span>
          ))}
        </div>
        {existingReview.note && (
          <p className="text-xs text-gray-600">{existingReview.note}</p>
        )}
        <p className="text-xs text-gray-400">Submitted ✓, revealed once you&rsquo;ve both reviewed, or after 7 days.</p>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-medium text-gray-900">Leave a review</h2>
      <p className="text-xs text-gray-500">
        The collab is complete. Reviews are double-blind, yours reveals once you&rsquo;ve both
        reviewed, or after 7 days, so feedback stays honest on both sides.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                className={`text-2xl transition-colors ${star <= display ? 'text-amber-400' : 'text-gray-200'} hover:text-amber-400`}
                onMouseEnter={() => setHovered(star)}
                onClick={() => setSelected(star)}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {display === 1 ? 'Poor' : display === 2 ? 'Fair' : display === 3 ? 'Good' : display === 4 ? 'Great' : display === 5 ? 'Excellent' : 'Select a rating'}
          </p>
        </div>
        <div>
          <label className="label">Note, optional</label>
          <textarea
            className="input min-h-[70px] resize-none"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Share your experience working together."
          />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting || !selected}>
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </form>
    </div>
  )
}
