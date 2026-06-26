import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSGD(cents: number): string {
  return `S$${(cents / 100).toFixed(2)}`
}

// Platform commission is charged to the CREATOR, never the brand: 10% on Creator
// Free, 8% on Creator Pro. The brand pays the full agreed rate and has NO commission
// logic of any kind. The invariant fee + payout === rate holds exactly (whole cents).
export const CREATOR_COMMISSION = { free: 0.1, pro: 0.08 } as const

export function computeFee(rateCents: number, creatorPro: boolean): {
  fee: number; payout: number
} {
  const pct = creatorPro ? CREATOR_COMMISSION.pro : CREATOR_COMMISSION.free
  const fee = Math.round(rateCents * pct)
  return { fee, payout: rateCents - fee }
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export const COLLAB_STATUSES = {
  briefed: { label: 'Briefed', color: 'purple' },
  draft_submitted: { label: 'Draft submitted', color: 'amber' },
  in_revision: { label: 'In revision', color: 'coral' },
  draft_approved: { label: 'Draft approved', color: 'teal' },
  live_submitted: { label: 'Live submitted', color: 'purple' },
  live_confirmed: { label: 'Confirmed', color: 'teal' },
  disputed: { label: 'Disputed', color: 'coral' },
  completed: { label: 'Completed', color: 'teal' },
  cancelled: { label: 'Cancelled', color: 'gray' },
} as const

// Max image upload size (matches the storage buckets' file_size_limit).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Turn a raw Supabase storage error into a plain-English message a creator or
 * brand can act on. `noun` is the thing being uploaded ("photo" / "logo").
 */
export function friendlyUploadError(
  err: { message?: string; statusCode?: string | number } | null | undefined,
  noun: 'photo' | 'logo' = 'photo',
): string {
  const m = (err?.message || '').toLowerCase()
  const status = String(err?.statusCode ?? '')
  if (m.includes('exceeded') || m.includes('too large') || m.includes('maximum allowed size') || status === '413') {
    return 'That image is too large. Please upload one under 2 MB.'
  }
  if (m.includes('mime') || m.includes('not supported') || (m.includes('invalid') && m.includes('type'))) {
    return 'Please upload a PNG, JPG or WebP image.'
  }
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('permission') || status === '403') {
    return `We couldn't save your ${noun}. Please sign in again and retry.`
  }
  if (m.includes('bucket not found') || m.includes('not found') || status === '404') {
    return 'Image uploads are temporarily unavailable. Please try again later.'
  }
  return `We couldn't upload your ${noun}. Please try again.`
}
