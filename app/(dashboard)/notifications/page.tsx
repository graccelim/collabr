import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { relativeTime } from '@/lib/utils'
import Link from 'next/link'
import MarkNotificationsRead from '@/components/MarkNotificationsRead'
import EmptyState from '@/components/EmptyState'
import { Bell } from 'lucide-react'

const TYPE_ICONS: Record<string, string> = {
  new_application: '📩',
  application_selected: '🎉',
  application_shortlisted: '📋',
  application_rejected: '—',
  draft_submitted: '📄',
  draft_approved: '✅',
  draft_auto_approved: '✅',
  revision_requested: '✏️',
  draft_rejected: '✗',
  live_submitted: '🌐',
  payment_released: '💸',
  collab_cancelled: '✗',
  dispute_raised: '⚠️',
  dispute_resolved: '⚖️',
  draft_expiring: '⏰',
  live_expiring: '⏰',
  invite_received: '💌',
  invite_accepted: '🤝',
  invite_declined: '—',
}

export default async function NotificationsPage() {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: notifications } = await supabase.from('notifications')
    .select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(50)

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
        {notifications && notifications.some(n => !n.read) && (
          <MarkNotificationsRead userId={user.id} />
        )}
      </div>

      {(!notifications || notifications.length === 0) ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          body="Workflow updates — applications, drafts, approvals and payments — will appear here as they happen."
        />
      ) : (
        <div className="space-y-1">
          {notifications.map(n => {
            const icon = TYPE_ICONS[n.type] || '🔔'
            // Deep link: collab first, then campaign (brand events), then the
            // creator's applications list for application updates.
            const payload = (n.payload as any) || {}
            const href: string | null = payload.collab_id
              ? `/collabs/${payload.collab_id}`
              : payload.invite_id
                ? '/invites'
                : n.type === 'new_application' && payload.campaign_id
                  ? `/campaigns/${payload.campaign_id}`
                  : payload.application_id
                    ? '/applications'
                    : null
            const content = (
              <div className={`card flex gap-3 items-start transition-colors ${!n.read ? 'border-purple-200 bg-purple-50/30' : ''}`}>
                <span className="text-lg mt-0.5 shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{relativeTime(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />}
              </div>
            )

            return href
              ? <Link key={n.id} href={href} className="block hover:opacity-90">{content}</Link>
              : <div key={n.id}>{content}</div>
          })}
        </div>
      )}
    </div>
  )
}
