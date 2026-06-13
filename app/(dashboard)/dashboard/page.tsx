import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser, getUserRow } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, getInitials } from '@/lib/utils'
import { deriveWorkflow, actorLabel } from '@/lib/workflow'
import { brandCompletion, creatorCompletion } from '@/lib/profile-completion'
import { computeFit, bestFollowers } from '@/lib/fit'
import EmptyState from '@/components/EmptyState'
import { ArrowRight, Megaphone, Compass } from 'lucide-react'

// Calm, single-column dashboards (Collabr Redesign): one dark money anchor,
// one attention row, a quiet hairline list, a profile-completion nudge.

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function MoneyPanel({ label, amount, sub }: { label: string; amount: number; sub: string }) {
  return (
    <div className="money-panel">
      <div className="money-label">{label}</div>
      <div className="money-value">{formatSGD(amount)}</div>
      <div className="money-sub">{sub}</div>
    </div>
  )
}

function AttentionRow({ href, text, strong }: { href: string; text: string; strong: string }) {
  return (
    <Link href={href} style={{
      width: '100%', textDecoration: 'none',
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius)', padding: '15px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--warn)', flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>
          <strong style={{ fontWeight: 560 }}>{strong}</strong> {text}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-soft)', fontSize: 13.5, fontWeight: 530, flexShrink: 0 }}>
        Review <ArrowRight size={15} />
      </span>
    </Link>
  )
}

function QuietRow({ href, name, sub, status, statusColor, amount }: {
  href: string; name: string; sub: string; status: string; statusColor: string; amount: number
}) {
  return (
    <Link href={href} style={{
      width: '100%', textDecoration: 'none', borderTop: '1px solid var(--line)',
      padding: '17px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-tint)', color: 'var(--accent-deep)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13,
        }}>{getInitials(name)}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 540, color: 'var(--ink)' }}>{name}</span>
          <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 22, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: statusColor }}>{status}</span>
        <span className="mono-num" style={{ fontSize: 14, color: 'var(--ink-soft)', minWidth: 56, textAlign: 'right' }}>{formatSGD(amount)}</span>
      </span>
    </Link>
  )
}

function CompletionNudge({ href, label, done, total }: { href: string; label: string; done: number; total: number }) {
  if (done >= total) return null
  const pct = (done / total) * 100
  const r = 7, c = 2 * Math.PI * r
  return (
    <Link href={href} style={{
      marginTop: 44, display: 'inline-flex', alignItems: 'center', gap: 8,
      color: 'var(--ink-faint-solid)', fontSize: 13.5, textDecoration: 'none',
    }}>
      <svg width={18} height={18} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--paper-2)" strokeWidth={2.5} />
        <circle cx={9} cy={9} r={r} fill="none" stroke="var(--accent)" strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      {label} — {done} of {total} steps
      <ArrowRight size={14} />
    </Link>
  )
}

export default async function DashboardPage() {
  // Memoized — reuses the layout's getUser + profile read (no extra round-trips).
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const profile = await getUserRow()
  if (!profile) redirect('/signup')

  if (profile.role === 'brand') return <BrandDashboard userId={user.id} />
  if (profile.role === 'creator') return <CreatorDashboard userId={user.id} displayName={profile.display_name} avatarUrl={profile.avatar_url} />
  return <div style={{ color: 'var(--ink-soft)' }}>Loading…</div>
}

