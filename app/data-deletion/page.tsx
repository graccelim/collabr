import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion | Collabr',
  description: 'How to delete your Collabr account and any data retrieved from connected TikTok, Instagram and YouTube accounts.',
}

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

export default function DataDeletionPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Data deletion request')}&body=${encodeURIComponent('Please delete my Collabr account and all associated data, including data from any connected social accounts.\n\nAccount email: \nName: ')}`
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
          Data Deletion
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-soft)', marginTop: 20 }}>
          You can delete your Collabr data at any time, including anything we retrieved from connected TikTok, Instagram or
          YouTube accounts. This page explains your options. For full detail on what we store and why, see our{' '}
          <Link href="/privacy" style={{ color: 'var(--accent)', fontWeight: 530 }}>Privacy Policy</Link>.
        </p>

        <Section n={1} title="Disconnect a social account">
          <p>To stop all further data collection from a platform and have its stored analytics removed, open <strong>Creator Studio &rarr; connected accounts</strong> and disconnect the account. You can also revoke Collabr&rsquo;s access directly from your TikTok, Instagram/Meta, or Google account settings.</p>
        </Section>

        <Section n={2} title="Delete your whole account">
          <p>To delete your Collabr account and all associated data, email us from the address on your account and we will permanently delete your account, profile, connected-account data and analytics history, subject to any records we are legally required to retain (for example, transaction records for tax purposes).</p>
          <p style={{ marginTop: 4 }}>
            <a href={mailto} className="btn-primary" style={{ display: 'inline-block', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Request data deletion
            </a>
          </p>
          <p>Or email <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 530 }}>{SUPPORT_EMAIL}</a> with the subject &ldquo;Data deletion request&rdquo;.</p>
        </Section>

        <Section n={3} title="What gets deleted">
          <p>Account and profile data, connected-account access tokens, all stored social metrics and analytics snapshots, campaign and application records you own, and messages, except information we must retain to comply with legal, tax or accounting obligations or to resolve disputes. We will confirm by email once your request is complete.</p>
        </Section>

        <Section n={4} title="How long it takes">
          <p>We action verified deletion requests within 30 days. Disconnecting a social account takes effect immediately.</p>
        </Section>

        <Section n={5} title="Requests from Meta / Instagram">
          <p>If you remove Collabr from your Instagram or Facebook settings, Meta sends us an automated data-deletion signal, which we honour the same way as a direct request. You can also use the options above at any time.</p>
        </Section>

        <Section n={6} title="Contact">
          <p>Questions about deletion? Email <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 530 }}>{SUPPORT_EMAIL}</a>.</p>
        </Section>
      </main>
    </div>
  )
}
