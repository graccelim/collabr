import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Collabr',
  description: 'How Collabr collects, uses, stores and protects your data, including data from connected TikTok, Instagram and YouTube accounts.',
}

const LAST_UPDATED = '28 June 2026'
const SUPPORT_EMAIL = 'joincollabr@gmail.com'

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

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
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
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint-solid)', marginTop: 8 }}>
          Last updated: {LAST_UPDATED}
        </p>

        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-soft)', marginTop: 20 }}>
          This Privacy Policy explains how Collabr (the &ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a
          creator&ndash;brand marketplace operated from Singapore, collects, uses, stores, shares and protects your
          information, including information we access from social accounts you choose to connect (TikTok, Instagram and
          YouTube). It should be read alongside our{' '}
          <Link href="/terms" style={{ color: 'var(--accent)', fontWeight: 530 }}>Terms &amp; Conditions</Link>.
          By using Collabr you agree to the practices described here.
        </p>

        <Section n={1} title="Information we collect">
          <p>We collect:</p>
          <p><strong>Account and profile data</strong> you provide: name, email, password (stored hashed by our authentication provider), role (brand or creator), profile details, and any rates, niches, or links you add.</p>
          <p><strong>Campaign and collaboration data</strong>: campaigns, applications, messages, deliverables and dispute information you create or exchange on the Platform.</p>
          <p><strong>Payment data</strong>: handled by our payment processor (Stripe). We do not store full card numbers; we receive limited details such as payment status and payout-account status.</p>
          <p><strong>Connected social account data</strong> (only if you connect an account): see Section 2.</p>
          <p><strong>Usage and device data</strong>: basic logs, cookies needed for sign-in and security, and analytics about how the Platform is used.</p>
        </Section>

        <Section n={2} title="Data from connected social accounts (TikTok, Instagram, YouTube)">
          <p>Connecting a social account is <strong>optional</strong> and done through each platform&rsquo;s official OAuth flow. You can disconnect at any time. When you connect an account, you authorise us to access, via the platform&rsquo;s API, the data needed to produce your own performance analytics:</p>
          <p><strong>TikTok</strong> (scopes <code>user.info.basic</code>, <code>video.list</code>): your basic profile and your video list with per-video metrics (view, like, comment and share counts and timestamps).</p>
          <p><strong>Instagram</strong> (scopes <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_show_list</code>, <code>business_management</code>): your professional account profile and media insights for your own content.</p>
          <p><strong>YouTube</strong> (scope <code>yt-analytics.readonly</code> and the YouTube Data API): your channel and video performance metrics.</p>
          <p>We use this data <strong>only</strong> to compute and display analytics back to you (the account owner) and, where you are a connected creator, to show verified performance to brands you choose to engage. We <strong>do not</strong> post, comment, message or take any action on your social accounts, and we do not sell this data. We retain historical snapshots of these metrics so your performance history persists over time, even after the native app stops showing older data; you can request deletion at any time (Section 8).</p>
        </Section>

        <Section n={3} title="How we use your information">
          <p>To operate the marketplace (accounts, campaigns, applications, messaging, payments and payouts); to compute your analytics and reports; to provide content suggestions; to keep the Platform secure and prevent fraud and abuse; to provide support; to send service and transactional emails; and to comply with legal obligations.</p>
        </Section>

        <Section n={4} title="Automated processing and AI">
          <p>We use a third-party AI provider (Anthropic) to help categorise your content (for example, labelling a post&rsquo;s format or topic) and to generate optional content suggestions and plain-language summaries of your own analytics. The numeric analytics themselves are computed by our own deterministic code, not by AI. Information sent to the AI provider is limited to what is needed for the task (such as post titles, captions and metadata). Our AI provider does not use this data to train its models. AI suggestions are informational only.</p>
        </Section>

        <Section n={5} title="How we share information">
          <p>We do not sell your personal information. We share it only with:</p>
          <p><strong>Service providers (sub-processors)</strong> that run the Platform under contract: <strong>Supabase</strong> (database, authentication and hosting), <strong>Stripe</strong> (payments and payouts), <strong>Anthropic</strong> (AI processing as described in Section 4), and <strong>Resend</strong> (transactional email).</p>
          <p><strong>Social platforms</strong> (TikTok, Meta, Google) when you connect an account, to authenticate and retrieve your data via their APIs.</p>
          <p><strong>Other users</strong>, where you choose to share it (for example, a creator&rsquo;s verified metrics shown to a brand you engage, or messages you send).</p>
          <p><strong>Legal and safety</strong>: where required by law, to enforce our Terms, or to protect rights, safety and the integrity of the Platform; and in connection with a merger, acquisition or asset sale.</p>
        </Section>

        <Section n={6} title="Platform policy compliance">
          <p>Our use of information from social platforms complies with their developer terms and policies, including the <strong>TikTok Developer Terms of Service</strong>, the <strong>Meta Platform Terms and Developer Policies</strong>, and the <strong>Google API Services User Data Policy</strong>.</p>
          <p><strong>Google Limited Use.</strong> Collabr&rsquo;s use and transfer of information received from Google APIs to any other app will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 530 }}>Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google user data for advertising, do not sell it, and do not allow humans to read it except as necessary for security, to comply with law, or with your explicit consent.</p>
        </Section>

        <Section n={7} title="Data retention">
          <p>We keep account and marketplace data for as long as your account is active and as needed to provide the Platform, resolve disputes, and meet legal, tax and accounting obligations. Connected-account analytics snapshots are retained to provide your performance history until you disconnect the account or request deletion. When data is no longer needed, we delete or anonymise it.</p>
        </Section>

        <Section n={8} title="Your rights and choices">
          <p>Depending on your location, you may have rights to access, correct, export, or delete your personal data, and to object to or restrict certain processing. You can:</p>
          <p>&bull; <strong>Disconnect a social account</strong> at any time from your Creator Studio settings, which stops further data collection from that platform.</p>
          <p>&bull; <strong>Request deletion of your data</strong> via our{' '}
            <Link href="/data-deletion" style={{ color: 'var(--accent)', fontWeight: 530 }}>Data Deletion</Link> page or by emailing us.</p>
          <p>&bull; <strong>Access, correct or export</strong> your data, or withdraw consent, by emailing{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 530 }}>{SUPPORT_EMAIL}</a>.</p>
          <p>We will respond within the timeframe required by applicable law. You may also revoke Collabr&rsquo;s access directly from your TikTok, Instagram/Meta or Google account settings.</p>
        </Section>

        <Section n={9} title="Data deletion">
          <p>To delete your account and associated data, including any data retrieved from connected social accounts, follow the steps on our{' '}
            <Link href="/data-deletion" style={{ color: 'var(--accent)', fontWeight: 530 }}>Data Deletion</Link> page. We honour deletion requests received directly and via the platforms&rsquo; data-deletion mechanisms.</p>
        </Section>

        <Section n={10} title="Security">
          <p>We use technical and organisational measures to protect your information, including encryption in transit, access controls, and storage of access tokens in a restricted manner. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.</p>
        </Section>

        <Section n={11} title="International transfers">
          <p>We operate from Singapore and use service providers that may process data in other countries. Where data is transferred across borders, we rely on appropriate safeguards as required by applicable law.</p>
        </Section>

        <Section n={12} title="Children">
          <p>The Platform is intended for users aged 18 and over. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will delete it.</p>
        </Section>

        <Section n={13} title="Changes to this policy">
          <p>We may update this Privacy Policy from time to time. If we make material changes, we will take reasonable steps to notify you, for example by updating the date above or by notice on the Platform. Your continued use after changes take effect constitutes acceptance.</p>
        </Section>

        <Section n={14} title="Contact">
          <p>
            Questions or requests about your privacy? Contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 530 }}>{SUPPORT_EMAIL}</a>.
          </p>
        </Section>
      </main>
    </div>
  )
}