/* ───────────────────────── Brand ───────────────────────── */
async function BrandDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles')
    .select('id, user_id, company_name, company_description, industry, website, social_url, logo_url, created_at')
    .eq('user_id', userId).single()
  if (!brand) return (
    <EmptyState
      icon={Megaphone}
      title="Complete your brand profile to get started"
      body="Tell creators who you are, then post your first campaign."
      actionHref="/settings"
      actionLabel="Complete profile"
    />
  )

  // Independent reads — run concurrently. Admin client: creator display
  // identity is RLS own-row-only for session clients; scoped to this brand.
  const [{ data: campaigns }, { data: collabs }] = await Promise.all([
    supabase.from('campaigns').select('id, status').eq('brand_id', brand.id),
    createAdminClient().from('collabs')
      .select('*, campaigns(title), creator_profiles(users(display_name))')
      .eq('brand_id', brand.id).neq('status', 'completed').neq('status', 'cancelled')
      .order('created_at', { ascending: false }).limit(6),
  ])

  const pendingReview = collabs?.filter(c => c.status === 'draft_submitted').length || 0
  const liveToConfirm = collabs?.filter(c => c.status === 'live_submitted').length || 0
  const escrowed = collabs?.filter(c => c.payment_status === 'funded') || []
  const inEscrow = escrowed.reduce((sum, c) => sum + (c.agreed_rate || 0), 0)
  const completion = brandCompletion(brand)

  const statusLine = pendingReview > 0
    ? `You have ${pendingReview} draft${pendingReview > 1 ? 's' : ''} to review. Everything else is on track.`
    : liveToConfirm > 0
      ? `${liveToConfirm} live post${liveToConfirm > 1 ? 's are' : ' is'} waiting for your confirmation.`
      : 'Everything is on track.'

  const isEmpty = (!campaigns || campaigns.length === 0) && (!collabs || collabs.length === 0)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginTop: 8, marginBottom: isEmpty ? 36 : 44 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>{greeting()}, {brand.company_name}</h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          {isEmpty ? 'Post your first campaign to start finding creators.' : statusLine}
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <MoneyPanel
          label="Held in escrow"
          amount={inEscrow}
          sub={inEscrow > 0
            ? `Across ${escrowed.length} collaboration${escrowed.length !== 1 ? 's' : ''} · released only when you approve the work.`
            : 'Nothing secured yet — you’ll fund escrow when you accept your first creator.'}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          icon={Megaphone}
          title="Your first collaboration starts here"
          body="Post a campaign, pick a creator you love, and fund escrow — we’ll walk you through every step. It’s free during beta."
          steps={['Post a campaign', 'Pick a creator', 'Fund escrow']}
          actionHref="/post-job"
          actionLabel="Post a campaign"
        />
      ) : (
        <>
          {/* the single action */}
          {pendingReview > 0 && (
            <div style={{ marginBottom: liveToConfirm > 0 ? 10 : 48 }}>
              <AttentionRow href="/collabs" strong={`${pendingReview} draft${pendingReview > 1 ? 's' : ''}`} text="waiting for your review" />
            </div>
          )}
          {liveToConfirm > 0 && (
            <div style={{ marginBottom: 48 }}>
              <AttentionRow href="/collabs" strong={`${liveToConfirm} live post${liveToConfirm > 1 ? 's' : ''}`} text="ready to confirm and release payment" />
            </div>
          )}
          {pendingReview === 0 && liveToConfirm === 0 && <div style={{ marginBottom: 40 }} />}

          {/* active — quiet hairline list */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="eyebrow">Active collaborations</span>
            <Link href="/campaigns" style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>All campaigns</Link>
          </div>
          <div>
            {(collabs || []).map(c => {
              const name = (c.creator_profiles as any)?.users?.display_name || 'Creator'
              const view = deriveWorkflow({ status: c.status, paymentStatus: c.payment_status, isBrand: true, counterpartName: name })
              const turn = actorLabel(view, true, name)
              return (
                <QuietRow key={c.id} href={`/collabs/${c.id}`} name={name}
                  sub={c.campaigns?.title || 'Campaign'}
                  status={turn.yourTurn ? 'Needs you' : view.actor === 'platform' ? 'Processing' : 'In progress'}
                  statusColor={turn.yourTurn ? 'var(--warn)' : 'var(--ink-faint-solid)'}
                  amount={c.agreed_rate} />
              )
            })}
          </div>
        </>
      )}

      <CompletionNudge href="/settings" label="Finish your brand profile"
        done={completion.items.filter(i => i.done).length} total={completion.items.length} />
    </div>
  )
}

