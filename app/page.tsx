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

      {/* ── Matching banner ── */}
      <div style={{
        textAlign: 'center', padding: '40px 24px 8px',
        maxWidth: 720, margin: '0 auto',
      }}>
        <Reveal>
          <div className="eyebrow" style={{ marginBottom: 14 }}>The two-sided matching engine</div>
          <h1 className="display-face" style={{ fontSize: 'clamp(30px,4.5vw,52px)', lineHeight: 1.04, marginBottom: 14 }}>
            Better matches.<br />Better collaborations.
          </h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 17, maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
            Collabr recommends the right fit on both sides — brands find creators for their niche and budget,
            creators find campaigns worth saying yes to. Pick your side.
          </p>
        </Reveal>
      </div>

      {/* ── Split Hero ── */}
      <div className="split-hero">
        {/* Brand side */}
        <Link href="/signup?role=brand" className="split-side split-side-brand" style={{ textDecoration: 'none' }}>
          <div className="split-watermark" style={{ color: 'rgba(255,255,255,.05)' }}>B</div>
          <Reveal immediate x={-48} duration={0.65} delay={0.08} style={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
            <span className="badge badge-ink" style={{ marginBottom: 20, background: 'rgba(255,255,255,.12)', color: '#fff' }}>
              For brands
            </span>
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,46px)', color: '#fff', marginBottom: 20, lineHeight: 1.05 }}>
              Find the right creators for your brand.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
              {[
                'Get matched to creators that fit your niche and budget',
                'Skip sifting through hundreds of mismatched applications',
                'Invite and hire with confidence — vetted, verified creators',
              ].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'rgba(255,255,255,.8)', fontSize: 15 }}>
                  <span style={{ color: 'var(--accent-on-dark)', flexShrink: 0, marginTop: 1 }}><ShieldCheck /></span>
                  {t}
                </div>
              ))}
            </div>
            <span className="btn btn-primary btn-lg hover-lift" style={{ background: '#fff', color: 'var(--ink)', display: 'inline-flex', gap: 8 }}>
              Find creators <ArrowRight />
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
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,46px)', color: 'var(--ink)', marginBottom: 20, lineHeight: 1.05 }}>
              Find the right campaigns for you.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
              {[
                'Discover campaigns matched to your niche — and get invited by brands',
                'Skip the poor-fit applications that never go anywhere',
                'Get paid securely once your content is approved',
              ].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--ink-soft)', fontSize: 15 }}>
                  <span style={{ color: 'var(--creator-deep)', flexShrink: 0, marginTop: 1 }}><ShieldCheck /></span>
                  {t}
                </div>
              ))}
            </div>
            <span className="btn btn-money btn-lg hover-lift" style={{ display: 'inline-flex', gap: 8 }}>
              Find campaigns <ArrowRight />
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

      {/* ── Discovery story (engine works both ways) ── */}
      <section style={{ padding: '72px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>How matching works</div>
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>The engine works both ways.</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 16, marginTop: 12, maxWidth: 560, margin: '12px auto 0' }}>
            Collabr puts the right opportunities in front of both sides — then makes it easy to connect and collaborate.
          </p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="pc-grid">
          {/* Brands discover creators */}
          <Reveal stagger className="card" style={{ padding: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 20 }}>Brands</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                ['Discover creators', 'Get a shortlist of creators that fit your niche, audience, and budget.'],
                ['Invite the best fits', 'Reach out directly — no wading through hundreds of cold applications.'],
                ['Manage the collab', 'Brief, review, and approve in one place, from match to delivery.'],
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
          </Reveal>
          {/* Creators discover campaigns */}
          <Reveal stagger className="card" style={{ padding: 28, borderColor: 'var(--creator)', boxShadow: '0 0 0 1px var(--creator-tint) inset' }}>
            <div className="eyebrow" style={{ marginBottom: 20 }}>Creators</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                ['Discover campaigns', 'See campaigns matched to your niche and rate — not a noisy feed.'],
                ['Receive invitations', 'Get found and invited by brands that actually want your work.'],
                ['Manage the collab', 'Accept, submit, and get paid securely — all in one place.'],
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
          </Reveal>
        </div>
      </section>

      {/* ── Differentiation (two-sided recommendation engine) ── */}
      <section style={{ background: 'var(--ink)', color: '#fff', padding: '72px 40px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--accent-on-dark)' }}>Not a directory</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)', color: '#fff' }}>
              A recommendation engine, not a list to scroll.
            </h2>
            <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 16, marginTop: 14, maxWidth: 620, margin: '14px auto 0', lineHeight: 1.55 }}>
              Influencer directories and open campaign marketplaces leave you searching and sorting on your own.
              Collabr matches both sides — so brands surface relevant creators and creators surface relevant
              campaigns, instead of starting from a blank search bar.
            </p>
          </Reveal>
          <Reveal stagger className="resp-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 40 }}>
            {[
              ['Search a directory', 'Two-sided matching surfaces the right fit for you'],
              ['Post and pray for applicants', 'Invite creators that already fit your niche and budget'],
              ['Sift through poor-fit applications', 'Spend time only on collaborations worth doing'],
            ].map(([before, after]) => (
              <RevealItem key={before} style={{
                textAlign: 'left', padding: 22, borderRadius: 'var(--radius)',
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
              }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', textDecoration: 'line-through', marginBottom: 8 }}>{before}</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: '#fff', lineHeight: 1.45 }}>{after}</div>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Trust story (matching primary, escrow demoted to one of several supports) ── */}
      <section style={{ padding: '72px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Built on trust</div>
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>Match with confidence.</h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 16, marginTop: 12, maxWidth: 560, margin: '12px auto 0' }}>
            A good match is only the start. Verified ownership, two-way reviews, and secure escrow keep every
            collaboration honest on both sides.
          </p>
        </Reveal>
        <Reveal stagger className="resp-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { icon: '✅', title: 'Verified ownership', body: 'Follower counts and accounts authenticated directly from platform APIs. No fakes on either side.' },
            { icon: '⭐', title: 'Two-way reviews', body: 'Brands and creators rate each other after every collab. Bad-fit behaviour gets flagged fast.' },
            { icon: '🔒', title: 'Secure escrow', body: 'Funds held safely until content is confirmed — supporting trust, so the focus stays on the match.' },
          ].map(({ icon, title, body }) => (
            <RevealItem key={title} className="card hover-lift" style={{ padding: 24 }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{body}</p>
            </RevealItem>
          ))}
        </Reveal>
        {/* Escrow facts — demoted to a supporting strip */}
        <Reveal stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="resp-1col">
          {[
            { stat: '100%', label: 'Funds held in escrow', sub: 'until content is confirmed' },
            { stat: '48h', label: 'Brand review window', sub: 'auto-approves if no response' },
            { stat: '3 days', label: 'Dispute resolution', sub: 'platform mediates fairly' },
          ].map(({ stat, label, sub }) => (
            <RevealItem key={stat} style={{ textAlign: 'center', padding: '16px 12px' }}>
              <div style={{ fontFamily: 'var(--font-grotesk)', fontWeight: 700, fontSize: 30, letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1 }}>{stat}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginTop: 8 }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 3 }}>{sub}</div>
            </RevealItem>
          ))}
        </Reveal>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: 'var(--surface-2)', padding: '72px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>How it works</div>
            <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>From match to paid, on both sides.</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="pc-grid">
            {/* Brand steps */}
            <div className="card" style={{ padding: 28 }}>
              <div className="eyebrow" style={{ marginBottom: 20 }}>For brands</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  ['Get matched', 'Tell us your niche and budget. See creators recommended for you.'],
                  ['Invite or review', 'Invite the best fits, or review verified applicants. Pick who fits.'],
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
                  ['Get matched', 'See campaigns recommended for your niche — or get invited by brands.'],
                  ['Accept the fit', 'Say yes to the ones worth it. Receive the brief and details.'],
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
          <h2 className="display-face" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>Built to find the right fit.</h2>
        </Reveal>
        <Reveal stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="pc-grid">
          {[
            { icon: '🎯', title: 'Niche + budget matching', body: 'Recommendations that weigh niche, audience, and budget — for both brands and creators.' },
            { icon: '📨', title: 'Invitations, not cold calls', body: 'Brands invite the creators that fit; creators get found by brands that want them.' },
            { icon: '🧹', title: 'Less noise, fewer poor fits', body: 'Skip the irrelevant applications and the endless directory scroll on either side.' },
            { icon: '💸', title: 'No agency cut',           body: 'Direct connection. 0% platform fee during beta. 30 days notice before any change.' },
            { icon: '📱', title: 'Apple & Google Pay',      body: 'One-tap mobile payments. Stripe-powered with bank-grade security.' },
            { icon: '⏱', title: 'Auto-approve safety',     body: '48-hour review window. Content auto-approves if brand doesn\'t respond.' },
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
          Find your next collaboration.
        </h2>
        <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 16, marginBottom: 36 }}>
          Better matches on both sides. Free during beta · No credit card needed.
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
