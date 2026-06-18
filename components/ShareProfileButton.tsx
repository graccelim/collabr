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
  path, name, label = false, noun = 'Profile', compact = false,
}: { path: string; name: string; label?: boolean; noun?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function share(e: React.MouseEvent) {
    // Safe inside a card <Link>: don't navigate or bubble when sharing.
    e.preventDefault()
    e.stopPropagation()
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
      toast.success(`${noun} link copied`)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  // Compact: a 28px bordered icon button matching SaveCampaignButton's compact
  // bookmark, for use inside campaign cards.
  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        aria-label={`Share ${noun.toLowerCase()}`}
        title={`Share ${noun.toLowerCase()}`}
        style={{
          border: '1px solid var(--line-strong)',
          background: 'var(--surface)',
          color: copied ? 'var(--accent-deep)' : 'var(--ink-faint-solid)',
          width: 28, height: 28, borderRadius: 7,
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          transition: 'all .14s ease', flexShrink: 0,
        }}
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={share}
      className="btn-secondary"
      aria-label={`Share ${noun.toLowerCase()}`}
      title={`Share ${noun.toLowerCase()}`}
      style={
        label
          ? { display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }
          : { display: 'grid', placeItems: 'center', flexShrink: 0, width: 40, height: 40, padding: 0 }
      }
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {label && <span>{copied ? 'Copied' : 'Share'}</span>}
    </button>
  )
}