/* ───────────────────────── Creator ───────────────────────── */
async function CreatorDashboard({ userId, displayName, avatarUrl }: { userId: string; displayName: string | null; avatarUrl: string | null }) {
  const supabase = createClient()
  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, user_id, bio, niche, niches, location, portfolio_links, base_rate, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned')
    .eq('user_id', userId).single()
  if (!creator) return (
    <EmptyState
      icon={Compass}
      title="Complete your creator profile to get started"
      body="Add your niche and socials so brands can find you."
      actionHref="/profile"
      actionLabel="Complete profile"
    />
  )

  // Everything below depends only on the creator id (or user id), not on each
  // other — fetch concurrently instead of in a 5-deep waterfall. Admin client
  // for the connect id (RLS hides it from session clients).
  const [
    { data: collabs },
    { data: socials },
    { data: connectProfile },
    { data: invites },
    { data: openApps },
    { data: openCampaigns },
  ] = await Promise.all([
    supabase.from('collabs')
      .select('*, campaigns(title), brand_profiles(company_name)')
      .eq('creator_id', creator.id).neq('status', 'completed').neq('status', 'cancelled')
      .order('created_at', { ascending: false }).limit(6),
    supabase.from('social_accounts').select('follower_count').eq('creator_id', creator.id),
    createAdminClient().from('creator_profiles').select('stripe_connect_id').eq('id', creator.id).single(),
    supabase.from('campaign_invites')
      .select('id, created_at, campaigns(title), brand_profiles(company_name)')
      .eq('creator_id', creator.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(4),
    supabase.from('applications').select('id, campaign_id, status').eq('creator_id', creator.id).neq('status', 'rejected'),
    supabase.from('campaigns')
      .select('id, title, comp_type, budget_min, budget_max, niche_tags, min_followers, brand_profiles(company_name)')
      .eq('status', 'active').order('created_at', { ascending: false }).limit(12),
  ])

  const socialsCount = socials?.length || 0
  const needsPayoutSetup = !connectProfile?.stripe_connect_id
  const appliedCampaignIds = new Set((openApps || []).map(a => a.campaign_id))
  const outboundCount = (openApps || []).length

  // "Matched to you": up to 3 active campaigns the creator hasn't applied to,
  // ranked by a real computeFit score on niche + reach.
  const creatorFollowers = bestFollowers(socials || [])
  const creatorNiches = [creator.niche, ...((creator.niches as string[] | null) || [])]
  const matched = (openCampaigns || [])
    .filter(c => !appliedCampaignIds.has(c.id))
    .map(c => {
      const fit = computeFit(
        { niches: creatorNiches, followers: creatorFollowers },
        { niches: (c.niche_tags as string[] | null) || [], minFollowers: c.min_followers || 0 },
      )
      const hasPay = c.comp_type === 'paid' || c.comp_type === 'both'
      const pay = hasPay
        ? c.budget_min
          ? `${formatSGD(c.budget_min)}${c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}`
          : 'Paid'
        : 'Barter'
      return {
        id: c.id,
        title: c.title,
        brand: (c.brand_profiles as any)?.company_name || 'A brand',
        pay,
        pct: fit.pct,
      }
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)

  const happeningEmpty = (invites || []).length === 0 && outboundCount === 0

  const needsYou = (collabs || []).filter(c => {
    const v = deriveWorkflow({ status: c.status, paymentStatus: c.payment_status, isBrand: false, counterpartName: 'Brand' })
    return actorLabel(v, false, 'Brand').yourTurn
  })
  const securedNow = (collabs || []).filter(c => c.payment_status === 'funded')
    .reduce((sum, c) => sum + (c.creator_payout || 0), 0)
  const completion = creatorCompletion({ ...creator, avatar_url: avatarUrl, socials_count: socialsCount || 0 })
  const isBoosted = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
  const isEmpty = !collabs || collabs.length === 0

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginTop: 8, marginBottom: isEmpty ? 36 : 44 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {greeting()}{displayName ? `, ${displayName.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', marginTop: 8 }}>
          {isEmpty
            ? 'Browse campaigns and land your first paid collab.'
            : needsYou.length > 0
              ? `${needsYou.length} collab${needsYou.length > 1 ? 's need' : ' needs'} your next move.`
              : 'Everything is on track.'}
          {isBoosted ? ' Boost is active — you appear first to brands.' : ''}
        </p>
      </div>

      {/* earnings — the one dark anchor */}
      <div className="money-panel" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="money-label">Total earned</div>
            <div className="money-value">{formatSGD(creator.total_earned || 0)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="money-label">Secured in escrow now</div>
            <div className="mono-num" style={{ fontSize: 22, fontWeight: 560, marginTop: 10, color: securedNow > 0 ? '#6FCFB2' : 'rgba(255,255,255,.55)' }}>
              {formatSGD(securedNow)}
            </div>
          </div>
        </div>
        <div className="money-sub">
          {creator.collabs_completed || 0} collab{creator.collabs_completed !== 1 ? 's' : ''} completed
          {creator.rating_count > 0 ? ` · ${creator.rating_avg} ★ average rating` : ''}
          {securedNow > 0 ? ' · escrowed funds release when your work is approved.' : ''}
        </div>
      </div>

      {/* Connect-your-payout nudge — only when no Stripe Connect account yet */}
      {needsPayoutSetup && (
        <Link href="/earnings" style={{
          width: '100%', textDecoration: 'none', marginBottom: 14,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', padding: '16px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>Connect your payout account so the money can reach you</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-soft)', fontSize: 13.5, fontWeight: 530, flexShrink: 0 }}>
            Set up <ArrowRight size={15} />
          </span>
        </Link>
      )}

      {isEmpty ? (
        <EmptyState
          icon={Compass}
          title="Let's land your first paid collab"
          body="Browse open campaigns that fit your niche, send a pitch, and the brand funds escrow before you create anything."
          steps={['Browse campaigns', 'Send a pitch', 'Money secured, you create']}
          actionHref="/jobs"
          actionLabel="Browse campaigns"
        />
      ) : (
        <>
          {needsYou.length > 0 && (
            <div style={{ marginBottom: 48 }}>
              <AttentionRow href={`/collabs/${needsYou[0].id}`}
                strong={(needsYou[0].brand_profiles as any)?.company_name || 'A brand'}
                text={`is waiting on you — ${deriveWorkflow({ status: needsYou[0].status, paymentStatus: needsYou[0].payment_status, isBrand: false, counterpartName: 'the brand' }).next.split('.')[0].toLowerCase()}`} />
            </div>
          )}
          {needsYou.length === 0 && <div style={{ marginBottom: 40 }} />}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="eyebrow">Active collaborations</span>
            <Link href="/collabs" style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>All collabs</Link>
          </div>
          <div>
            {(collabs || []).map(c => {
              const name = (c.brand_profiles as any)?.company_name || 'Brand'
              const view = deriveWorkflow({ status: c.status, paymentStatus: c.payment_status, isBrand: false, counterpartName: name })
              const turn = actorLabel(view, false, name)
              return (
                <QuietRow key={c.id} href={`/collabs/${c.id}`} name={name}
                  sub={c.campaigns?.title || 'Campaign'}
                  status={turn.yourTurn ? 'Your move' : view.actor === 'platform' ? 'Processing' : 'Waiting on brand'}
                  statusColor={turn.yourTurn ? 'var(--warn)' : 'var(--ink-faint-solid)'}
                  amount={c.creator_payout} />
              )
            })}
          </div>
        </>
      )}

      {/* Happening now — real pending invites + outbound application count */}
      {!happeningEmpty && (
        <div style={{ marginTop: isEmpty ? 40 : 48, marginBottom: 8 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Happening now</span>
          <div>
            {(invites || []).map(inv => {
              const company = (inv.brand_profiles as any)?.company_name || 'A brand'
              const campaignTitle = (inv.campaigns as any)?.title || 'a campaign'
              return (
                <Link key={inv.id} href="/invites" style={{
                  width: '100%', textDecoration: 'none', borderTop: '1px solid var(--line)',
                  padding: '16px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 540, color: 'var(--ink)' }}>{company} invited you</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaignTitle}</span>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--warn)', flexShrink: 0 }}>New invite</span>
                </Link>
              )
            })}
            {outboundCount > 0 && (
              <Link href="/applications" style={{
                width: '100%', textDecoration: 'none', borderTop: '1px solid var(--line)',
                padding: '16px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 540, color: 'var(--ink)' }}>
                    {outboundCount} application{outboundCount > 1 ? 's' : ''} out
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-faint-solid)' }}>Awaiting reply</span>
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)', flexShrink: 0 }}>Track</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Matched to you — real active campaigns ranked by computeFit */}
      {matched.length > 0 && (
        <div style={{ marginTop: happeningEmpty ? (isEmpty ? 40 : 48) : 40, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="eyebrow">Matched to you</span>
            <Link href="/jobs" style={{ fontSize: 12, color: 'var(--ink-faint-solid)' }}>Browse all</Link>
          </div>
          <div>
            {matched.map(m => (
              <Link key={m.id} href={`/jobs/${m.id}`} style={{
                width: '100%', textDecoration: 'none', borderTop: '1px solid var(--line)',
                padding: '16px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13,
                  }}>{getInitials(m.brand)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 540, color: 'var(--ink)' }}>{m.title}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-faint-solid)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.brand}</span>
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
                  <span className="mono-num" style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{m.pay}</span>
                  <span style={{ fontSize: 13, color: 'var(--accent-deep)' }}>{m.pct}% match</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <CompletionNudge href="/profile" label="Finish your profile"
        done={completion.items.filter(i => i.done).length} total={completion.items.length} />
    </div>
  )
}
