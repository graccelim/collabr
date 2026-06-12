import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { formatSGD, COLLAB_STATUSES, relativeTime, getInitials } from '@/lib/utils'
import CollabActions from '@/components/CollabActions'
import DraftSubmitForm from '@/components/DraftSubmitForm'
import ReviewForm from '@/components/ReviewForm'
import BrandReviewActions from '@/components/BrandReviewActions'
import CreatorLivePostForm from '@/components/CreatorLivePostForm'
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react'

const PAYMENT_TRUTH: Record<string, { label: string; color: string; bg: string }> = {
  unfunded:         { label: 'Payment not funded', color: 'var(--warn-deep)', bg: 'var(--warn-tint)' },
  authorizing:      { label: 'Payment authorization pending', color: 'var(--warn-deep)', bg: 'var(--warn-tint)' },
  funded:           { label: 'Funds authorized and held', color: 'var(--safe-deep)', bg: 'var(--safe-tint)' },
  capture_pending:  { label: 'Payment capture pending', color: 'var(--warn-deep)', bg: 'var(--warn-tint)' },
  captured:         { label: 'Payment captured · payout pending', color: 'var(--warn-deep)', bg: 'var(--warn-tint)' },
  transfer_pending: { label: 'Creator payout pending', color: 'var(--warn-deep)', bg: 'var(--warn-tint)' },
  paid:             { label: 'Creator paid', color: 'var(--safe-deep)', bg: 'var(--safe-tint)' },
  manual_exception: { label: 'Paid · manually reconciled', color: 'var(--safe-deep)', bg: 'var(--safe-tint)' },
  capture_failed:   { label: 'Payment capture failed', color: 'var(--danger)', bg: 'var(--danger-tint)' },
  transfer_failed:  { label: 'Creator payout failed', color: 'var(--danger)', bg: 'var(--danger-tint)' },
  refund_pending:   { label: 'Refund pending', color: 'var(--warn-deep)', bg: 'var(--warn-tint)' },
  refund_failed:    { label: 'Refund failed', color: 'var(--danger)', bg: 'var(--danger-tint)' },
  refunded:         { label: 'Payment refunded', color: 'var(--ink-soft)', bg: 'var(--paper-2)' },
  cancelled:        { label: 'Payment authorization cancelled', color: 'var(--ink-soft)', bg: 'var(--paper-2)' },
}

