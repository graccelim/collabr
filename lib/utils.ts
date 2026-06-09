import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSGD(cents: number): string {
  return `S$${(cents / 100).toFixed(2)}`
}

export function computeFee(rateCents: number, plan: 'free' | 'pro'): {
  fee: number; payout: number
} {
  const pct = plan === 'pro' ? 0.08 : 0.12
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
