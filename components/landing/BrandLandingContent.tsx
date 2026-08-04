import Link from 'next/link'
import { ArrowRight, ShieldCheck, ListChecks, Star, Handshake } from 'lucide-react'
import CreatorDiscoveryCard from '@/components/CreatorDiscoveryCard'
import { Reveal } from '@/components/Reveal'
import WorkflowSteps from '@/components/WorkflowSteps'
import { CREATOR_NICHES, NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import type { DiscoveryCreatorRow } from '@/lib/creator-discovery'
import type { ScoreRow } from '@/lib/discovery-data'
import type { SocialAccount } from '@/types'

const WHY: { icon: () => JSX.Element; title: string; body: string }[] = [
  {
    icon: () => <ShieldCheck size={19} />,
    title: 'Protected payments',
    body: 'Funds are held securely and only released once you approve the delivered content.',
  },
  {
    icon: () => <ListChecks size={19} />,
    title: 'Manage campaigns in one place',
    body: 'Briefs, drafts, feedback, and approvals all live in one place instead of scattered across DMs.',
  },
  {
    icon: () => <Star size={19} />,
    title: 'Real reputation, not just followers',
    body: 'See ratings and completed collaborations, so you know who’s reliable before you reach out.',
  },
  {
    icon: () => <Handshake size={19} />,
    title: "We'll help source creators",
    body: "Want someone who hasn't joined yet? Request them and we'll personally make the introduction.",
  },
]

const STEPS: readonly (readonly [string, string])[] = [
  ['Browse creators', 'Search and filter the roster, no account needed to look around.'],
  ['Request collaboration', 'Found a fit? Request them, on a campaign you post or one we help you set up.'],
  ['Connect on Collabr', 'Once they accept, you’ll coordinate directly through the platform. During beta, we’ll personally help facilitate the introduction if a creator hasn’t joined yet.'],
  ['Manage everything in Collabr', 'Briefs, approvals, and protected payments, all handled inside the platform from there.'],
]

const FAQ: readonly (readonly [string, string])[] = [
  [
    'How do I contact creators?',
    'Open any creator’s profile and select "Request Collaboration." We’ll notify them and let you know the moment they respond.',
  ],
  [
    'Do creators have to join first?',
    'No. Many of the creators you’ll see have already joined Collabr. If you want to work with someone who hasn’t yet, request the collaboration and we’ll personally reach out to bring them on, at no extra cost to you.',
  ],
  [
    'How are payments protected?',
    'The brand funds the collaboration upfront and the money is held securely by the platform. It’s only released to the creator once the content is approved and live, so you never pay for work that isn’t delivered.',
  ],
  [
    'How much does it cost during beta?',
    'Browsing, searching, and requesting collaborations is free during beta, no subscription and no credit card required. You only pay the agreed rate when you fund a collaboration, with no commission on top.',
  ],
]

export default function BrandLandingContent({
  preview, socialsByCreator, scoreById,
}: {
  preview: DiscoveryCreatorRow[]
  socialsByCreator: Record<string, SocialAccount[]>
  scoreById: Record<string, ScoreRow>
}) {
  return (
    <>
      {/* ══ HERO ══ soft atmosphere behind the headline, same technique as
          the final CTA band below - gives the top of the page some depth
          instead of sitting flat on the canvas. ══ */}
      <header style={{ position: 'relative', textAlign: 'center', padding: 'clamp(28px,5vw,48px) 20px clamp(20px,3vw,28px)', overflow: 'hidden' }}>
        <div aria-hidden style={{
          position: 'absolute', top: '-25%', left: '50%', transform: 'translateX(-50%)',
          width: 640, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,4,53,.07), transparent 68%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <h1 className="display-face" style={{ fontSize: 'clamp(30px,4.8vw,52px)', lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Find creators for your next campaign.
          </h1>
          <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'var(--ink-soft)', lineHeight: 1.5, maxWidth: 480, margin: '0 auto 24px' }}>
            Browse real creators and request a collaboration in minutes.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/browse" className="btn-primary btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Browse Creators <ArrowRight size={16} />
            </Link>
            <Link href="/signup?role=brand" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
              Already know who you want? Post a campaign
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 14 }}>
            Free during beta · No credit card required · Browsing needs no account
          </p>
        </div>
      </header>

      {/* ══ HOW IT WORKS ══ */}
      <section className="lp-section" style={{ background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--paper-2) 100%)' }}>
        <div className="lp-narrow">
          <Reveal style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>How it works</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em' }}>
              Browse. Request. Manage.
            </h2>
          </Reveal>
          <Reveal className="card" style={{ padding: 26, maxWidth: 520, margin: '0 auto' }}>
            <WorkflowSteps steps={STEPS} dotBg="var(--brand)" dotInk="#fff" lineColor="var(--brand)" />
          </Reveal>
        </div>
      </section>

      {/* ══ WHY COLLABR ══ */}
      <section className="lp-section">
        <div className="lp-narrow">
          <Reveal style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Why Collabr</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em' }}>
              Built for finding and working with creators.
            </h2>
          </Reveal>
          <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {WHY.map(({ icon: Icon, title, body }) => (
              <Reveal key={title} className="card" style={{ padding: 26 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: 'var(--brand-tint)', color: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <Icon />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', margin: '0 0 8px' }}>{title}</h3>
                <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MEET CREATORS ON COLLABR ══ a small, fixed preview - never the
          marketplace itself. No search, no filters, no sort, no pagination;
          all of that lives exclusively on /browse. ══ */}
      <section className="lp-section" style={{ background: 'linear-gradient(180deg, var(--surface-2) 0%, var(--paper-2) 100%)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 20px' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Creators</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.02em' }}>
              Meet creators on Collabr.
            </h2>
          </Reveal>

          {preview.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
                {preview.map(c => (
                  <CreatorDiscoveryCard key={c.id} creator={c} socials={socialsByCreator[c.id] || []} score={scoreById[c.id] || null} />
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <Link href="/browse" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  Browse all creators <ArrowRight size={15} />
                </Link>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--ink-faint-solid)', fontSize: 14, padding: '40px 0' }}>
              New creators are joining every week.
            </p>
          )}
        </div>
      </section>

      {/* ══ CATEGORIES ══ a lightweight nav aid straight into /browse ══ */}
      <section style={{ padding: '28px 20px 36px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '-0.01em', marginBottom: 14 }}>
          Browse by category
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 640, margin: '0 auto' }}>
          {CREATOR_NICHES.map(n => (
            <Link key={n} href={`/browse?niche=${n}`} className="chip" style={{ padding: '9px 18px', fontSize: 14 }}>
              {NICHE_LABELS[n as CreatorNiche]}
            </Link>
          ))}
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="lp-section">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>FAQ</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em' }}>Questions, answered.</h2>
          </Reveal>
          <Reveal>
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq-item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section style={{
        background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand) 52%, color-mix(in srgb, var(--brand) 82%, #4F46E5) 100%)',
        color: '#fff', padding: 'clamp(52px,7vw,76px) 20px', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,.08)',
      }}>
        <Reveal>
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,4vw,42px)', color: '#fff', marginBottom: 12, letterSpacing: '-0.03em' }}>
            Your next collaboration starts here.
          </h2>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <Link href="/browse" className="btn btn-lg hover-lift" style={{ background: '#fff', color: 'var(--ink)', display: 'inline-flex', gap: 8 }}>
              Browse Creators <ArrowRight size={16} />
            </Link>
            <Link href="/signup?role=brand" className="btn btn-money btn-lg hover-lift" style={{ display: 'inline-flex', gap: 8 }}>
              Post a Campaign <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
