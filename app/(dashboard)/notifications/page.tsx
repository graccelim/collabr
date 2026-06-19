import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { relativeTime } from '@/lib/utils'
import Link from 'next/link'
import MarkNotificationsRead from '@/components/MarkNotificationsRead'
import EmptyState from '@/components/EmptyState'
import type { LucideProps } from 'lucide-react'
import {
  Bell, Inbox, PartyPopper, Star, X, FileText, CheckCircle2,
  Pencil, Globe, Banknote, AlertTriangle, Scale, Clock, Mail, Handshake,
} from 'lucide-react'

type Icon = React.ComponentType<Partial<LucideProps>>
type Tone = 'accent' | 'money' | 'warn' | 'danger' | 'neutral'

// Each notification type maps to a stroke icon + a semantic tone tile.
// Green (money) is reserved for secured/paid moments only.
const TYPE_META: Record<string, { icon: Icon; tone: Tone }> = {
  new_application:         { icon: Inbox,        tone: 'accent' },
  application_selected:    { icon: PartyPopper,  tone: 'money' },
  application_shortlisted: { icon: Star,         tone: 'accent' },
  application_rejected:    { icon: X,            tone: 'neutral' },
  draft_submitted:         { icon: FileText,     tone: 'accent' },
  draft_approved:          { icon: CheckCircle2, tone: 'money' },
  draft_auto_approved:     { icon: CheckCircle2, tone: 'money' },
  revision_requested:      { icon: Pencil,       tone: 'warn' },
  draft_rejected:          { icon: X,            tone: 'danger' },
  live_submitted:          { icon: Globe,        tone: 'accent' },
  payment_released:        { icon: Banknote,     tone: 'money' },
  payout_pending:          { icon: Banknote,     tone: 'warn' },
  payout_review:           { icon: AlertTriangle,tone: 'warn' },
  collab_completed:        { icon: CheckCircle2, tone: 'money' },
  collab_cancelled:        { icon: X,            tone: 'neutral' },
  dispute_raised:          { icon: AlertTriangle,tone: 'danger' },
  dispute_evidence:        { icon: Scale,        tone: 'accent' },
  dispute_resolved:        { icon: Scale,        tone: 'accent' },
  selection_expired:       { icon: Clock,        tone: 'warn' },
  draft_expiring:          { icon: Clock,        tone: 'warn' },
  live_expiring:           { icon: Clock,        tone: 'warn' },
  invite_received:         { icon: Mail,         tone: 'accent' },
  invite_accepted:         { icon: Handshake,    tone: 'money' },
  invite_declined:         { icon: X,            tone: 'neutral' },
}

const TONE_BG: Record<Tone, string> = {
  accent: 'var(--accent-tint)', money: 'var(--money-tint)', warn: 'var(--warn-tint)',
  danger: 'var(--danger-tint)', neutral: 'var(--paper-2)',
}
const TONE_FG: Record<Tone, string> = {
  accent: 'var(--accent)', money: 'var(--money)', warn: 'var(--warn)',
  danger: 'var(--danger)', neutral: 'var(--ink-faint-solid)',
}

export default async function NotificationsPage() {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: notifications } = await supabase.from('notifications')
    .select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(50)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Activity</div>
          <h1 style={{ fontSize: 28 }}>Notifications</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 15 }}>
            Every update across your collabs, the moment it happens.
          </p>
        </div>
        {notifications && notifications.some(n => !n.read) && (
          <MarkNotificationsRead userId={user.id} />
        )}
      </div>

      {(!notifications || notifications.length === 0) ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          body="New applications, drafts, approvals and payments will land here the moment they happen."
        />
      ) : (
        <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
          {notifications.map(n => {
            const meta = TYPE_META[n.type] || { icon: Bell, tone: 'neutral' as Tone }
            const Icon = meta.icon
            const payload = (n.payload as any) || {}
            const href: string | null = payload.collab_id
              ? `/collabs/${payload.collab_id}`
              : payload.invite_id
                ? '/invites'
                : n.type === 'new_application' && payload.campaign_id
                  ? `/campaigns/${payload.campaign_id}`
                  : payload.application_id
                    ? '/applications'
                    // Slug-based public link stored on the notification (e.g. a
                    // campaign-updated nudge → the public campaign page).
                    : typeof payload.href === 'string' && payload.href.startsWith('/')
                      ? payload.href
                      : null

            const content = (
              <div style={{
                display: 'flex', gap: 13, alignItems: 'flex-start',
                padding: '15px 18px',
                background: !n.read ? 'var(--accent-tint-2)' : 'transparent',
              }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  background: TONE_BG[meta.tone], color: TONE_FG[meta.tone],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: !n.read ? 560 : 480, color: 'var(--ink)', lineHeight: 1.45 }}>{n.title}</p>
                  {n.body && <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2, lineHeight: 1.45 }}>{n.body}</p>}
                  <p className="micro" style={{ marginTop: 5 }}>{relativeTime(n.created_at)}</p>
                </div>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />}
              </div>
            )

            return href
              ? <Link key={n.id} href={href} style={{ display: 'block', textDecoration: 'none' }}>{content}</Link>
              : <div key={n.id}>{content}</div>
          })}
        </div>
      )}
    </div>
  )
}
