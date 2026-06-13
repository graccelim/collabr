import Link from 'next/link'
import { Reveal, RevealItem } from '@/components/Reveal'

function ShieldCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-body)' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 68,
        background: 'rgba(253,250,249,.88)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800, fontSize: 20,
          letterSpacing: '-0.04em', color: 'var(--ink)',
        }}>
          collabr<span style={{ color: 'var(--creator)' }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Join free
          </Link>
        </div>
      </nav>

      {/* ── Split Hero ── */}
      <div className="split-hero">
        {/* Brand side */}
        <Link href="/signup?role=brand" className="split-side split-side-brand" style={{ textDecoration: 'none' }}>
          <div className="split-watermark" style={{ color: 'rgba(255,255,255,.05)' }}>B</div>
          <Reveal immediate x={-48} duration={0.65} delay={0.08} style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
            <span className="badge badge-ink" style={{ marginBottom: 20, background: 'rgba(255,255,255,.12)', color: '#fff' }}>
              For brands
            </span>
            <h1 style={{ fontSize: 'clamp(28px,3.5vw,46px)', color: '#fff', marginBottom: 20, lineHeight: 1.05 }}>
              Find creators who actually fit your brand.
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
              {[
                'Free to post during beta — you pay only your creator’s rate',
                'Your money stays in escrow until you confirm',
                'Pick from real, vetted creators',
              ].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'rgba(255,255,255,.8)', fontSize: 15 }}>
                  <span style={{ color: 'var(--accent-on-dark)', flexShrink: 0, marginTop: 1 }}><ShieldCheck /></span>
                  {t}
                </div>
              ))}
            </div>
            <span className="btn btn-primary btn-lg hover-lift" style={{ background: '#fff', color: 'var(--ink)', display: 'inline-flex', gap: 8 }}>
              Post a campaign free <ArrowRight />
            </span>
          </Reveal>
        </Link>

        {/* Centre medallion */}
        <div className="split-medallion" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
            collabr<span style={{ color: 'var(--creator)' }}>.</span>
          </div>
        </div>

        {/* Creator side */}
        <Link href="/signup?role=creator" className="split-side split-side-creator" style={{ textDecoration: 'none' }}>
          <div className="split-watermark" style={{ color: 'rgba(28,25,23,.06)' }}>C</div>
          <Reveal immediate x={48} duration={0.65} delay={0.2} style={{ position: 'relative', zIndex: 1, maxWidth: 460, marginLeft: 'auto' }}>
            <span className="badge" style={{ marginBottom: 20, background: 'rgba(28,25,23,.08)', color: 'var(--ink)' }}>
              For creators
            </span>
            <h1 style={{ fontSize: 'clamp(28px,3.5vw,46px)', color: 'var(--ink)', marginBottom: 20, lineHeight: 1.05 }}>
              Get paid for content you'd make anyway.
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
              {[
                'Free to join — a 12% platform fee applies only when you get paid',
                'Get paid automatically once you post',
                'Only campaigns that match your niche',
              ].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--ink-soft)', fontSize: 15 }}>
                  <span style={{ color: 'var(--creator-deep)', flexShrink: 0, marginTop: 1 }}><ShieldCheck /></span>
                  {t}
                </div>
              ))}
            </div>
            <span className="btn btn-money btn-lg hover-lift" style={{ display: 'inline-flex', gap: 8 }}>
              Start earning <ArrowRight />
            </span>
          </Reveal>
        </Link>
      </div>

      {/* ── Beta strip ── */}
      <div style={{
        background: 'var(--ink)', color: '#fff',
        textAlign: 'center', padding: '14px 24px',
        fontSize: 14, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--accent-on-dark)' }}>✦</span>
        Free during beta · Singapore · No credit card needed
        <span style={{ color: 'var(--accent-on-dark)' }}>✦</span>
      </div>

      {/* ── Escrow trust section ── */}
      <section style={{ padding: '72px 40px', maxWidth: 960, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Why escrow?</div>
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>Real money handled seriously.</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 16, marginTop: 12, maxWidth: 540, margin: '12px auto 0' }}>
            Every dollar is held safely until both sides are happy. No surprises, no chargebacks.
          </p>
        </Reveal>
        <Reveal stagger className="resp-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {[
            { stat: '100%', label: 'Funds held in escrow', sub: 'until content is confirmed' },
            { stat: '48h', label: 'Brand review window', sub: 'auto-approves if no response' },
            { stat: '3 days', label: 'Dispute resolution', sub: 'platform mediates fairly' },
          ].map(({ stat, label, sub }) => (
            <RevealItem key={stat} className="card" style={{ textAlign: 'center', padding: 28 }}>
              <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 42, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>{stat}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginTop: 10 }}>{label}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>{sub}</div>
            </RevealItem>
          ))}
        </Reveal>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: 'var(--surface-2)', padding: '72px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>How it works</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>Simple for both sides.</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="pc-grid">
            {/* Brand steps */}
            <div className="card" style={{ padding: 28 }}>
              <div className="eyebrow" style={{ marginBottom: 20 }}>For brands</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  ['Post a brief', 'Describe what you need. Set your budget. Live in 5 minutes.'],
                  ['Review applicants', 'Creators apply with verified stats. Pick who fits your brand.'],
                  ['Fund escrow', 'Deposit only the agreed amount. Held safely until you confirm.'],
                  ['Approve & release', 'Happy with the content? Confirm and payment releases automatically.'],
                ].map(([t, d], i) => (
                  <div key={t} style={{ display: 'flex', gap: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--ink)', color: '#fff',
                      display: 'grid', placeItems: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                      flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{t}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 3 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Creator steps */}
            <div className="card" style={{ padding: 28, borderColor: 'var(--creator)', boxShadow: '0 0 0 1px var(--creator-tint) inset' }}>
              <div className="eyebrow" style={{ marginBottom: 20 }}>For creators</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  ['Browse campaigns', 'Filter by niche, platform, and payout. Apply with a pitch.'],
                  ['Get accepted', 'Brand reviews your profile and picks you. Receive the brief.'],
                  ['Submit your draft', 'Upload privately for brand review. No public posting yet.'],
                  ['Post & get paid', 'Brand approves → you post → escrow releases to your account.'],
                ].map(([t, d], i) => (
                  <div key={t} style={{ display: 'flex', gap: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--creator)', color: 'var(--creator-ink)',
                      display: 'grid', placeItems: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                      flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{t}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 3 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section style={{ padding: '72px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Why collabr.</div>
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>Built around trust.</h2>
        </Reveal>
        <Reveal stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="pc-grid">
          {[
            { icon: '🔒', title: 'Escrow protection',    body: 'Payment held safely until you approve the content. Neither side can lose.' },
            { icon: '✅', title: 'Verified stats',       body: 'Follower counts authenticated directly from platform APIs. No fakes.' },
            { icon: '⭐', title: 'Two-way ratings',      body: 'Brands and creators rate each other. Bad actors flagged fast.' },
            { icon: '💸', title: 'No agency cut',        body: 'Direct connection. 0% platform fee during beta. 30 days notice before any change.' },
            { icon: '📱', title: 'Apple & Google Pay',   body: 'One-tap mobile payments. Stripe-powered with bank-grade security.' },
            { icon: '⏱', title: 'Auto-approve safety',  body: '48-hour review window. Content auto-approves if brand doesn\'t respond.' },
          ].map(({ icon, title, body }) => (
            <RevealItem key={title} className="card hover-lift" style={{ padding: 22 }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </section>

      {/* ── CTA ── */}
      <section style={{
        background: 'var(--ink)', color: '#fff',
        padding: '80px 40px', textAlign: 'center',
      }}>
        <Reveal>
        <h2 className="display-face" style={{ fontSize: 'clamp(28px,4vw,48px)', color: '#fff', marginBottom: 14 }}>
          Ready to start?
        </h2>
        <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 16, marginBottom: 36 }}>
          Free during beta. No credit card needed.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup?role=brand" className="btn btn-lg hover-lift" style={{ background: '#fff', color: 'var(--ink)', display: 'inline-flex', gap: 8 }}>
            I&apos;m a brand <ArrowRight />
          </Link>
          <Link href="/signup?role=creator" className="btn btn-money btn-lg hover-lift" style={{ display: 'inline-flex', gap: 8 }}>
            I&apos;m a creator <ArrowRight />
          </Link>
        </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,.08)',
        padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em', color: '#fff' }}>
          collabr<span style={{ color: 'var(--accent-on-dark)' }}>.</span>
        </span>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>© 2025 collabr. · Singapore</span>
          <Link href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Log in</Link>
          <Link href="/signup" style={{ fontSize: 13, color: 'var(--accent-on-dark)', fontWeight: 600 }}>Join free →</Link>
        </div>
      </footer>
    </div>
  )
}
