import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getUserRow } from '@/lib/auth'
import { isPaymentSecured } from '@/lib/collab-status'
import { formatSGD, COLLAB_STATUSES, relativeTime, getInitials } from '@/lib/utils'
import CollabActions from '@/components/CollabActions'
import DraftSubmitForm from '@/components/DraftSubmitForm'
import ReviewForm from '@/components/ReviewForm'
import BrandReviewActions from '@/components/BrandReviewActions'
import CreatorLivePostForm from '@/components/CreatorLivePostForm'
import CollabResultsForm from '@/components/CollabResultsForm'
import CollabResultsView from '@/components/CollabResultsView'
import WorkflowTimeline from '@/components/WorkflowTimeline'
import EscrowTimeline from '@/components/EscrowTimeline'
import CollabChat from '@/components/CollabChat'
import ShippingDetails from '@/components/ShippingDetails'
import DisputeStatusCard from '@/components/DisputeStatusCard'
import InfoTip from '@/components/InfoTip'
import { TERMS } from '@/lib/terms'
import EmptyState from '@/components/EmptyState'
import { escrowStep } from '@/lib/workflow'
import { Lock, CheckCircle2, AlertCircle, SearchX, ShieldAlert, Star, ChevronLeft, LifeBuoy } from 'lucide-react'
import Link from 'next/link'
import RatingChip from '@/components/RatingChip'

