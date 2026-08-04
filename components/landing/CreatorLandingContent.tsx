import Link from 'next/link'
import { ArrowRight, ShieldCheck, ListChecks, Star, Gift } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import WorkflowSteps from '@/components/WorkflowSteps'

const WHY: { icon: () => JSX.Element; title: string; body: string }[] = [
  {
    icon: () => <ShieldCheck size={19} />,
    title: 'Protected payments',
    body: 'Get paid securely, funds are held until your work is approved and live.',
  },
  {
    icon: () => <ListChecks size={19} />,
    title: 'Manage collaborations in one place',
    body: 'Briefs, drafts and approvals, without scattered DMs across five different apps.',
  },
  {
    icon: () => <Star size={19} />,
    title: 'Build real reputation',
    body: 'Ratings and completed collaborations that help you stand out to brands.',
  },
  {
    icon: () => <Gift size={19} />,
    title: 'Free during beta',
    body: 'No subscription, no fee to join, keep what you earn.',
  },
]

// Every CTA on this tab routes to /join, never a generic /signup - /join is
// the one place that checks whether a profile already exists before deciding
// whether to activate it or create a new one, so a creator never has to make
// that call themselves.
const STEPS: readonly (readonly [string, string])[] = [
  ['Join Collabr', 'Sign up, or activate a profile we may have already started for you.'],
  ['Get discovered', 'Brands search and browse for creators like you.'],
  ['Receive requests', 'Accept collaboration requests directly through Collabr.'],
  ['Get paid securely', 'Funds are protected and released once your work is approved.'],
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

export default function CreatorLandingContent() {
  return (
    <>
      {/* ══ HERO ══ light - the creator tab deliberately runs the opposite
          rhythm to the brand tab (light → dark → light instead of
          dark → light → dark), so switching tabs feels like a genuinely
          different experience, not just a relabelled copy. ══ */}
      <header style={{
        position: 'relative', textAlign: 'center', padding: 'clamp(40px,6vw,64px) 20px clamp(40px,6vw,64px)',
        overflow: 'hidden', background: 'var(--app-bg)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div aria-hidden style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: 680, height: 440, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,4,53,.09), transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
          <h1 className="display-face" style={{ fontSize: 'clamp(30px,4.8vw,52px)', lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 16, color: 'var(--ink)' }}>
            Brands are already looking for creators like you.
          </h1>
          <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'var(--ink-soft)', lineHeight: 1.5, maxWidth: 480, margin: '0 auto 24px' }}>
            Get discovered, receive collaboration requests, and get paid securely.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/join" className="btn-primary btn-lg hover-lift" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Join Collabr <ArrowRight size={16} />
            </Link>
            <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
              Already active on Collabr? Log in
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 14 }}>
            Free during beta · No credit card required · Takes 2 minutes
          </p>
        </div>
      </header>

      {/* ══ HOW IT WORKS ══ the dark middle band ══ */}
      <section className="lp-section" style={{
        background: 'linear-gradient(135deg, var(--creator-deep) 0%, var(--creator-deep) 52%, color-mix(in srgb, var(--creator-deep) 82%, #4F46E5) 100%)',
      }}>
        <div className="lp-narrow">
          <Reveal immediate style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 10, color: 'rgba(255,255,255,.5)' }}>How it works</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em', color: '#fff' }}>
              Get discovered. Get paid.
            </h2>
          </Reveal>
          <Reveal immediate className="card" style={{
            padding: 26, maxWidth: 520, margin: '0 auto', color: '#fff',
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', boxShadow: 'none',
          }}>
            <WorkflowSteps
              steps={STEPS}
              dotBg="#fff" dotInk="var(--creator-deep)" lineColor="rgba(255,255,255,.25)"
              descColor="rgba(255,255,255,.62)"
            />
          </Reveal>
        </div>
      </section>

      {/* ══ WHY COLLABR ══ */}
      <section className="lp-section">
        <div className="lp-narrow">
          <Reveal immediate style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Why Collabr</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em' }}>
              Built for creators who want less admin, more collabs.
            </h2>
          </Reveal>
          <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {WHY.map(({ icon: Icon, title, body }) => (
              <Reveal immediate key={title} className="card" style={{ padding: 26 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: 'var(--creator-tint)', color: 'var(--creator-deep)',
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

      {/* ══ FAQ ══ */}
      <section className="lp-section">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal immediate style={{ textAlign: 'center', marginBottom: 'clamp(28px,3.5vw,40px)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>FAQ</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.4vw,38px)', letterSpacing: '-0.02em' }}>Questions, answered.</h2>
          </Reveal>
          <Reveal immediate>
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq-item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══ FINAL CTA ══ light, closing out the light → dark → light rhythm ══ */}
      <section style={{
        background: 'var(--creator-tint)',
        padding: 'clamp(52px,7vw,76px) 20px', textAlign: 'center',
        borderTop: '1px solid var(--line)',
      }}>
        <Reveal immediate>
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,4vw,42px)', color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>
            Ready to get started?
          </h2>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <Link href="/join" className="btn-primary btn-lg hover-lift" style={{ display: 'inline-flex', gap: 8 }}>
              Join Collabr <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
