import Link from 'next/link'
import { ArrowRight, ShieldCheck, ListChecks, Star, Handshake, Check } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { runCreatorDiscovery } from '@/lib/creator-discovery'
import CreatorDiscoveryCard from '@/components/CreatorDiscoveryCard'
import { Reveal } from '@/components/Reveal'
import WorkflowSteps from '@/components/WorkflowSteps'
import { CREATOR_NICHES, NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'

const PREVIEW_COUNT = 4

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

export default async function ConciergeLanding() {
  const admin = createAdminClient()
  // No searchParams here by design - "/" stays a fixed, cacheable fetch (see
  // app/page.tsx's `revalidate`). All search/filter/sort/pagination lives
  // exclusively on /browse now - the landing page only ever shows a small,
  // fixed preview, never the marketplace itself.
  //
  // admin passed for BOTH client slots (not createClient()): the session
  // client transitively calls cookies() via @supabase/ssr, which forces
  // Next.js to treat the whole route as dynamic and defeats the static
  // generation this page is built for. Every row this query touches
  // (creator_profiles, social_accounts) is already meant to be public, so
  // reading it via the service-role client instead costs nothing.
  const { pageCreators, socialsByCreator, scoreById } = await runCreatorDiscovery(admin, admin, {}, null)
  const preview = pageCreators.slice(0, PREVIEW_COUNT)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-body)' }}>
      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px,5vw,40px)', height: 64, background: 'rgba(253,250,249,.85)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.04em', color: 'var(--ink)' }}>
          collabr<span style={{ color: 'var(--creator)' }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* The hero's own "Browse Creators" button covers phones one scroll
              down - dropping the nav link there is what keeps this row from
              overflowing next to "Log in" + "Join free" on a narrow screen. */}
          <Link href="/browse" className="hidden md:inline" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>Browse Creators</Link>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>Log in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Join free</Link>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <header style={{ textAlign: 'center', padding: 'clamp(36px,6vw,64px) 20px clamp(20px,3vw,28px)', maxWidth: 760, margin: '0 auto' }}>
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
      </header>

      {/* ══ HOW IT WORKS ══ single column, the real order of operations ══ */}
      <section className="lp-section" style={{ background: 'var(--surface-2)' }}>
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
      <section className="lp-section" style={{ background: 'var(--surface-2)' }}>
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

      {/* ══ CATEGORIES ══ a lightweight nav aid straight into /browse, not
          its own marketing section - small heading, no body copy, chips
          only. Plain background (vs. the surface-2 band above/below) so it
          visually reads as a quiet in-between strip, not a peer section. ══ */}
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

      {/* Subtle creator entry point - deliberately quiet (small type, muted
          surface, secondary button styling) so it never competes with the
          brand journey above. Routes to /join, not signup: /join searches
          for an existing seeded profile first (reusing runCreatorDiscovery)
          so a creator who already has one lands on the real claim-request
          card instead of accidentally creating a duplicate account. */}
      <section style={{ padding: '32px 20px', background: 'var(--surface-2)', borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-faint-solid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Are you a creator?
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 14 }}>
            Join Collabr to receive collaboration requests directly and manage everything in one place.
          </p>
          <Link href="/join" className="btn-secondary btn-sm">Join Collabr</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: 'var(--brand)', borderTop: '1px solid rgba(255,255,255,.08)', padding: '22px clamp(20px,5vw,40px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em', color: '#fff' }}>
          collabr<span style={{ color: 'var(--accent-on-dark)' }}>.</span>
        </span>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>© 2026 collabr. · Singapore</span>
          <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Privacy</Link>
          <Link href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Terms</Link>
          <Link href="/data-deletion" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Data deletion</Link>
          <a href="mailto:joincollabr@gmail.com?subject=Collabr%20enquiry" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Contact us</a>
          <Link href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Log in</Link>
          <Link href="/signup" style={{ fontSize: 13, color: 'var(--accent-on-dark)', fontWeight: 600 }}>Join free →</Link>
        </div>
      </footer>
    </div>
  )
}