// Destination domain for an external draft link, so the brand sees where a
// "View draft" actually points before clicking.
function externalHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'external link' }
}

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

  const profile = await getUserRow()
  const isBrand = profile?.role === 'brand'

  // Admin client: counterparty display identity is RLS own-row-only for
  // session clients. The explicit party check below still gates access.
  const adminForRead = createAdminClient()
  const { data: collab } = await adminForRead.from('collabs')
    .select(`
      *,
      campaigns(title, brief, deliverable_types),
      creator_profiles(id, bio, rating_avg, rating_count, users(display_name, avatar_url)),
      brand_profiles(id, company_name, user_id, rating_avg, rating_count)
    `)
    .eq('id', params.id).single()

  if (!collab) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto' }}>
        <EmptyState
          icon={SearchX}
          title="We couldn't find this collab"
          body="It doesn't exist, or it may have been removed. Head back and pick another from your list."
          actionHref="/collabs"
          actionLabel="Back to collabs"
        />
      </div>
    )
  }

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const admin = createAdminClient()
  const [
    { data: creatorProfile },
    { data: connectProfile },
    { data: submissions },
    { data: livePost },
    { data: existingReview },
    { data: counterpartyReview },
    { data: collabResult },
  ] = await Promise.all([
    supabase.from('creator_profiles').select('user_id').eq('id', collab.creator_id).single(),
    admin.from('creator_profiles').select('stripe_connect_id').eq('id', collab.creator_id).single(),
    supabase.from('submissions').select('*').eq('collab_id', params.id).order('version', { ascending: false }),
    supabase.from('live_posts').select('*').eq('collab_id', params.id).maybeSingle(),
    supabase.from('reviews').select('rating, note').eq('collab_id', params.id).eq('reviewer_id', user.id).maybeSingle(),
    // The other side's review - RLS only returns it once it's REVEALED
    // (both submitted, or 7 days). Session client respects the reveal gate.
    supabase.from('reviews').select('rating, note, created_at')
      .eq('collab_id', params.id)
      .eq('reviewer_type', profile?.role === 'brand' ? 'creator' : 'brand')
      .maybeSingle(),
    admin.from('collab_results').select('views, likes, comments, shares, saves, post_url, reported_at').eq('collab_id', params.id).maybeSingle(),
  ])
  if (brandUserId !== user.id && creatorProfile?.user_id !== user.id) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto' }}>
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this collab"
          body="Only the brand and creator on a collab can view it. If you think this is a mistake, check that you're signed in to the right account."
          actionHref="/collabs"
          actionLabel="Back to collabs"
        />
      </div>
    )
  }

  // Product promise: creators only enter the workspace once escrow is secured.
  // Before funding the collab is invisible to the creator — their application
  // still reads "Applied" — so bounce them back rather than expose it. The brand
  // keeps access here so they can fund.
  // Invite-accepted collabs stay visible to the creator pre-funding; cold,
  // unfunded brand selections are bounced (their app still reads "Applied").
  if (!isBrand && collab.status === 'briefed' && !isPaymentSecured(collab.payment_status) && !collab.from_invite) {
    redirect('/applications')
  }
  const status = COLLAB_STATUSES[collab.status as keyof typeof COLLAB_STATUSES]
  const paymentInfo = PAYMENT_TRUTH[collab.payment_status] ?? PAYMENT_TRUTH.unfunded
  const isBarter = (collab.agreed_rate ?? 0) === 0

  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'
  const brandName = (collab.brand_profiles as any)?.company_name || 'Brand'
  const creatorHasConnect = !!connectProfile?.stripe_connect_id
  const latestSubmission = submissions?.[0] ?? null
  const latestFeedback = latestSubmission?.brand_feedback ?? null

  const canDispute = ['draft_submitted', 'in_revision', 'draft_approved', 'live_submitted'].includes(collab.status)

  // Barter shipping details (structured address; replaces pasting it in chat)
  // + open/resolved dispute — independent reads, fetched concurrently.
  const [{ data: shipping }, { data: dispute }] = await Promise.all([
    isBarter
      ? adminForRead.from('collab_shipping')
          .select('recipient_name, phone, address_line1, address_line2, postal_code, country, delivery_notes, submitted_at, updated_at, shipped_at')
          .eq('collab_id', params.id).maybeSingle()
      : Promise.resolve({ data: null }),
    adminForRead.from('disputes')
      .select('id, raised_by, reason, created_at, outcome, resolved_at, split_percentage')
      .eq('collab_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  let disputeEvidence: { author_type: 'brand' | 'creator'; body: string | null; attachment_urls: string[]; created_at: string }[] = []
  if (dispute) {
    const { data: ev } = await adminForRead.from('dispute_evidence')
      .select('author_type, body, attachment_urls, created_at')
      .eq('dispute_id', dispute.id).order('created_at', { ascending: true })
    // Resolve uploaded files (stored as `storage:<path>`) to short-lived signed
    // URLs; external links pass through untouched.
    disputeEvidence = await Promise.all(((ev as typeof disputeEvidence) || []).map(async (item) => ({
      ...item,
      attachment_urls: await Promise.all((item.attachment_urls || []).map(async (a) => {
        if (!a.startsWith('storage:')) return a
        const { data } = await adminForRead.storage.from('dispute-evidence').createSignedUrl(a.slice(8), 3600)
        return data?.signedUrl || a
      })),
    })))
  }
  const showDisputeCard = !!dispute && (collab.status === 'disputed' || (!!dispute.resolved_at && ['completed', 'cancelled'].includes(collab.status)))

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      <Link
        href="/collabs"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 18, color: 'var(--ink-faint-solid)',
          fontSize: 13, textDecoration: 'none',
        }}
      >
        <ChevronLeft size={15} /> All collabs
      </Link>

      {/* ── Deal header ───────────────────────────────────── */}
      {/* Identity row (avatar + title/counterpart) and the status badge are
         two separate rows, not one shared flex line - campaign titles are
         user-entered and can be long, and a badge sharing that row (even
         top-aligned) ends up squeezed into a narrow column alongside a
         wrapping title on a phone-width screen. Decoupling them means the
         title always gets the full row to wrap in, at any length. The deal
         amount is the hero of the escrow card right below, so it isn't
         repeated here (that cramped the mobile header). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: isBrand ? 'var(--creator-tint)' : 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: isBrand ? 'var(--creator-deep)' : 'var(--ink)', flexShrink: 0 }}>
          {getInitials(isBrand ? creatorName : brandName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="display-face" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 4 }}>
            {collab.campaigns?.title}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>
            {isBrand ? `with ${creatorName}` : `for ${brandName}`}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <span className={`badge badge-${status?.color || 'neutral'}`}>{status?.label || collab.status}</span>
      </div>

      {/* ── Escrow timeline + status strip. Barter collabs carry no money, so
            they get a simple "no payment" strip instead. ── */}
      {isBarter ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--accent-tint)', borderRadius: 'var(--radius-sm)', marginBottom: 28, border: '1px solid var(--accent-tint-2)' }}>
          <CheckCircle2 size={16} color="var(--accent-deep)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--accent-deep)', display: 'inline-flex', alignItems: 'center' }}>
            Barter collaboration, no payment <InfoTip text={TERMS.barter} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)' }}>Product / service exchange</span>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <EscrowTimeline current={escrowStep(collab.status, collab.payment_status)} amount={formatSGD(collab.agreed_rate)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: paymentInfo.bg, borderRadius: 'var(--radius-sm)', marginBottom: 28, border: `1px solid ${paymentInfo.color}22` }}>
            <Lock size={16} color={paymentInfo.color} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: paymentInfo.color, display: 'inline-flex', alignItems: 'center' }}>
              {paymentInfo.label} <InfoTip text={TERMS.escrow} />
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: paymentInfo.color }}>{formatSGD(collab.agreed_rate)}</span>
          </div>
        </>
      )}

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

          {/* Barter: structured shipping details (so addresses don't live in chat) */}
          {isBarter && !['cancelled'].includes(collab.status) && (
            <ShippingDetails
              collabId={params.id}
              isBrand={isBrand}
              isCreator={!isBrand}
              creatorName={creatorName}
              shipping={shipping as any}
            />
          )}

          {/* Messages - on-platform chat (protection stays in effect only here) */}
          {!['cancelled'].includes(collab.status) && (
            <CollabChat
              collabId={params.id}
              currentUserId={user.id}
              counterpartName={isBrand ? creatorName : brandName}
            />
          )}

          {/* Financials, barter has no payment, so no breakdown is shown. */}
          {!isBarter && (
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
          )}

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
                    {/* Internal files open through the signed-URL route. External
                        links show their destination domain so the viewer knows
                        they're leaving collabr - no opaque redirect to phishing. */}
                    {(s.storage_path || s.file_url) ? (
                      <div style={{ padding: '0 14px 10px' }}>
                        <a href={`/api/submissions/${s.id}/file`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--creator-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          View draft →
                        </a>
                      </div>
                    ) : s.external_url ? (
                      <div style={{ padding: '0 14px 10px' }}>
                        <a href={s.external_url} target="_blank" rel="noopener noreferrer nofollow"
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--creator-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          External link: {externalHost(s.external_url)} ↗
                        </a>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 3 }}>
                          Opens an external site in a new tab, verify the domain before continuing.
                        </div>
                      </div>
                    ) : null}
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

          {/* Reported results — creator adds/edits; brand sees read-only */}
          {!isBrand && ['live_submitted', 'live_confirmed', 'completed'].includes(collab.status) && (
            <CollabResultsForm collabId={params.id} existing={(collabResult as any) ?? null} />
          )}
          {isBrand && collabResult && <CollabResultsView result={collabResult as any} />}

          {/* Counterparty reputation + their revealed feedback (double-blind) */}
          {collab.status === 'completed' && (() => {
            const cpName = isBrand ? creatorName : brandName
            const cp = (isBrand ? collab.creator_profiles : collab.brand_profiles) as any
            const cr = counterpartyReview as { rating: number; note: string | null } | null
            return (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                    {cp?.id
                      ? <Link href={isBrand ? `/creators/${cp.id}` : `/brands/${cp.id}`} style={{ color: 'var(--ink)' }}>{cpName}&rsquo;s reputation →</Link>
                      : <>{cpName}&rsquo;s reputation</>}
                  </h2>
                  <RatingChip avg={cp?.rating_avg} count={cp?.rating_count} label={isBrand ? 'New creator' : 'New to collabr'} />
                </div>
                {cr ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={14} fill={s <= cr.rating ? 'currentColor' : 'none'}
                          style={{ color: s <= cr.rating ? 'var(--warn)' : 'var(--line-strong)' }} />
                      ))}
                    </div>
                    {cr.note
                      ? <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>&ldquo;{cr.note}&rdquo;</p>
                      : <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)', margin: 0 }}>Rated this collaboration, no note left.</p>}
                    <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', margin: '8px 0 0' }}>What {cpName} thought of working with you.</p>
                  </div>
                ) : existingReview ? (
                  <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)', margin: '12px 0 0', lineHeight: 1.5 }}>
                    {cpName}&rsquo;s review is hidden until you&rsquo;ve both reviewed, or 7 days after the collab. Reviews reveal together, so feedback stays honest.
                  </p>
                ) : null}
              </div>
            )
          })()}

          {/* Completed review */}
          <ReviewForm
            collabId={params.id}
            collabStatus={collab.status}
            existingReview={existingReview ?? null}
          />

          {/* Open or resolved dispute, status, evidence thread, add-evidence form */}
          {showDisputeCard && dispute && (
            <DisputeStatusCard
              collabId={params.id}
              isBrand={isBrand}
              raisedByType={dispute.raised_by as 'brand' | 'creator'}
              reason={dispute.reason}
              openedAt={dispute.created_at}
              outcome={dispute.outcome}
              resolvedAt={dispute.resolved_at}
              splitPercentage={dispute.split_percentage}
              evidence={disputeEvidence}
              isBarter={isBarter}
            />
          )}

          {/* Dispute section */}
          {canDispute && (
            <div id="dispute-section" className="card" style={{ padding: 20, border: '1px solid rgba(220,38,38,.2)' }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Something wrong?</div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 14px', lineHeight: 1.5 }}>
                    {isBarter
                      ? 'If the collab has gone sideways, raising a dispute pauses it immediately. A collabr mediator reviews both sides within 3 business days.'
                      : 'If the collab has gone sideways, raising a dispute freezes the protected payment immediately. A collabr mediator reviews both sides within 3 business days.'}
                  </p>
                  <a
                    href={`/collabs/${params.id}/dispute`}
                    className="dispute-cta"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 14, fontWeight: 600, color: 'var(--danger)', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(220,38,38,.3)', textDecoration: 'none', transition: 'background .15s' }}
                  >
                    Raise a dispute
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: sticky timeline + actions ─── */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WorkflowTimeline
            status={collab.status}
            paymentStatus={collab.payment_status}
            isBrand={isBrand}
            counterpartName={isBrand ? creatorName : brandName}
            revisionCount={collab.revision_count ?? 0}
            draftAutoApproveAt={collab.draft_auto_approve_at ?? null}
            liveAutoReleaseAt={collab.live_auto_release_at ?? null}
            isBarter={isBarter}
          />

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
            payoutReviewAt={collab.payout_review_at || null}
          />

          {/* Brand: draft review panel */}
          {isBrand && collab.payment_status === 'funded' && collab.status === 'draft_submitted' && latestSubmission && (
            <BrandReviewActions
              collabId={params.id}
              submissionId={latestSubmission.id}
              creatorName={creatorName}
              revisionCount={collab.revision_count ?? 0}
              draftAutoApproveAt={collab.draft_auto_approve_at ?? null}
            />
          )}
        </div>

      </div>

      {/* Per-collab support - a dispute or a question goes straight to our inbox,
          pre-tagged with this collab. */}
      <div style={{
        marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
          Need to raise a dispute or have a question about this collab?
        </span>
        <a
          href={`mailto:joincollabr@gmail.com?subject=${encodeURIComponent(`Collab support: ${collab.campaigns?.title ?? params.id} (${params.id})`)}`}
          className="btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}
        >
          <LifeBuoy size={15} /> Contact support
        </a>
      </div>
    </div>
  )
}
