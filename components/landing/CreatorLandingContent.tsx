import Link from 'next/link'
import { Reveal, RevealItem } from '@/components/Reveal'
import { NAVY, INK_SOFT, INK_FAINT, LINE, ACCENT, ACCENT_TINT, GLOW } from './tokens'

const STEPS: readonly (readonly [string, string])[] = [
  ['Join Collabr', 'Sign up, or activate a profile we may have already started for you.'],
  ['Get discovered', 'Brands search and browse for creators like you.'],
  ['Receive requests', 'Accept collaboration requests directly through Collabr.'],
  ['Get paid securely', 'Funds are protected and released once your work is approved.'],
]

const WHY: readonly (readonly [string, string])[] = [
  ['Protected payments', 'Get paid securely, funds are held until your work is approved and live.'],
  ['Manage collaborations in one place', 'Briefs, drafts and approvals, without scattered DMs across five different apps.'],
  ['Build real reputation', 'Ratings and completed collaborations that help you stand out to brands.'],
  ['Free during beta', 'No subscription, no fee to join, keep what you earn.'],
]

const FAQ: readonly (readonly [string, string])[] = [
  [
    'Do I need to already have a profile?',
    'No. If we haven’t already put one together for you, you can create your own in a couple of minutes.',
  ],
  [
    'How much does it cost to join?',
    'Nothing. Joining and receiving collaboration requests is completely free during beta.',
  ],
  [
    'How do I get paid?',
    'Once your content is approved and live, payment is released automatically, no invoicing and no chasing.',
  ],
  [
    'What if a brand and I don’t see eye to eye?',
    'Every collaboration has a structured draft-and-revision process, and a dispute process if it’s ever needed.',
  ],
]

// Every CTA on this tab routes to /join, never a generic /signup - /join is
// the one place that checks whether a profile already exists before deciding
// whether to activate it or create a new one, so a creator never has to make
// that call themselves.
export default function CreatorLandingContent() {
  return (
    <>
      {/* ══ HERO ══ same dark navy band as the brand hero - one consistent
          top-level identity, only the copy and CTA change per audience. ══ */}
      <header style={{ position: 'relative', background: NAVY, overflow: 'hidden', textAlign: 'center', padding: 'clamp(56px,7vw,76px) 20px clamp(64px,8vw,96px)' }}>
        <div aria-hidden style={{
          position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)',
          width: 820, height: 560, borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${GLOW}, rgba(10,14,40,0) 68%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(34px,5.4vw,60px)', lineHeight: 1.06, letterSpacing: '-0.035em', fontWeight: 800, color: '#fff', margin: 0, textWrap: 'balance' }}>
            Brands are already looking for creators like you.
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,19px)', lineHeight: 1.55, color: 'rgba(255,255,255,.66)', maxWidth: 480, margin: '20px auto 0' }}>
            Get discovered, receive collaboration requests, and get paid securely.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginTop: 32 }}>
            <Link href="/join" className="hover-lift" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: '#fff', color: NAVY, borderRadius: 10, padding: '15px 26px', fontSize: 15.5, fontWeight: 700 }}>
              Join Collabr <span style={{ opacity: .45 }}>→</span>
            </Link>
            <Link href="/login" style={{ fontSize: 14.5, fontWeight: 600, color: 'rgba(255,255,255,.72)', borderBottom: '1px solid rgba(255,255,255,.22)', paddingBottom: 2 }}>
              Already active on Collabr? Log in
            </Link>
          </div>
          <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 26 }}>
            Free during beta · No credit card required · Takes 2 minutes
          </p>
        </div>
      </header>

      {/* ══ HOW IT WORKS ══ sticky label+heading, steps scroll past ══ */}
      <section id="how" className="lp-section">
        <div className="lp-split" style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)' }}>
          <div className="lp-sticky">
            <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: 0, textWrap: 'balance' }}>
              Get discovered. Get paid.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: INK_SOFT, margin: '16px 0 0' }}>
              Set up a profile once, then let brands come to you with paid work.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map(([title, body], i) => (
              <Reveal key={title} delay={i * 0.06} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 18, padding: '22px 24px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14 }}>
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
          <Reveal style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, margin: '0 0 14px' }}>Why Collabr</p>
            <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: 0, maxWidth: 720, textWrap: 'balance' }}>
              Built for creators who want less admin, more collabs.
            </h2>
          </Reveal>
          <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {WHY.map(([title, body], i) => (
              <Reveal key={title} delay={i * 0.08} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '30px 32px 34px' }}>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, letterSpacing: '.1em', color: INK_FAINT }}>{String(i + 1).padStart(2, '0')}</span>
                <h3 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em', margin: '18px 0 9px' }}>{title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT, margin: 0 }}>{body}</p>
              </Reveal>
            ))}
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
              Still stuck? <a href="mailto:joincollabr@gmail.com?subject=Collabr%20enquiry" style={{ color: ACCENT, fontWeight: 600 }}>Contact us</a>.
            </p>
          </div>
          <Reveal stagger style={{ display: 'flex', flexDirection: 'column' }}>
            {FAQ.map(([q, a]) => (
              <RevealItem key={q}>
                <details className="faq-item">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              </RevealItem>
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
          <Reveal>
            <h2 style={{ fontSize: 'clamp(32px,5vw,50px)', lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 800, color: '#fff', margin: '0 auto', maxWidth: 640, textWrap: 'balance' }}>
              Your next collaboration starts here.
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 32 }}>
              <Link href="/join" className="hover-lift" style={{ background: '#fff', color: NAVY, borderRadius: 10, padding: '15px 26px', fontSize: 15.5, fontWeight: 700 }}>
                Join Collabr →
              </Link>
              <Link href="#how" className="hover-lift" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.24)', borderRadius: 10, padding: '15px 26px', fontSize: 15.5, fontWeight: 700 }}>
                See how it works →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
