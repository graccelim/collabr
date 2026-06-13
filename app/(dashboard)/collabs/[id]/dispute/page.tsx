import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getUserRow } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import DisputeForm from '@/components/DisputeForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function DisputePage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const supabase = createClient()

  const profile = await getUserRow()
  const isBrand = profile?.role === 'brand'

  // Admin client: counterparty display identity is RLS own-row-only for
  // session clients. The explicit party check below still gates access.
  const { data: collab } = await createAdminClient().from('collabs')
    .select(`*, campaigns(title), creator_profiles(id, user_id, users(display_name)), brand_profiles(id, user_id, company_name)`)
    .eq('id', params.id).single()

  if (!collab) return <p>Collab not found.</p>

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (brandUserId !== user.id && creatorUserId !== user.id) {
    return <p style={{ color: 'var(--danger)' }}>You don't have access to this collab.</p>
  }

  const allowedStatuses = ['draft_submitted', 'in_revision', 'draft_approved', 'live_submitted']
  if (!allowedStatuses.includes(collab.status)) {
    return (
      <div style={{ maxWidth: 600 }}>
        <Link href={`/collabs/${params.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--ink-soft)', textDecoration: 'none', marginBottom: 20 }}>
          <ChevronLeft size={16} /> Back to collab
        </Link>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Disputes cannot be raised at this stage (status: {collab.status}).</p>
        </div>
      </div>
    )
  }

  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'
  const brandName = (collab.brand_profiles as any)?.company_name || 'Brand'

  return (
    <div style={{ maxWidth: 800 }}>
      {/* back link */}
      <Link href={`/collabs/${params.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--ink-soft)', textDecoration: 'none', marginBottom: 24 }}>
        <ChevronLeft size={16} /> Back to collab
      </Link>

      <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* form */}
        <DisputeForm
          collabId={params.id}
          isBrand={isBrand}
          brandName={brandName}
          creatorName={creatorName}
        />

        {/* sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 24 }}>
          {/* escrow frozen notice */}
          <div style={{ padding: '14px 16px', background: 'var(--warn-tint)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(217,119,6,.2)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--warn-deep)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
              🔒 Escrow is frozen during a dispute
            </div>
            <p style={{ fontSize: 13, color: 'var(--warn-deep)', margin: 0, lineHeight: 1.55 }}>
              The <strong>{formatSGD(collab.agreed_rate)}</strong> stays locked. Neither side can release or withdraw it until a mediator decides.
            </p>
          </div>

          {/* what happens next */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>What happens next</div>
            {[
              ['You submit this dispute', 'Escrow freezes immediately'],
              ['Both sides share evidence', 'Each side has 24 hours to respond'],
              ['A neutral mediator reviews', 'Within 3 business days'],
              ['We decide & settle', 'Release, refund, or a fair split'],
            ].map(([title, sub], i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 13, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-display)' }}>{i + 1}</span>
                  {i < arr.length - 1 && <span style={{ width: 2, flex: 1, background: 'var(--line)', margin: '4px 0' }} />}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? 18 : 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
