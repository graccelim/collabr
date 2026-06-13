import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { relativeTime } from '@/lib/utils'
import { ShieldAlert } from 'lucide-react'

// Phase 11 — moderation queue: messages the contact-info detector flagged as a
// possible attempt to take a deal off-platform. Admins review and act manually.
export default async function FlaggedMessagesPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: flagged } = await admin.from('collab_messages')
    .select('id, collab_id, body, flag_reasons, created_at, users(display_name, email)')
    .eq('flagged', true)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldAlert size={20} style={{ color: 'var(--warn)' }} />
        <h1 style={{ fontSize: 28 }}>Flagged messages</h1>
        <span className="badge badge-warn">{flagged?.length || 0}</span>
      </div>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginTop: -8 }}>
        Messages our detector thinks may be moving a deal off-platform. Review and warn or ban manually.
      </p>

      {(!flagged || flagged.length === 0) ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--ink-faint-solid)', fontSize: 14 }}>
          No flagged messages. 🎉
        </div>
      ) : (
        <div className="card row-list" style={{ padding: 0, overflow: 'hidden' }}>
          {flagged.map(m => {
            const sender = (m.users as any)
            return (
              <div key={m.id} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--ink)' }}>
                    {sender?.display_name || 'User'} <span style={{ color: 'var(--ink-faint-solid)', fontWeight: 400 }}>{sender?.email ? `· ${sender.email}` : ''}</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(m.flag_reasons as string[]).map(r => (
                      <span key={r} className="badge badge-warn">{r}</span>
                    ))}
                    <span className="micro">{relativeTime(m.created_at)}</span>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink)', background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {m.body}
                </p>
                <Link href={`/collabs/${m.collab_id}`} style={{ fontSize: 13, color: 'var(--accent-deep)', fontWeight: 530 }}>
                  View collab →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
