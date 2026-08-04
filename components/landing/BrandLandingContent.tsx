import Link from 'next/link'
import {
  Utensils, Sparkles, Plane, Shirt, Wand2, Dumbbell, Cpu, Baby, Briefcase, Gamepad2, GraduationCap, LayoutGrid,
} from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { CREATOR_NICHES, NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import { NAVY, INK_SOFT, INK_FAINT, LINE, ACCENT, ACCENT_TINT, GLOW } from './tokens'

const NICHE_ICON: Record<CreatorNiche, typeof Utensils> = {
  food: Utensils, lifestyle: Sparkles, travel: Plane, fashion: Shirt, beauty: Wand2,
  fitness: Dumbbell, tech: Cpu, parenting: Baby, business: Briefcase, gaming: Gamepad2,
  education: GraduationCap, other: LayoutGrid,
}

const STEPS: readonly (readonly [string, string])[] = [
  ['Browse creators', 'Search and filter the roster, no account needed to look around.'],
  ['Request collaboration', 'Found a fit? Request them, on a campaign you post or one we help you set up.'],
  ['Connect on Collabr', 'Once they accept, you’ll coordinate directly through the platform. During beta, we’ll personally help facilitate the introduction if a creator hasn’t joined yet.'],
  ['Manage everything in Collabr', 'Briefs, approvals, and protected payments, all handled inside the platform from there.'],
]

const WHY: readonly (readonly [string, string])[] = [
  ['Protected payments', 'Funds are held securely and only released once you approve the delivered content.'],
  ['Manage campaigns in one place', 'Briefs, drafts, feedback, and approvals all live in one place instead of scattered across DMs.'],
  ['Real reputation, not just followers', 'See ratings and completed collaborations, so you know who’s reliable before you reach out.'],
  ["We'll help source creators", "Want someone who hasn't joined yet? Request them and we'll personally make the introduction."],
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

export default function BrandLandingContent() {
  return (
    <>
      {/* ══ HERO ══ */}
      <header style={{ position: 'relative', background: NAVY, overflow: 'hidden', textAlign: 'center', padding: 'clamp(56px,7vw,76px) 20px clamp(64px,8vw,96px)' }}>
        <div aria-hidden style={{
          position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)',
          width: 820, height: 560, borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${GLOW}, rgba(10,14,40,0) 68%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(34px,5.4vw,60px)', lineHeight: 1.06, letterSpacing: '-0.035em', fontWeight: 800, color: '#fff', margin: 0, textWrap: 'balance' }}>
            Find creators for your next campaign.
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,19px)', lineHeight: 1.55, color: 'rgba(255,255,255,.66)', maxWidth: 480, margin: '20px auto 0' }}>
            Browse real creators and request a collaboration in minutes.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginTop: 32 }}>
            <Link href="/browse" className="hover-lift" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', color: NAVY, borderRadius: 10, padding: '15px 26px', fontSize: 15.5, fontWeight: 700 }}>
              Browse Creators <span style={{ opacity: .45 }}>→</span>
            </Link>
            <Link href="/signup?role=brand" style={{ fontSize: 14.5, fontWeight: 600, color: 'rgba(255,255,255,.72)', borderBottom: '1px solid rgba(255,255,255,.22)', paddingBottom: 2 }}>
              Already know who you want? Post a campaign
            </Link>
          </div>
          <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 26 }}>
            Free during beta · No credit card required · Browsing needs no account
          </p>
        </div>
      </header>

      {/* ══ HOW IT WORKS ══ sticky label+heading, steps scroll past ══ */}
      <section id="how" className="lp-section">
        <div className="lp-split" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)' }}>
          <div className="lp-sticky">
            <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: 0, textWrap: 'balance' }}>
              Browse. Request. Manage.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: INK_SOFT, margin: '16px 0 0' }}>
              From first search to final payment, the whole collaboration stays in one place.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map(([title, body], i) => (
              <Reveal immediate key={title} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 18, padding: '22px 24px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14 }}>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12.5, fontWeight: 500, color: ACCENT, background: ACCENT_TINT, borderRadius: 8, padding: '6px 0', textAlign: 'center', height: 'fit-content' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: '2px 0 5px', letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT, margin: 0 }}>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHY COLLABR ══ */}
      <section className="lp-section">
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)' }}>
          <Reveal immediate style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>Why Collabr</p>
            <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: 0, maxWidth: 720, textWrap: 'balance' }}>
              Built for finding and working with creators.
            </h2>
          </Reveal>
          <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {WHY.map(([title, body], i) => (
              <Reveal immediate key={title} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '30px 32px 34px' }}>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, letterSpacing: '.1em', color: INK_FAINT }}>{String(i + 1).padStart(2, '0')}</span>
                <h3 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em', margin: '18px 0 9px' }}>{title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT, margin: 0 }}>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CREATORS ACROSS EVERY NICHE ══ category tiles into /browse
          rather than individual creator cards - real people's photos,
          handles, and rates don't belong on a public marketing page nobody
          has to log in to see. This also sidesteps overstating (or
          embarrassingly understating) how many creators are on the
          platform right now; the categories are real regardless of count. */}
      <section id="creators" className="lp-section" style={{ background: '#fff', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)' }}>
          <Reveal immediate style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, marginBottom: 36, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>Creators</p>
              <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: 0, maxWidth: 600, textWrap: 'balance' }}>
                Creators across every niche.
              </h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: INK_SOFT, margin: '12px 0 0', maxWidth: 480 }}>
                From food and beauty to tech and gaming, browse real creators building a roster on Collabr.
              </p>
            </div>
            <Link href="/browse" style={{ fontSize: 15, fontWeight: 600, color: ACCENT, whiteSpace: 'nowrap' }}>Browse all creators →</Link>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {CREATOR_NICHES.map(n => {
              const Icon = NICHE_ICON[n]
              return (
                <Reveal immediate key={n}>
                  <Link
                    href={`/browse?niche=${n}`} className="hover-lift"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
                      background: '#F4F6FC', border: `1px solid ${LINE}`, borderRadius: 14, color: 'inherit',
                    }}
                  >
                    <span style={{
                      width: 36, height: 36, borderRadius: 10, background: ACCENT_TINT, color: ACCENT,
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      <Icon size={17} />
                    </span>
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{NICHE_LABELS[n]}</span>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ sticky label+heading, questions scroll past ══ */}
      <section className="lp-section">
        <div className="lp-split" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)' }}>
          <div className="lp-sticky">
            <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>FAQ</p>
            <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: 0 }}>Questions, answered.</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: INK_SOFT, margin: '16px 0 0' }}>
              Still stuck? <a href="mailto:joincollabr@gmail.com?subject=Collabr%20enquiry" style={{ color: ACCENT, fontWeight: 600 }}>Contact us</a> and a human will reply.
            </p>
          </div>
          <Reveal immediate style={{ display: 'flex', flexDirection: 'column' }}>
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
      <section style={{ position: 'relative', overflow: 'hidden', background: NAVY }}>
        <div aria-hidden style={{
          position: 'absolute', bottom: -220, left: '50%', transform: 'translateX(-50%)',
          width: 820, height: 480, borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${GLOW}, rgba(10,14,40,0) 70%)`,
        }} />
        <div style={{ position: 'relative', maxWidth: 1120, margin: '0 auto', padding: 'clamp(64px,9vw,96px) 20px', textAlign: 'center' }}>
          <Reveal immediate>
            <h2 style={{ fontSize: 'clamp(32px,5vw,50px)', lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 800, color: '#fff', margin: '0 auto', maxWidth: 640, textWrap: 'balance' }}>
              Your next collaboration starts here.
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 32 }}>
              <Link href="/browse" className="hover-lift" style={{ background: '#fff', color: NAVY, borderRadius: 10, padding: '15px 26px', fontSize: 15.5, fontWeight: 700 }}>
                Browse Creators →
              </Link>
              <Link href="/signup?role=brand" className="hover-lift" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.24)', borderRadius: 10, padding: '15px 26px', fontSize: 15.5, fontWeight: 700 }}>
                Post a Campaign →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
