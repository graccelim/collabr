'use client'
import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Share this profile's public link. Uses the native share sheet on mobile
 * (navigator.share) and falls back to copying the URL to the clipboard on
 * desktop. Works for both creator and brand profiles - pass the public path.
 */
export default function ShareProfileButton({
  path, name, label = true,
}: { path: string; name: string; label?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${name} on collabr`, url })
        return
      } catch {
        // User dismissed the sheet, or share isn't allowed - fall back to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Profile link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="btn-secondary"
      aria-label="Share profile"
      title="Share profile"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {label && <span>{copied ? 'Copied' : 'Share'}</span>}
    </button>
  )
}
