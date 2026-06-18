import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions | Collabr',
  description: 'The terms and conditions governing use of Collabr by brands and creators.',
}

const LAST_UPDATED = '18 June 2026'
const SUPPORT_EMAIL = 'joincollabr@gmail.com'

// Lightweight prose helpers so the page reads cleanly without a CMS.
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 10 }}>
        {n}. {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
        {children}
      </div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
      {/* Minimal public header */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: 'rgba(241,245,252,0.85)',
          backdropFilter: 'saturate(180%) blur(12px)', borderBottom: '1px solid var(--line)',
        }}
      >
        <Link href="/" style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', color: 'var(--accent)' }}>
          collabr<span style={{ color: 'var(--money)' }}>.</span>
        </Link>
        <Link href="/signup" className="btn-primary" style={{ fontSize: 14, fontWeight: 600 }}>
          Join free
        </Link>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 96px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          Terms &amp; Conditions
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint-solid)', marginTop: 8 }}>
          Last updated: {LAST_UPDATED}
        </p>

        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-soft)', marginTop: 20 }}>
          These Terms &amp; Conditions (the &ldquo;Terms&rdquo;) govern your access to and use of Collabr (the
          &ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a marketplace that connects brands
          (&ldquo;Brands&rdquo;) with content creators (&ldquo;Creators&rdquo;) and facilitates payments held in
          escrow. By creating an account, posting a campaign, applying to a campaign, or otherwise using the
          Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform.
        </p>

        <Section n={1} title="Eligibility and accounts">
          <p>You must be at least 18 years old and able to form a legally binding contract to use Collabr. You agree to provide accurate, current and complete information and to keep it up to date. You are responsible for all activity under your account and for keeping your credentials secure. We may refuse, suspend or terminate accounts at our discretion, including for inaccurate information, fraud, or breach of these Terms.</p>
        </Section>

        <Section n={2} title="The role of Collabr">
          <p>Collabr is a venue and payments facilitator. We are <strong>not</strong> a party to any agreement, collaboration or transaction between a Brand and a Creator (a &ldquo;Collab&rdquo;). We do not employ Creators, do not author campaign briefs, and do not guarantee the quality, legality, safety, or outcome of any Collab, content, Brand or Creator.</p>
          <p>Brands and Creators contract directly with each other. We provide tools (campaign listings, applications, messaging, escrow, dispute handling) to support those dealings but are not responsible for the acts or omissions of any user.</p>
        </Section>

        <Section n={3} title="Campaigns, applications and selection">
          <p>Brands may post campaigns describing deliverables, compensation (cash or barter), and requirements. Creators may apply with a pitch and, for paid campaigns, an expected rate. A Brand may shortlist, decline, or select applicants. Selection alone does not create a binding Collab or any payment obligation; a Collab becomes active only once the Brand funds escrow.</p>
          <p>We do not guarantee that any campaign will receive applications, that any Creator will be selected, or that any Brand will fund a Collab. Information shown on the Platform, including self-reported follower counts and metrics, is provided by users and is not verified by us.</p>
        </Section>

        <Section n={4} title="Payments, escrow and fees">
          <p>Payments are processed by our third-party payment provider (Stripe). By transacting on the Platform you also agree to the applicable Stripe terms. When a Brand funds a Collab, the agreed amount is authorised and held in escrow. Funds are released to the Creator after the Brand approves the work, or automatically after the applicable review window if the Brand does not act.</p>
          <p>Collabr charges a platform fee, deducted from the Creator&rsquo;s payout, as disclosed at the point of application and/or funding (currently up to 12%). Fees are non-refundable except as required by law or expressly stated. Creators are responsible for connecting a valid payout account; payouts cannot be made until they do so.</p>
          <p>Refunds of an authorised-but-not-released amount may be made to the Brand where a Collab is cancelled before work is delivered or where a funding authorisation expires. Once funds have been released to a Creator, they are generally non-refundable. You are responsible for your own taxes arising from your use of the Platform.</p>
        </Section>

        <Section n={5} title="Creator obligations">
          <p>As a Creator you agree to: deliver the agreed content on time and as briefed; ensure your content is original or properly licensed and does not infringe any third-party rights; comply with all applicable laws and advertising/disclosure rules (including clearly labelling sponsored content, e.g. #ad); not post false, misleading, defamatory, infringing or unlawful content; and not misrepresent your audience, reach or identity.</p>
        </Section>

        <Section n={6} title="Brand obligations">
          <p>As a Brand you agree to: provide lawful, accurate and non-deceptive briefs; fund escrow in good faith when you intend to engage a Creator; review submitted work within the stated windows; not request content that is unlawful, infringing, or that violates platform or advertising rules; and not use the Platform to harass, exploit or discriminate against Creators.</p>
        </Section>

        <Section n={7} title="Content and intellectual property">
          <p>Ownership and licensing of deliverables are governed by the agreement between the Brand and Creator for each Collab. Each user warrants that they hold all rights necessary to grant the licences they purport to grant. You grant Collabr a limited, royalty-free licence to host, display and use your profile information, campaign content and (where permitted) completed deliverables for the purpose of operating, securing and promoting the Platform.</p>
          <p>The Collabr name, logo, software and design are our property and may not be used without our prior written permission.</p>
        </Section>

        <Section n={8} title="No off-platform circumvention">
          <p>Brands and Creators who are introduced through Collabr agree not to circumvent the Platform by arranging or completing introduced Collabs, payments, or ongoing engagements off-platform in order to avoid fees. Circumvention is a material breach and may result in suspension, termination and liability for fees that would otherwise have been payable.</p>
        </Section>

        <Section n={9} title="Prohibited conduct">
          <p>You may not: use the Platform for any unlawful, fraudulent or harmful purpose; upload malware or attempt to disrupt or gain unauthorised access to the Platform or other accounts; scrape or harvest data; impersonate others; create fake accounts, reviews, engagement or applications; or infringe the rights of any person. We may remove content and suspend accounts that violate these Terms.</p>
        </Section>

        <Section n={10} title="Disputes between users">
          <p>If a dispute arises within a Collab, either party may raise it through the Platform during an eligible stage. Collabr may, at its discretion, review the submitted evidence and reach a resolution regarding the release, split or refund of escrowed funds. Our resolution of escrow allocation is final for the purpose of the held funds. This does not limit either party&rsquo;s separate legal rights against the other. Collabr is not liable for the underlying conduct of either party.</p>
        </Section>

        <Section n={11} title="Suspension and termination">
          <p>You may stop using the Platform at any time. We may suspend or terminate your access, with or without notice, for breach of these Terms, suspected fraud or unlawful activity, risk to other users or to us, or as required by law. Provisions that by their nature should survive termination (including payment, intellectual property, disclaimers, limitation of liability and indemnity) will survive.</p>
        </Section>

        <Section n={12} title="Disclaimers">
          <p>The Platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind, whether express or implied, including fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation. We do not warrant the conduct, identity, content, or solvency of any Brand or Creator, or that any Collab will be completed or be satisfactory. You use the Platform and engage with other users at your own risk.</p>
        </Section>

        <Section n={13} title="Limitation of liability">
          <p>To the maximum extent permitted by law, Collabr and its officers, employees and agents will not be liable for any indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue, data, or goodwill, arising out of or relating to your use of the Platform or any Collab. To the maximum extent permitted by law, our total aggregate liability for any claim relating to the Platform will not exceed the greater of (a) the total platform fees you paid to us in the three (3) months before the event giving rise to the claim, or (b) SGD 100.</p>
        </Section>

        <Section n={14} title="Indemnification">
          <p>You agree to indemnify and hold harmless Collabr and its officers, employees and agents from and against any claims, damages, liabilities, costs and expenses (including reasonable legal fees) arising out of or related to your use of the Platform, your content, your Collabs, your breach of these Terms, or your violation of any law or third-party right.</p>
        </Section>

        <Section n={15} title="Changes to these Terms">
          <p>We may update these Terms from time to time. If we make material changes, we will take reasonable steps to notify you (for example, by updating the date above or by notice on the Platform). Your continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section n={16} title="Governing law">
          <p>These Terms are governed by the laws of Singapore, without regard to conflict-of-laws principles. The courts of Singapore will have exclusive jurisdiction over any dispute arising out of or relating to these Terms or the Platform, subject to any non-waivable rights you may have under applicable law.</p>
        </Section>

        <Section n={17} title="Contact">
          <p>
            Questions about these Terms? Contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 530 }}>{SUPPORT_EMAIL}</a>.
          </p>
        </Section>

        <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)', marginTop: 36, lineHeight: 1.6 }}>
          These Terms also incorporate our Privacy practices and any policies referenced on the Platform. If any
          provision is found unenforceable, the remaining provisions will remain in full force.
        </p>
      </main>
    </div>
  )
}
