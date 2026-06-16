import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { Reveal, RevealItem } from '@/components/Reveal';
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
const Target = () => (
  <svg {...ico}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);
const Send = () => (
  <svg {...ico}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4Z" />
  </svg>
);
const Filter = () => (
  <svg {...ico}>
    <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />
  </svg>
);
const Badge = () => (
  <svg {...ico}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const Lock = () => (
  <svg {...ico}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const Star = () => (
  <svg {...ico}>
    <polygon points="12 2 15.1 8.6 22 9.3 17 14 18.2 21 12 17.6 5.8 21 7 14 2 9.3 8.9 8.6 12 2" />
  </svg>
);

const WHY = [
  {
    Icon: Target,
    title: 'Niche + budget matching',
    body: 'Recommendations weigh niche, audience and budget, for both sides.',
  },
  {
    Icon: Send,
    title: 'Brand invitations',
    body: 'Brands invite creators that already fit. Creators get found, not ignored.',
  },
  {
    Icon: Filter,
    title: 'Less noise, better fits',
    body: 'Skip the irrelevant applications and the endless directory scroll.',
  },
  {
    Icon: Badge,
    title: 'Profiles you can check',
    body: 'Every creator lists their social profiles, open them in one click to view.',
  },
  {
    Icon: Lock,
    title: 'Secure escrow',
    body: 'Funds are held safely until content is approved, protected on both sides.',
  },
  {
    Icon: Star,
    title: 'Two-way reviews',
    body: 'Both sides review each other after a paid collab, revealed together, so feedback stays honest. Reputation is built only through completed collaborations.',
  },
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

export default async function HomePage() {
  // Logged-in users never see the public marketing page - bounce them into the
  // app. This also stops an authed session lingering on a public route.
  const user = await getAuthUser();
  if (user) redirect('/dashboard');

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
        <Reveal immediate>
          <h1
            className="display-face"
            style={{
              fontSize: 'clamp(32px,5.2vw,58px)',
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
              marginBottom: 16,
            }}
          >
            Better matches.
            <br />
            Better collaborations.
          </h1>
        </Reveal>
      </header>

      {/* ── Dual-sided split (the interaction worth keeping) ── */}
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
          <Reveal
            immediate
            x={-40}
            duration={0.6}
            delay={0.06}
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
              Find the right creators.
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
                marginBottom: 30,
              }}
            >
              {[
                'Matched to your niche and budget',
                'Skip the endless outreach and poor-fit applications',
                'Funds protected until content is delivered and approved',
                'Built-in dispute support if things do not go as planned',
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
          </Reveal>
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
          <Reveal
            immediate
            x={40}
            duration={0.6}
            delay={0.16}
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
              Find the right campaigns.
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
                marginBottom: 30,
              }}
            >
              {[
                'Discover campaigns matched to your niche and rates',
                'Stop waiting to be found, apply directly to brands',
                'Get paid securely once your content is approved',
                'Built-in dispute support if things do not go as planned',
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
              className="btn btn-money btn-lg hover-lift"
              style={{ display: 'inline-flex', gap: 8 }}
            >
              Find campaigns <Arrow />
            </span>
          </Reveal>
        </Link>
      </div>

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
                className="card"
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
      </section>

      {/* ══ WHY COLLABR ══ 6 cards: matching + trust + differentiation, merged ══ */}
      <section className="lp-section lp-narrow">
        <Reveal
          style={{ textAlign: 'center', marginBottom: 'clamp(32px,4vw,48px)' }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Why collabr
          </div>
          <h2
            className="display-face"
            style={{
              fontSize: 'clamp(26px,3.4vw,38px)',
              letterSpacing: '-0.02em',
            }}
          >
            A recommendation engine, not a list to scroll.
          </h2>
        </Reveal>
        <Reveal
          stagger
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 16,
          }}
          className="resp-1col"
        >
          {WHY.map(({ Icon, title, body }) => (
            <RevealItem
              key={title}
              className="card hover-lift"
              style={{ padding: 22 }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Icon />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5 }}>
                {title}
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  color: 'var(--ink-soft)',
                  lineHeight: 1.5,
                }}
              >
                {body}
              </p>
            </RevealItem>
          ))}
        </Reveal>
      </section>

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

      {/* ══ FINAL CTA ══ */}
      <section
        style={{
          background:
            'linear-gradient(125deg, color-mix(in srgb, var(--brand) 92%, #000) 0%, var(--brand) 48%, color-mix(in srgb, var(--brand) 76%, #fff) 100%)',
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
        {/* glossy reflection sweep - Revolut-style sheen + a faint glint at the far edge */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(120deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 76%, rgba(255,255,255,.06) 100%)',
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
            Better matches on both sides. Free during beta · No credit card
            needed.
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
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>
            © 2026 collabr. · Singapore
          </span>
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
