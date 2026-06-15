import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getUserRow } from '@/lib/auth'
import { formatSGD, getInitials } from '@/lib/utils'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/profiles'
import SaveCreatorButton from '@/components/SaveCreatorButton'
import InviteCreatorForm from '@/components/InviteCreatorForm'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'
import type { SocialAccount } from '@/types'
import { hasVerifiedOwnership, VERIFICATION_NOTE } from '@/lib/discovery-data'
import { responseStanding } from '@/lib/recommend'
import { boostEnabled } from '@/lib/stripe'
import ReviewList from '@/components/ReviewList'
import RatingSummaryCard from '@/components/RatingSummaryCard'
import Link from 'next/link'
import { ChevronLeft, MapPin, Shield, Lock, ExternalLink, ShieldCheck, Clock, Pencil, FileText, Link2 as LinkIcon } from 'lucide-react'

export default async function CreatorProfilePage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const supabase = createClient()
  const admin = createAdminClient()

  // Admin client: public profile data, but the users join (display name /
  // avatar) is RLS-limited to own-row for session clients.
  const { data: creator } = await admin.from('creator_profiles')
    .select('id, user_id, bio, niche, niches, niche_tags, location, portfolio_links, media_kit_url, average_rate_sgd, availability_status, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, users(display_name, avatar_url)')
    .eq('id', params.id).single()
  if (!creator) return <p className="text-sm text-red-500">Creator not found.</p>

  // Independent reads — connected socials, email verification, brand reviews,
  // and the memoized current-user row — issued concurrently.
  const [
    { data: socialAccounts },
    { data: emailVerified },
    { data: brandReviews },
    { data: scoreRow },
    viewer,
  ] = await Promise.all([
    supabase.from('social_accounts')
      .select('id, creator_id, platform, handle, url, follower_count, verification_status, verification_method, verified_at, is_primary, created_at, updated_at')
      .eq('creator_id', params.id)
      .order('is_primary', { ascending: false }).order('created_at'),
    supabase.rpc('user_email_verified', { p_user_id: creator.user_id }),
    supabase.from('reviews')
      .select('id, rating, note, created_at, collabs!inner(id, creator_id, campaigns(title), brand_profiles(company_name))')
      .eq('reviewer_type', 'brand')
      .eq('collabs.creator_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    // Internal score row — ONLY for the categorical response standing below.
    // Never rendered as a number; raw inputs stay server-side.
    admin.from('creator_scores')
      .select('invites_concluded, response_rate_shrunk').eq('creator_id', params.id).maybeSingle(),
    getUserRow(),
  ])

  // Owner viewing their own profile (Profile nav lands here) → show Edit, not
  // brand actions. "This is how brands see you."
  const isOwner = creator.user_id === user.id
  // Brand viewer: saved state + invitable campaigns (active, paid).
  const isBrandViewer = viewer?.role === 'brand' && !isOwner
  let isSaved = false
  let viewerIsPro = false
  let inviteCampaigns: { id: string; title: string }[] = []
  let pendingInviteCampaignIds: string[] = []
  if (isBrandViewer) {
    const { data: brand } = await admin.from('brand_profiles')
      .select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()
    viewerIsPro = resolvePlan(brand).isPro
    if (brand) {
      const [{ data: saved }, { data: campaigns }, { data: pendingInvites }] = await Promise.all([
        supabase.from('saved_creators')
          .select('id').eq('brand_id', brand.id).eq('creator_id', params.id).maybeSingle(),
        supabase.from('campaigns')
          .select('id, title').eq('brand_id', brand.id).eq('status', 'active')
          .in('comp_type', ['paid', 'both']).order('created_at', { ascending: false }),
        supabase.from('campaign_invites')
          .select('campaign_id').eq('brand_id', brand.id).eq('creator_id', params.id)
          .eq('status', 'pending'),
      ])
      isSaved = Boolean(saved)
      inviteCampaigns = campaigns || []
      pendingInviteCampaignIds = (pendingInvites || [])
        .map(i => i.campaign_id).filter((id): id is string => Boolean(id))
    }
  }

  const name = (creator.users as any)?.display_name || 'Creator'
  const avatar = (creator.users as any)?.avatar_url
  const isBoosted = boostEnabled() && creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
  const availability = creator.availability_status as AvailabilityStatus | null

  // Honest, categorical responsiveness — "Not enough response history yet" until
  // there's a real sample. Never a percentage.
  const response = responseStanding(
    (scoreRow as any)?.invites_concluded,
    (scoreRow as any)?.response_rate_shrunk != null ? Number((scoreRow as any).response_rate_shrunk) : null,
  )

  const socials = (socialAccounts as SocialAccount[]) || []
  const primarySocial = socials[0]
  const totalFollowers = socials.reduce((sum, s) => sum + (s.follower_count || 0), 0)
  const rate = creator.average_rate_sgd ?? creator.base_rate

  // Honest trust signals: ownership verified ≠ follower reach verified.
  const verifiedOwnership = hasVerifiedOwnership(socials)
  const completedCollabs = creator.collabs_completed || 0
  const isNewCreator = completedCollabs === 0
  const showRating = (creator.rating_count || 0) >= 1

  const primaryNiche = creator.niche
    ? NICHE_LABELS[creator.niche as CreatorNiche] || creator.niche
    : creator.niches?.[0]

  const portfolioLinks: string[] = creator.portfolio_links || []

  const stats: [string, string, string][] = [
    ['Followers', totalFollowers > 0 ? totalFollowers.toLocaleString() : '—', 'self-reported'],
    ['Avg. rate', rate > 0 ? formatSGD(rate) : 'Negotiable', 'per post'],
    ['Collabs', String(completedCollabs), 'completed on collabr'],
    ['Rating', showRating ? `${creator.rating_avg} ★` : '—',
      showRating ? `${creator.rating_count} collaborator${creator.rating_count !== 1 ? 's' : ''}` : 'no reviews yet'],
  ]

  return (
    <div className="screen-in" style={{ maxWidth: 940, margin: '0 auto' }}>
      {isOwner ? (
        <div className="eyebrow" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-deep)' }}>
          <ShieldCheck size={13} /> This is how brands see you
        </div>
      ) : (
        <Link href="/creators" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-faint-solid)', marginBottom: 24 }}>
          <ChevronLeft size={15} /> Discover
        </Link>
      )}

      {/* identity — cover hero (matches the brand profile) */}
      <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: 0, marginBottom: 26 }}>
        <div style={{
          height: 92, position: 'relative',
          background: 'radial-gradient(120% 160% at 12% -20%, var(--accent) 0%, #2a2f63 36%, var(--creator) 78%, #0A0C22 100%)',
        }}>
          <div aria-hidden style={{ position: 'absolute', top: -40, right: -20, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,108,255,.35), transparent 65%)' }} />
          {isOwner && (
            <Link href="/profile" className="btn" style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,.16)', color: '#fff', backdropFilter: 'blur(6px)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
              <Pencil size={14} /> Edit profile
            </Link>
          )}
        </div>
        <div style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            {/* avatar overlaps the cover; identity sits below on the surface */}
            <div style={{
              width: 84, height: 84, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', marginTop: -42,
              background: avatar ? '#fff' : 'linear-gradient(135deg, #7C72FF 0%, #5B53E0 60%, #4338CA 100%)',
              color: '#fff',
              display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em',
              boxShadow: '0 0 0 4px #fff, var(--shadow)',
            }}>
              {avatar
                ? <img src={avatar} alt={name} style={{ width: 84, height: 84, objectFit: 'cover' }} />
                : getInitials(name)}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 className="h1" style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em' }}>{name}</h1>
                {verifiedOwnership && (
                  <span className="badge badge-money" title={VERIFICATION_NOTE}
                    style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={12} /> Verified Account
                  </span>
                )}
                {isNewCreator && <span className="badge badge-neutral" style={{ fontSize: 11 }}>New Creator</span>}
                {isBoosted && <span className="badge badge-accent" style={{ fontSize: 11 }} title="Sponsored placement">Boosted</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 7, color: 'var(--ink-faint-solid)', fontSize: 13 }}>
                {primarySocial && <span>@{primarySocial.handle}</span>}
                {creator.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} />{creator.location}
                  </span>
                )}
                {primaryNiche && <span>{primaryNiche}</span>}
                {emailVerified === true && <span>Email verified</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title="Categorical summary of invite responses — never a score.">
                  <Clock size={13} />{response.label}
                </span>
                {availability && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: availability === 'available' ? 'var(--money-deep)' : 'var(--ink-faint-solid)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: availability === 'available' ? 'var(--money)' : availability === 'limited' ? 'var(--warn)' : 'var(--ink-faint-solid)' }} />
                    {AVAILABILITY_LABELS[availability]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Brand actions: invite + save (Pro — complimentary during beta) */}
          {isBrandViewer && (
            viewerIsPro ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flexShrink: 0, paddingBottom: 2 }}>
                <InviteCreatorForm
                  creatorId={params.id}
                  creatorName={name}
                  campaigns={inviteCampaigns}
                  pendingCampaignIds={pendingInviteCampaignIds}
                />
                <SaveCreatorButton creatorId={params.id} initialSaved={isSaved} />
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', flexShrink: 0, maxWidth: 240, paddingBottom: 4 }}>
                Inviting and saving creators is part of collabr Pro.{' '}
                <Link href="/billing" style={{ fontWeight: 600, color: 'var(--accent-deep)' }}>Manage plan</Link>
              </p>
            )
          )}
        </div>
      </div>

      {/* stat band — tinted accents for a livelier feel */}
      <div className="card resp-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: 0, overflow: 'hidden', marginBottom: 36 }}>
        {stats.map(([k, v, ctx], i) => {
          const tints = [
            { bar: 'var(--accent)', val: 'var(--accent-deep)' },
            { bar: 'var(--money)', val: 'var(--money-deep)' },
            { bar: 'var(--creator)', val: 'var(--ink)' },
            { bar: 'var(--warn)', val: 'var(--warn-deep)' },
          ][i % 4]
          return (
            <div key={k} style={{ position: 'relative', padding: '18px 20px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ position: 'absolute', top: 0, left: i ? 0 : 0, right: 0, height: 3, background: tints.bar, opacity: .85 }} />
              <div className="eyebrow" style={{ fontSize: 10.5, marginBottom: 9 }}>{k}</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: tints.val }}>{v}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 4 }}>{ctx}</div>
            </div>
          )
        })}
      </div>

      {/* two-column layout */}
      <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 40, alignItems: 'start' }}>
        {/* MAIN */}
        <div>
          {/* About */}
          {creator.bio && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>About</h2>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--ink)', whiteSpace: 'pre-wrap', margin: 0 }}>{creator.bio}</p>
            </section>
          )}

          {/* Niches — canonical niche_tags, falling back to the legacy list */}
          {(() => {
            const tags = (creator.niche_tags?.length ? creator.niche_tags : creator.niches) || []
            return tags.length > 0 ? (
              <section style={{ marginBottom: 30 }}>
                <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Niches</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map((n: string) => (
                    <span key={n} className="badge badge-neutral">{NICHE_LABELS[n as CreatorNiche] || n}</span>
                  ))}
                </div>
              </section>
            ) : null
          })()}

          {/* Portfolio & links — clean link rows (no image previews) */}
          {(portfolioLinks.length > 0 || creator.media_kit_url) && (
            <section style={{ marginBottom: 30 }}>
              <h2 className="h2" style={{ fontSize: 18, marginBottom: 14 }}>Portfolio &amp; links</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {creator.media_kit_url && (
                  <a href={creator.media_kit_url} target="_blank" rel="noopener noreferrer"
                    className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textDecoration: 'none' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent-deep)', display: 'grid', placeItems: 'center' }}>
                      <FileText size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Media kit</span>
                    <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                  </a>
                )}
                {portfolioLinks.map((link, i) => {
                  const tints = [
                    { bg: 'var(--accent-tint)', fg: 'var(--accent-deep)' },
                    { bg: 'var(--money-tint)', fg: 'var(--money-deep)' },
                    { bg: 'var(--warn-tint)', fg: 'var(--warn-deep)' },
                    { bg: 'var(--creator-tint)', fg: 'var(--creator-deep)' },
                  ][i % 4]
                  return (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer"
                      className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textDecoration: 'none' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: tints.bg, color: tints.fg, display: 'grid', placeItems: 'center' }}>
                        <LinkIcon size={15} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </span>
                      <ExternalLink size={15} style={{ color: 'var(--ink-faint-solid)', flexShrink: 0 }} />
                    </a>
                  )
                })}
              </div>
            </section>
          )}

          {/* Brand reviews — revealed only; premium empty state for new creators */}
          {(() => {
            const items = (brandReviews || []).map(r => ({
              id: r.id, rating: r.rating, note: r.note,
              title: (r.collabs as any)?.campaigns?.title ?? null,
              author: (r.collabs as any)?.brand_profiles?.company_name ?? null,
              authorRole: 'brand' as const,
              when: r.created_at,
            }))
            const dist = [0, 0, 0, 0, 0]
            for (const r of items) if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
            return (
              <>
                {items.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <RatingSummaryCard avg={creator.rating_avg} count={creator.rating_count} distribution={dist} totalReviews={items.length} />
                  </div>
                )}
                <ReviewList
                  heading="Brand reviews"
                  reviews={items}
                  emptyTitle={isOwner ? 'No reviews yet — let’s get you started' : 'No reviews yet'}
                  emptyBody={isOwner
                    ? 'Apply to campaigns and land your first collab — brands’ reviews will appear here and help you win more work.'
                    : 'Reviews from brands appear after completed collaborations, revealed once both sides submit or after 7 days.'}
                  ctaHref={isOwner ? '/jobs' : undefined}
                  ctaLabel={isOwner ? 'Discover campaigns' : undefined}
                />
              </>
            )
          })()}
        </div>

        {/* RAIL */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Typical rate */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>Typical rate</span>
              <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>Negotiable</span>
            </div>
            <div className="mono-num" style={{ fontSize: 25, fontWeight: 600, color: 'var(--ink)' }}>
              {rate > 0 ? formatSGD(rate) : 'Negotiable'}
              {rate > 0 && <span style={{ fontSize: 14, color: 'var(--ink-faint-solid)', fontWeight: 400 }}> / post</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
              <Shield size={15} style={{ color: 'var(--money)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                Fund escrow once when they accept. It releases only after you approve the live post.
              </span>
            </div>
          </div>

          {/* Connected accounts */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Connected accounts</div>
            {socials.length > 0 ? (
              <>
                {socials.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 600, fontSize: 11, textTransform: 'capitalize',
                      }}>{s.platform[0].toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {s.platform}
                          {s.is_primary && <span style={{ fontSize: 9.5, color: 'var(--ink-faint-solid)' }}>Primary</span>}
                        </div>
                        {s.handle && <div style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{s.handle}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {s.follower_count != null && (
                        <span className="mono-num" title="Self-reported follower count" style={{ fontSize: 13, color: 'var(--ink)' }}>{s.follower_count.toLocaleString()}</span>
                      )}
                      {s.verification_status === 'verified' && (
                        <span title={VERIFICATION_NOTE} style={{ display: 'inline-flex' }}>
                          <ShieldCheck size={14} style={{ color: 'var(--money)' }} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--ink-faint-solid)' }}>
                  <Lock size={12} />
                  <span style={{ fontSize: 11 }}>Connected accounts · follower counts are self-reported</span>
                </div>
              </>
            ) : creator.platforms && Object.keys(creator.platforms).length > 0 ? (
              // Legacy fallback for profiles created before normalized socials
              Object.entries(creator.platforms as Record<string, { handle: string; followers: number; verified: boolean }>)
                .map(([platform, info]) => (
                  <div key={platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 600, fontSize: 11,
                      }}>{platform[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--ink)', textTransform: 'capitalize' }}>{platform}</div>
                        {info.handle && <div style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)' }}>@{info.handle}</div>}
                      </div>
                    </div>
                    <span className="mono-num" style={{ fontSize: 13, color: 'var(--ink)' }}>{Number(info.followers || 0).toLocaleString()}</span>
                  </div>
                ))
            ) : (
              <div style={{ padding: '12px 0', borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
                This creator hasn&apos;t connected any social accounts yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
