import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatSGD, COLLAB_STATUSES } from '@/lib/utils'
import type { LucideProps } from 'lucide-react'
import { Briefcase, Users, Lock, Send, ArrowRight, Plus, Star } from 'lucide-react'

function StatTile({
  icon: Icon, label, value, sub, tone = 'accent',
}: {
  icon: React.ComponentType<Partial<LucideProps>>
  label: string
  value: string
  sub?: string
  tone?: 'accent' | 'money' | 'ink'
}) {
  const toneStyles = {
    accent: { bg: 'var(--accent-tint)', color: 'var(--accent-deep)' },
    money:  { bg: 'var(--money-tint)',  color: 'var(--money-deep)' },
    ink:    { bg: 'var(--brand-tint)',  color: 'var(--ink)' },
  }[tone]

  return (
    <div className="card rise" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>{label}</div>
          <div className="display-num">{value}</div>
          {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: toneStyles.bg, color: toneStyles.color,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = COLLAB_STATUSES[status as keyof typeof COLLAB_STATUSES]
  const colorMap: Record<string, string> = {
    purple: 'badge-accent', teal: 'badge-money', amber: 'badge-pending',
    coral: 'badge-danger', gray: 'badge-neutral',
  }
  return (
    <span className={`badge ${colorMap[s?.color || 'gray'] || 'badge-neutral'}`}>
      {s?.label || status.replace(/_/g, ' ')}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/signup')

  if (profile.role === 'brand') return <BrandDashboard userId={user.id} />
  if (profile.role === 'creator') return <CreatorDashboard userId={user.id} />
  return <div style={{ color: 'var(--ink-soft)' }}>Loading…</div>
}

async function BrandDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles')
    .select('id, user_id, company_name, industry, website, logo_url, plan, created_at')
    .eq('user_id', userId).single()
  if (!brand) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Complete your brand profile to get started.</p>
      <Link href="/settings" className="btn btn-primary">Complete profile</Link>
    </div>
  )

  const { data: campaigns } = await supabase.from('campaigns')
    .select('*').eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(5)
  const { data: collabs } = await supabase.from('collabs')
    .select('*, campaigns(title), creator_profiles(id, user_id, bio, niches, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, created_at, users(display_name))')
    .eq('brand_id', brand.id).neq('status', 'completed').neq('status', 'cancelled').limit(6)

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0
  const pendingReview   = collabs?.filter(c => c.status === 'draft_submitted').length || 0
  const inEscrow        = collabs?.filter(c => c.payment_status === 'funded')
    .reduce((sum, c) => sum + (c.agreed_rate || 0), 0) || 0
  const livePosts       = collabs?.filter(c => c.status === 'live_submitted').length || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Dashboard</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 4 }}>Welcome back, {brand.company_name}</p>
        </div>
        <Link href="/post-job" className="btn btn-primary" style={{ display: 'inline-flex', gap: 8 }}>
          <Plus size={16} /> Post a campaign
        </Link>
      </div>

      {/* Attention banner — draft to review */}
      {pendingReview > 0 && (
        <div className="card rise" style={{
          padding: 18,
          borderColor: 'var(--pending)',
          background: 'var(--pending-tint)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {pendingReview} draft{pendingReview > 1 ? 's' : ''} waiting for review
              </div>
              <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 3 }}>
                Review within 48h — auto-approves if no response
              </div>
            </div>
            <Link href="/collabs" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', gap: 6 }}>
              Review now <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="pc-grid">
        <StatTile icon={Briefcase} label="Active campaigns" value={String(activeCampaigns)} sub="accepting applicants" tone="ink" />
        <StatTile icon={Users}     label="Drafts to review"  value={String(pendingReview)}   sub="awaiting your feedback" tone="accent" />
        <StatTile icon={Lock}      label="Funds authorized"   value={formatSGD(inEscrow)}     sub="verified and held" tone="money" />
        <StatTile icon={Send}      label="Live posts"          value={String(livePosts)}       sub="submitted this period" tone="accent" />
      </div>

      {/* Quick actions */}
      {(!campaigns || campaigns.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <h3 style={{ marginBottom: 8 }}>Post your first campaign</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginBottom: 20, maxWidth: 340, margin: '8px auto 20px' }}>
            Describe what you need, set your budget, and go live in under 5 minutes.
          </p>
          <Link href="/post-job" className="btn btn-primary" style={{ display: 'inline-flex', gap: 8 }}>
            <Plus size={15} /> Post a campaign
          </Link>
        </div>
      )}

      {/* Active collabs */}
      {collabs && collabs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 17 }}>Active collabs</h3>
            <Link href="/collabs" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {collabs.map(c => (
              <Link key={c.id} href={`/collabs/${c.id}`} className="card card-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{(c.creator_profiles as any)?.users?.display_name}</div>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 2 }}>{c.campaigns?.title}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15 }}>
                    {formatSGD(c.agreed_rate)}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

async function CreatorDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, user_id, bio, niches, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, created_at')
    .eq('user_id', userId).single()
  if (!creator) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Complete your creator profile to get started.</p>
      <Link href="/profile" className="btn btn-primary">Complete profile</Link>
    </div>
  )

  const { data: collabs } = await supabase.from('collabs')
    .select('*, campaigns(title), brand_profiles(company_name)')
    .eq('creator_id', creator.id).neq('status', 'completed').neq('status', 'cancelled').limit(6)

  const isBoosted = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Overview</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 4 }}>Here&apos;s what&apos;s going on</p>
        </div>
        <Link href="/jobs" className="btn btn-money" style={{ display: 'inline-flex', gap: 8 }}>
          Browse campaigns <ArrowRight size={15} />
        </Link>
      </div>

      {/* Earnings hero card */}
      <div className="card rise" style={{
        padding: 28,
        background: 'linear-gradient(150deg, #1C1917, #2A2320)',
        border: 'none',
        color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 180, height: 180, borderRadius: '50%',
          background: 'rgba(232,165,152,.08)',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            Total earned
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 46, letterSpacing: '-0.03em', color: 'var(--creator)',
            lineHeight: 1, marginBottom: 16,
          }}>
            {formatSGD(creator.total_earned)}
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {creator.collabs_completed}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>collabs done</div>
            </div>
            {creator.rating_count > 0 && (
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {creator.rating_avg}
                  <Star size={16} fill="var(--creator)" stroke="none" />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>avg rating</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Boost notice */}
      {isBoosted && (
        <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--accent-tint)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--accent-deep)' }}>Boost active</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>You appear at the top of applicant lists</div>
            </div>
          </div>
        </div>
      )}

      {/* Active collabs */}
      {collabs && collabs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 17 }}>Active collabs</h3>
            <Link href="/collabs" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {collabs.map(c => (
              <Link key={c.id} href={`/collabs/${c.id}`} className="card card-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.campaigns?.title}</div>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 2 }}>{(c.brand_profiles as any)?.company_name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15 }}>
                    {formatSGD(c.agreed_rate)}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!collabs || collabs.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
          <h3 style={{ marginBottom: 8 }}>Find your first campaign</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginBottom: 20, maxWidth: 320, margin: '8px auto 20px' }}>
            Browse open campaigns and apply with a pitch. It&apos;s free and takes 2 minutes.
          </p>
          <Link href="/jobs" className="btn btn-money" style={{ display: 'inline-flex', gap: 8 }}>
            Browse campaigns <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  )
}
