import Link from 'next/link';
import { Reveal, RevealItem } from '@/components/Reveal';
import { flags } from '@/lib/flags';
import WorkflowSteps from '@/components/WorkflowSteps';
import CountUp from '@/components/CountUp';

/* ── Minimal line icons (no emoji - Linear/Stripe house style) ─────────────── */
const ico = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const Arrow = () => (
  <svg {...ico} width={16} height={16} strokeWidth={2.5}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);
const Check = () => (
  <svg {...ico} width={15} height={15}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Why-Collabr USP icons (desktop section) ── */
const Shield = () => (
  <svg {...ico}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const Approve = () => (
  <svg {...ico}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const Reputation = () => (
  <svg {...ico}>
    <polygon points="12 2 15.1 8.6 22 9.3 17 14 18.2 21 12 17.6 5.8 21 7 14 2 9.3 8.9 8.6 12 2" />
  </svg>
);
const Scale = () => (
  <svg {...ico}>
    <path d="M12 3v18" />
    <path d="M5 7h14" />
    <path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7z" />
    <path d="M19 7l-3 6a3 3 0 0 0 6 0l-3-6z" />
    <path d="M8 21h8" />
  </svg>
);
/* Benefit-led USPs, one crisp line each - trimmed from a 3-line title/
   benefit/"no more" stack to just title + benefit. Each gets its own icon
   tint (was all navy) so the grid reads as four distinct ideas at a glance -
   these are decorative one-offs, not the reserved --money escrow green. */
const WHY: { icon: () => JSX.Element; title: string; benefit: string; tint: string; fg: string }[] = [
  { icon: Shield, title: 'Protected payments', benefit: 'Funds stay held until the work is approved.', tint: '#E5EDFC', fg: '#2451C4' },
  { icon: Approve, title: 'Structured approvals', benefit: 'Drafts, feedback, and approvals, all in one workflow.', tint: '#E3F3E8', fg: '#1F7A44' },
  { icon: Reputation, title: 'Earned reputation', benefit: 'Trust built from completed collaborations, not follower counts.', tint: '#FBF1D6', fg: '#8A6D1B' },
  { icon: Scale, title: 'Fair resolution', benefit: 'A structured dispute process if something goes wrong.', tint: '#E5EDFC', fg: '#2451C4' },
];

const STEPS = {
  brand: [
    [
      'Discover creators',
      'Find the right creators that fit your brand, audience, and budget.',
    ],
    [
      'Collaborate confidently',
      'Your funds stay protected while both sides work together.',
    ],
    [
      'Review the content',
      'Review content and ensure it meets your standards before it reaches your audience.',
    ],
    [
      'Approve and relax',
      'Once approved, payment, reviews, and follow-up are handled automatically for you.',
    ],
  ],
  creator: [
    [
      'Discover campaigns',
      'Find campaigns that fit your niche and rates, or get invited directly by brands.',
    ],
    [
      'Accept with confidence',
      'Funds are secured before you start, so you know your payment is protected.',
    ],
    [
      'Submit your content',
      'Upload drafts, receive feedback, and make changes before anything goes live.',
    ],
    [
      'Get paid',
      'Once posts are live, payment will automatically be released to you. No more chasing or waiting for payments.',
    ],
  ],
} as const;

const STATS: { value: React.ReactNode; label: string; sub: string }[] = [
  {
    value: <CountUp to={100} suffix="%" />,
    label: 'Funds protected',
    sub: 'held until content is approved',
  },
  {
    value: <CountUp to={48} suffix="h" />,
    label: 'Review window',
    sub: 'auto-approves if no response',
  },
  {
    value: <CountUp to={3} suffix=" days" />,
    label: 'Dispute resolution',
    sub: 'platform mediates fairly',
  },
  {
    value: 'Real',
    label: 'Reviews & ratings',
    sub: 'only from completed collabs',
  },
];

/* FAQ — answers the objections that stop signups. Honest copy only: mechanics
   that exist in the product today. */
const FAQ: readonly (readonly [string, string])[] = [
  ['How much does Collabr cost?', 'Brands pay only the agreed rate; creators keep 90% of every payout.'],
  ['How are payments protected?', 'Funds are held by the platform and only released once the content is approved and live.'],
  ['When do creators get paid?', 'Automatically, the moment the approved post goes live. No invoices, no chasing.'],
  ['What if the content isn’t what we agreed?', 'A structured draft-and-revision workflow, plus a dispute process that mediates fairly within 3 days.'],
];

/* Benefit-led USP grid. Shown on all viewports before "How it works" — leading
   with value, then mechanism, is the stronger conversion order. */
function WhySection() {
  return (
    <section className="lp-section">
      <div className="lp-narrow">
        <Reveal
          style={{ textAlign: 'center', marginBottom: 'clamp(32px,4vw,48px)' }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Why Collabr
          </div>
          <h2
            className="display-face"
            style={{
              fontSize: 'clamp(26px,3.4vw,38px)',
              letterSpacing: '-0.02em',
            }}
          >
            Better collaborations, not just more connections.
          </h2>
          <p
            style={{
              color: 'var(--ink-soft)',
              fontSize: 15.5,
              marginTop: 12,
              maxWidth: 480,
              marginInline: 'auto',
            }}
          >
            Built to help brands and creators work together with confidence from
            start to finish.
          </p>
        </Reveal>
        <div
          className="resp-1col"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}
        >
          {WHY.map(({ icon: Icon, title, benefit, tint, fg }, i) => (
            <Reveal key={title} delay={i * 0.07} y={24} scale={0.94} className="card hover-lift" style={{ padding: 26 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: tint,
                  color: fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Icon />
              </div>
              <h3
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                  margin: '0 0 8px',
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: 14.5,
                  color: 'var(--ink-soft)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {benefit}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CurrentLanding() {
  // Logged-in users are redirected to /dashboard by the middleware, so this
  // page stays fully static (prerendered HTML, served from the edge cache).
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(20px,5vw,40px)',
          height: 64,
          background: 'rgba(253,250,249,.85)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: '-0.04em',
            color: 'var(--ink)',
          }}
        >
          collabr<span style={{ color: 'var(--creator)' }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/login"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}
          >
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Join free
          </Link>
        </div>
      </nav>

      {/* ══ HERO ══ headline + dual-sided split + beta pill, in one tight unit ══ */}
      <header
        style={{
          textAlign: 'center',
          padding: 'clamp(36px,6vw,64px) 20px clamp(24px,3vw,32px)',
          maxWidth: 860,
          margin: '0 auto',
        }}
      >
        <div className="hero-enter">
          <h1
            className="display-face"
            style={{
              fontSize: 'clamp(32px,5.2vw,58px)',
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
              marginBottom: 16,
            }}
          >
            Collaborations you can trust.
          </h1>
          <p
            style={{
              fontSize: 'clamp(16px,2.2vw,19px)',
              color: 'var(--ink-soft)',
              lineHeight: 1.5,
              maxWidth: 680,
              margin: '0 auto 24px',
            }}
          >
            Protected payments, structured approvals, and real reputation.
            Better collaborations for brands and creators, not just more of
            them.
          </p>
          {/* No hero CTA buttons here - the brand/creator toggle right below
              the hero is the one audience-selection moment on the page now;
              a second "I'm a brand / I'm a creator" pair up here just
              duplicated it. */}
        </div>
      </header>

      {/* ── Dual-sided split (the interaction worth keeping) ── Phones show one
          side at a time via a CSS-only radio toggle (no JS/hydration cost) -
          stacking both full panels top-to-bottom made mobile visitors scroll
          through content for an audience they aren't part of. Desktop is
          untouched (.split-toggle-mobile and the :has() rules below are both
          scoped to the same ≤768px breakpoint as the rest of the mobile
          overrides in globals.css). ── */}
      <div className="split-wrap">
        <div className="split-toggle-mobile">
          <div className="split-toggle-pills">
            <input type="radio" name="split-tab" id="split-tab-brand" defaultChecked className="sr-only" />
            <label htmlFor="split-tab-brand">I&rsquo;m a brand</label>
            <input type="radio" name="split-tab" id="split-tab-creator" className="sr-only" />
            <label htmlFor="split-tab-creator">I&rsquo;m a creator</label>
          </div>
        </div>
        <div className="split-hero">
        <Link
          href="/signup?role=brand"
          className="split-side split-side-brand"
          style={{ textDecoration: 'none' }}
        >
          <div
            className="split-watermark"
            style={{ color: 'rgba(255,255,255,.05)' }}
          >
            B
          </div>
          <div
            className="hero-enter-left"
            style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}
          >
            <span
              className="badge"
              style={{
                marginBottom: 18,
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
              }}
            >
              For brands
            </span>
            <h2
              style={{
                fontSize: 'clamp(26px,3.2vw,40px)',
                color: '#fff',
                marginBottom: 18,
                lineHeight: 1.06,
                letterSpacing: '-0.02em',
              }}
            >
              Find the right
              <br />
              creators.
            </h2>
            <div
              className="split-bullets"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
                marginBottom: 30,
              }}
            >
              {[
                'Matched to your niche and budget',
                'Real creator reputation, not just follower counts',
                'Funds protected until content is approved',
                'Built-in dispute support if things go sideways',
              ].map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    color: 'rgba(255,255,255,.82)',
                    fontSize: 14.5,
                  }}
                >
                  <span
                    style={{ color: 'var(--accent-on-dark)', flexShrink: 0 }}
                  >
                    <Check />
                  </span>
                  {t}
                </div>
              ))}
            </div>
            <span
              className="btn btn-lg hover-lift"
              style={{
                background: '#fff',
                color: 'var(--ink)',
                display: 'inline-flex',
                gap: 8,
              }}
            >
              Find creators <Arrow />
            </span>
          </div>
        </Link>

        <div className="split-medallion">
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: '-0.04em',
              color: 'var(--ink)',
              lineHeight: 1,
            }}
          >
            collabr<span style={{ color: 'var(--creator)' }}>.</span>
          </div>
        </div>

        <Link
          href="/signup?role=creator"
          className="split-side split-side-creator"
          style={{ textDecoration: 'none' }}
        >
          <div
            className="split-watermark"
            style={{ color: 'rgba(28,25,23,.06)' }}
          >
            C
          </div>
          <div
            className="hero-enter-right"
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: 440,
              marginLeft: 'auto',
            }}
          >
            <span
              className="badge"
              style={{
                marginBottom: 18,
                background: 'rgba(28,25,23,.08)',
                color: 'var(--ink)',
              }}
            >
              For creators
            </span>
            <h2
              style={{
                fontSize: 'clamp(26px,3.2vw,40px)',
                color: 'var(--ink)',
                marginBottom: 18,
                lineHeight: 1.06,
                letterSpacing: '-0.02em',
              }}
            >
              Find the right
              <br />
              campaigns.
            </h2>
            <div
              className="split-bullets"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
                marginBottom: 30,
              }}
            >
              {[
                'Campaigns matched to your niche and rates',
                'Build a reputation that gets you hired again',
                'Get paid securely once your content is approved',
                'Built-in dispute support if things go sideways',
              ].map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    color: 'var(--ink-soft)',
                    fontSize: 14.5,
                  }}
                >
                  <span style={{ color: 'var(--creator-deep)', flexShrink: 0 }}>
                    <Check />
                  </span>
                  {t}
                </div>
              ))}
            </div>
            <span
              className="btn btn-lg hover-lift"
              style={{
                background: 'var(--ink)',
                color: '#fff',
                display: 'inline-flex',
                gap: 8,
              }}
            >
              Find campaigns <Arrow />
            </span>
          </div>
        </Link>
        </div>
      </div>

      {/* ══ WHY COLLABR ══ benefit-led USP grid. Value before mechanism on every
          viewport, the stronger conversion order. ══ */}
      <WhySection />

      {/* ══ HOW IT WORKS ══ one workflow section, two columns ══ */}
      <section
        className="lp-section"
        style={{ background: 'var(--surface-2)' }}
      >
        <div className="lp-narrow">
          <Reveal
            style={{
              textAlign: 'center',
              marginBottom: 'clamp(32px,4vw,48px)',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              How it works
            </div>
            <h2
              className="display-face"
              style={{
                fontSize: 'clamp(26px,3.4vw,38px)',
                letterSpacing: '-0.02em',
              }}
            >
              Match. Secure. Review. Paid.
            </h2>
            <p
              style={{
                color: 'var(--ink-soft)',
                fontSize: 15.5,
                marginTop: 12,
                maxWidth: 460,
                marginInline: 'auto',
              }}
            >
              The same protected flow on both sides, from first match to final
              payout.
            </p>
          </Reveal>
          <div className="how-wrap">
            <div className="how-toggle-mobile">
              <div className="split-toggle-pills">
                <input type="radio" id="how-tab-brand" name="how-tab" defaultChecked style={{ display: 'none' }} />
                <label htmlFor="how-tab-brand">For brands</label>
                <input type="radio" id="how-tab-creator" name="how-tab" style={{ display: 'none' }} />
                <label htmlFor="how-tab-creator">For creators</label>
              </div>
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
              className="pc-grid"
            >
              {(
                [
                  ['For brands', 'brand', 'var(--brand)', '#fff', {}],
                  [
                    'For creators',
                    'creator',
                    'var(--creator)',
                    'var(--creator-ink)',
                    {
                      borderColor: 'var(--creator)',
                      boxShadow: '0 0 0 1px var(--creator-tint) inset',
                    },
                  ],
                ] as const
              ).map(([label, key, dotBg, dotInk, extra]) => (
                <Reveal
                  key={key}
                  className={`card how-card-${key}`}
                  style={{ padding: 26, ...extra }}
                >
                  <div className="eyebrow" style={{ marginBottom: 18 }}>
                    {label}
                  </div>
                  <WorkflowSteps
                    steps={STEPS[key]}
                    dotBg={dotBg}
                    dotInk={dotInk}
                    lineColor={dotBg}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CONNECTED CREATOR / proven performance USP, analytics suite only ══ */}
      {flags.analyticsSuite && (
        <section
          className="lp-section"
          style={{ background: 'var(--surface-2)' }}
        >
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 20px' }}>
            <Reveal
              style={{
                textAlign: 'center',
                marginBottom: 'clamp(28px,3.5vw,44px)',
              }}
            >
              <span
                className="eyebrow"
                style={{ color: 'var(--ink-faint-solid)' }}
              >
                Proven performance
              </span>
              <h2
                className="display-face"
                style={{
                  fontSize: 'clamp(26px,3.2vw,38px)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  marginTop: 10,
                }}
              >
                Hire on real results, not follower counts
              </h2>
              <p
                style={{
                  fontSize: 'clamp(15px,1.5vw,17px)',
                  color: 'var(--ink-soft)',
                  lineHeight: 1.6,
                  maxWidth: 560,
                  margin: '12px auto 0',
                }}
              >
                ⭐ Connected Creators sync their TikTok, Instagram and YouTube
                performance automatically, so brands see average views,
                engagement and reach. 🛡️ Collabr Certified shows who's reliable.
                No rankings, no vanity metrics, just a creator's own track
                record.
              </p>
            </Reveal>
            <div
              className="resp-2col"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
              }}
            >
              {[
                [
                  '🛡️ Collabr Certified',
                  'Earned from completed collaborations, strong ratings and reliability, kept current, suspendable.',
                ],
                [
                  '⭐ Connected Creator',
                  'Auto-synced performance metrics from connected social accounts. A Creator Pro benefit.',
                ],
                [
                  '💎 Creator Pro',
                  'Creator Studio, AI Growth & Brand Coach, Content Lab, weekly reports, and a lower platform fee.',
                ],
              ].map(([title, body]) => (
                <Reveal key={title} className="card" style={{ padding: 24 }}>
                  <h3
                    style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      fontSize: 14.5,
                      color: 'var(--ink-soft)',
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {body}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ TRUST NUMBERS ══ single minimal stat strip, count-up ══ */}
      <section
        className="lp-section"
        style={{
          background: 'var(--brand)',
          paddingTop: 'clamp(40px,5vw,60px)',
          paddingBottom: 'clamp(40px,5vw,60px)',
        }}
      >
        <Reveal
          stagger
          className="resp-stats lp-narrow"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 20,
          }}
        >
          {STATS.map(({ value, label, sub }) => (
            <RevealItem key={label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-grotesk)',
                  fontWeight: 700,
                  fontSize: 'clamp(28px,3.5vw,38px)',
                  letterSpacing: '-0.03em',
                  color: '#fff',
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: '#fff',
                  marginTop: 9,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,.5)',
                  marginTop: 2,
                }}
              >
                {sub}
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </section>

      {/* ══ FAQ ══ answers the last objections right before the final ask.
          Native <details> — server-rendered, zero JS, SEO-indexable. ══ */}
      <section className="lp-section">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal
            style={{
              textAlign: 'center',
              marginBottom: 'clamp(28px,3.5vw,40px)',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              FAQ
            </div>
            <h2
              className="display-face"
              style={{
                fontSize: 'clamp(26px,3.4vw,38px)',
                letterSpacing: '-0.02em',
              }}
            >
              Questions, answered.
            </h2>
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
      <section
        style={{
          // Stays in the navy/indigo family (no desaturated grey) so it reads as
          // one cohesive dark surface with the stats band above, just subtly lit.
          background:
            'linear-gradient(135deg, var(--brand) 0%, var(--brand) 52%, color-mix(in srgb, var(--brand) 82%, #4F46E5) 100%)',
          color: '#fff',
          padding: 'clamp(56px,8vw,88px) 20px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* soft background atmosphere - pure CSS, no JS, no parallax */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-30%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 620,
            height: 620,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(124,108,255,.18), transparent 62%)',
            pointerEvents: 'none',
          }}
        />
        {/* glossy reflection sweep - subtle Revolut-style sheen across the top-left */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(120deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 32%)',
          }}
        />
        <Reveal style={{ position: 'relative', zIndex: 1 }}>
          <h2
            className="display-face"
            style={{
              fontSize: 'clamp(28px,4.4vw,48px)',
              color: '#fff',
              marginBottom: 12,
              letterSpacing: '-0.03em',
            }}
          >
            Find your next collaboration.
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,.55)',
              fontSize: 16,
              marginBottom: 32,
            }}
          >
            Better matches on both sides.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/signup?role=brand"
              className="btn btn-lg hover-lift"
              style={{
                background: '#fff',
                color: 'var(--ink)',
                display: 'inline-flex',
                gap: 8,
              }}
            >
              I&apos;m a brand <Arrow />
            </Link>
            <Link
              href="/signup?role=creator"
              className="btn btn-money btn-lg hover-lift"
              style={{ display: 'inline-flex', gap: 8 }}
            >
              I&apos;m a creator <Arrow />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          background: 'var(--brand)',
          borderTop: '1px solid rgba(255,255,255,.08)',
          padding: '22px clamp(20px,5vw,40px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '-0.04em',
            color: '#fff',
          }}
        >
          collabr<span style={{ color: 'var(--accent-on-dark)' }}>.</span>
        </span>
        <div
          style={{
            display: 'flex',
            gap: 22,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>
            © 2026 collabr. · Singapore
          </span>
          <Link
            href="/privacy"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.45)',
              fontWeight: 500,
            }}
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.45)',
              fontWeight: 500,
            }}
          >
            Terms
          </Link>
          <Link
            href="/data-deletion"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.45)',
              fontWeight: 500,
            }}
          >
            Data deletion
          </Link>
          <a
            href="mailto:joincollabr@gmail.com?subject=Collabr%20enquiry"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.45)',
              fontWeight: 500,
            }}
          >
            Contact us
          </a>
          <Link
            href="/login"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.45)',
              fontWeight: 500,
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              fontSize: 13,
              color: 'var(--accent-on-dark)',
              fontWeight: 600,
            }}
          >
            Join free →
          </Link>
        </div>
      </footer>
    </div>
  );
}
