import Link from 'next/link'
import { Users, Scale, Flag, ArrowRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

const TOOLS = [
  {
    href: '/admin/creators', label: 'Creators', icon: Users,
    body: 'Seed creator profiles, generate claim links, and manage brand requests on unclaimed creators.',
  },
  {
    href: '/admin/disputes', label: 'Disputes', icon: Scale,
    body: 'Review and resolve open collab disputes.',
  },
  {
    href: '/admin/flagged-messages', label: 'Flagged messages', icon: Flag,
    body: 'Messages held for review before delivery.',
  },
]

export default async function AdminHomePage() {
  await requireAdmin()
  const admin = createAdminClient()

  // Same counts each tool page computes itself - shown here so there's a
  // reason to open a tool, not just a blind link.
  const [{ count: pendingRequests }, { count: openDisputes }, { count: flagged }] = await Promise.all([
    admin.from('pending_collab_requests').select('*', { count: 'exact', head: true }).is('materialized_at', null),
    admin.from('disputes').select('*', { count: 'exact', head: true }).eq('outcome', 'pending'),
    admin.from('collab_messages').select('*', { count: 'exact', head: true }).eq('flagged', true),
  ])
  const counts: Record<string, number | null> = {
    '/admin/creators': pendingRequests,
    '/admin/disputes': openDisputes,
    '/admin/flagged-messages': flagged,
  }

  return (
    <div>
      <h1 className="h1" style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Admin</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 24 }}>
        Internal ops tools. Not visible to brands or creators.
      </p>
      <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {TOOLS.map(t => {
          const Icon = t.icon
          const count = counts[t.href]
          return (
            <Link key={t.href} href={t.href} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <Icon size={17} />
                </span>
                {!!count && (
                  <span className="badge badge-accent" style={{ flexShrink: 0 }}>{count} pending</span>
                )}
              </div>
              <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px' }}>{t.label}</h2>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0, flex: 1 }}>{t.body}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)', marginTop: 14 }}>
                Open <ArrowRight size={14} />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