export default async function CollabDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isBrand = profile?.role === 'brand'

  const { data: collab } = await supabase.from('collabs')
    .select(`
      *,
      campaigns(title, brief, deliverable_types),
      creator_profiles(id, bio, rating_avg, rating_count, users(display_name, avatar_url)),
      brand_profiles(id, company_name, user_id)
    `)
    .eq('id', params.id).single()

  if (!collab) return <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Collab not found.</p>

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const { data: creatorProfile } = await supabase.from('creator_profiles').select('user_id').eq('id', collab.creator_id).single()
  if (brandUserId !== user.id && creatorProfile?.user_id !== user.id) {
    return <p className="text-sm" style={{ color: 'var(--danger)' }}>You don't have access to this collab.</p>
  }
  const admin = createAdminClient()
  const { data: connectProfile } = await admin.from('creator_profiles')
    .select('stripe_connect_id').eq('id', collab.creator_id).single()

  const { data: submissions } = await supabase.from('submissions')
    .select('*').eq('collab_id', params.id).order('version', { ascending: false })

  const { data: livePost } = await supabase.from('live_posts')
    .select('*').eq('collab_id', params.id).maybeSingle()

  const { data: existingReview } = await supabase.from('reviews')
    .select('rating, note').eq('collab_id', params.id).eq('reviewer_id', user.id).maybeSingle()

  const status = COLLAB_STATUSES[collab.status as keyof typeof COLLAB_STATUSES]
  const paymentInfo = PAYMENT_TRUTH[collab.payment_status] ?? PAYMENT_TRUTH.unfunded

  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'
  const brandName = (collab.brand_profiles as any)?.company_name || 'Brand'
  const creatorHasConnect = !!connectProfile?.stripe_connect_id
  const latestSubmission = submissions?.[0] ?? null
  const latestFeedback = latestSubmission?.brand_feedback ?? null

  const canDispute = ['draft_submitted', 'in_revision', 'draft_approved', 'live_submitted'].includes(collab.status)

  return (
    <div style={{ maxWidth: 960 }}>

      {/* ── Deal header ───────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* avatar */}
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: isBrand ? 'var(--creator-tint)' : 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: isBrand ? 'var(--creator-deep)' : 'var(--ink)', flexShrink: 0 }}>
            {getInitials(isBrand ? creatorName : brandName)}
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 3 }}>
              {collab.campaigns?.title}
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>
              {isBrand ? `with ${creatorName}` : `for ${brandName}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint-solid)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Deal value</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em' }}>{formatSGD(collab.agreed_rate)}</div>
          </div>
          <span className={`badge badge-${status?.color || 'neutral'}`}>{status?.label || collab.status}</span>
        </div>
      </div>

      {/* ── Escrow strip ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: paymentInfo.bg, borderRadius: 'var(--radius-sm)', marginBottom: 28, border: `1px solid ${paymentInfo.color}22` }}>
        <Lock size={16} color={paymentInfo.color} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: paymentInfo.color }}>{paymentInfo.label}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: paymentInfo.color }}>{formatSGD(collab.agreed_rate)}</span>
      </div>

      {/* ── Two-column grid ──────────────────────────────── */}
      <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>

        {/* ── LEFT: main content ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Creator: draft submission */}
          {!isBrand && collab.payment_status === 'funded' && ['briefed', 'in_revision'].includes(collab.status) && (
            <DraftSubmitForm
              collabId={params.id}
              collabStatus={collab.status}
              latestFeedback={latestFeedback}
              revisionCount={collab.revision_count ?? 0}
            />
          )}

          {/* Creator: live post submission */}
          {!isBrand && collab.payment_status === 'funded' && collab.status === 'draft_approved' && (
            <CreatorLivePostForm
              collabId={params.id}
              brandName={brandName}
              creatorPayout={collab.creator_payout}
            />
          )}

          {/* Brief */}
          <div className="card">
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Brief</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{collab.campaigns?.brief}</p>
            {collab.campaigns?.deliverable_types?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                {(collab.campaigns.deliverable_types as string[]).map((d: string) => (
                  <span key={d} className="badge badge-neutral">{d}</span>
                ))}
              </div>
            )}
          </div>

          {/* Financials */}
          <div className="card">
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Payment breakdown</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {[
                { label: 'Agreed rate', value: formatSGD(collab.agreed_rate), sub: null },
                { label: 'Platform fee', value: formatSGD(collab.platform_fee), sub: null },
                { label: 'Creator payout', value: formatSGD(collab.creator_payout), green: true },
              ].map(({ label, value, green }) => (
                <div key={label} style={{ textAlign: 'center', padding: '12px 8px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: green ? 'var(--safe)' : 'var(--ink)', letterSpacing: '-0.02em' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Submission history */}
          {submissions && submissions.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Draft history</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {submissions.map(s => (
                  <div key={s.id} style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Version {s.version}</span>
                      <span className={`badge badge-${s.decision === 'approved' ? 'safe' : s.decision === 'revision' ? 'warn' : s.decision === 'rejected' ? 'danger' : 'neutral'}`}>
                        {s.decision ?? 'pending'}
                      </span>
                    </div>
                    {s.creator_note && (
                      <div style={{ padding: '10px 14px', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Note: </span>{s.creator_note}
                      </div>
                    )}
                    {s.file_url && (
                      <div style={{ padding: '0 14px 10px' }}>
                        <a href={s.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--creator-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          View draft →
                        </a>
                      </div>
                    )}
                    {s.brand_feedback && (
                      <div style={{ margin: '0 14px 14px', padding: '12px 14px', background: 'var(--warn-tint)', borderRadius: 10 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--warn-deep)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                          Brand feedback
                        </div>
                        <p style={{ fontSize: 13.5, color: 'var(--warn-deep)', margin: 0, lineHeight: 1.55 }}>{s.brand_feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live post */}
          {livePost && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="badge badge-safe">Live</span>
                <h2 style={{ fontSize: 14, fontWeight: 700 }}>Live post</h2>
              </div>
              <a href={livePost.post_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--creator-deep)', wordBreak: 'break-all', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                {livePost.post_url}
              </a>
              {livePost.confirmed_at && (
                <p style={{ fontSize: 12.5, color: 'var(--safe-deep)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={13} color="var(--safe)" />
                  Confirmed {new Date(livePost.confirmed_at).toLocaleDateString('en-SG')}
                </p>
              )}
            </div>
          )}

          {/* Completed review */}
          <ReviewForm
            collabId={params.id}
            collabStatus={collab.status}
            existingReview={existingReview ?? null}
          />

          {/* Dispute section */}
          {canDispute && (
            <div id="dispute-section" className="card" style={{ padding: 20, border: '1px solid rgba(220,38,38,.2)' }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Something wrong?</div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 14px', lineHeight: 1.5 }}>
                    If the collab has gone sideways, raising a dispute freezes the escrow immediately. A collabr mediator reviews both sides within 3 business days.
                  </p>
                  <a
                    href={`/collabs/${params.id}/dispute`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 14, fontWeight: 600, color: 'var(--danger)', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(220,38,38,.3)', textDecoration: 'none', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-tint)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Raise a dispute
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: sticky actions ─── */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CollabActions
            collabId={params.id}
            collabStatus={collab.status}
            isBrand={isBrand}
            agreedRate={collab.agreed_rate}
            platformFee={collab.platform_fee}
            creatorPayout={collab.creator_payout}
            creatorName={creatorName}
            paymentStatus={collab.payment_status}
            creatorHasConnect={creatorHasConnect}
            livePostUrl={livePost?.post_url || null}
            liveAutoReleaseAt={collab.live_auto_release_at || null}
          />

          {/* Brand: draft review panel */}
          {isBrand && collab.payment_status === 'funded' && collab.status === 'draft_submitted' && (
            <BrandReviewActions
              collabId={params.id}
              creatorName={creatorName}
              revisionCount={collab.revision_count ?? 0}
              draftAutoApproveAt={collab.draft_auto_approve_at ?? null}
            />
          )}
        </div>

      </div>
    </div>
  )
}
