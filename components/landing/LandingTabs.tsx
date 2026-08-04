'use client'
import { useState } from 'react'
import Link from 'next/link'

type Tab = 'brand' | 'creator'

/**
 * The shared shell (nav, tab switcher, footer) around the two landing
 * bodies. Brand content is passed in already server-rendered (it needs the
 * real creator-preview data fetched in ConciergeLanding.tsx); creator
 * content is static and rendered directly. Switching tabs is pure client
 * state - no navigation, no data refetch, both bodies were already rendered
 * server-side and just get shown/hidden.
 */
export default function LandingTabs({
  brandContent, creatorContent,
}: {
  brandContent: React.ReactNode
  creatorContent: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('brand')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', fontFamily: 'var(--font-body)' }}>
      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px,5vw,40px)', height: 64, background: 'rgba(253,250,249,.85)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.04em', color: 'var(--ink)' }}>
          collabr<span style={{ color: 'var(--creator)' }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {tab === 'brand' ? (
            <>
              <Link href="/browse" className="hidden md:inline" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>Browse Creators</Link>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>Log in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Join free</Link>
            </>
          ) : (
            <>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>Log in</Link>
              <Link href="/join" className="btn btn-primary btn-sm">Join Collabr</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Tab switcher - the one audience-selection moment on the page ── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 20px 0' }}>
        <div role="tablist" aria-label="I am a" style={{
          display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 999, padding: 4, gap: 2,
        }}>
          <button
            type="button" role="tab" aria-selected={tab === 'brand'} onClick={() => setTab('brand')}
            style={{
              padding: '9px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600, transition: 'all .15s ease',
              background: tab === 'brand' ? 'var(--ink)' : 'transparent',
              color: tab === 'brand' ? 'var(--brand-ink)' : 'var(--ink-soft)',
            }}
          >
            I'm a Brand
          </button>
          <button
            type="button" role="tab" aria-selected={tab === 'creator'} onClick={() => setTab('creator')}
            style={{
              padding: '9px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 600, transition: 'all .15s ease',
              background: tab === 'creator' ? 'var(--ink)' : 'transparent',
              color: tab === 'creator' ? 'var(--brand-ink)' : 'var(--ink-soft)',
            }}
          >
            I'm a Creator
          </button>
        </div>
      </div>

      {tab === 'brand' ? brandContent : creatorContent}

      {/* ── Footer ── */}
      <footer style={{
        background: 'var(--brand)', borderTop: '1px solid rgba(255,255,255,.08)', padding: '22px clamp(20px,5vw,40px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em', color: '#fff' }}>
          collabr<span style={{ color: 'var(--accent-on-dark)' }}>.</span>
        </span>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.35)' }}>© 2026 collabr. · Singapore</span>
          <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Privacy</Link>
          <Link href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Terms</Link>
          <Link href="/data-deletion" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Data deletion</Link>
          <a href="mailto:joincollabr@gmail.com?subject=Collabr%20enquiry" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Contact us</a>
          <Link href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>Log in</Link>
          <Link href={tab === 'brand' ? '/signup' : '/join'} style={{ fontSize: 13, color: 'var(--accent-on-dark)', fontWeight: 600 }}>
            {tab === 'brand' ? 'Join free →' : 'Join Collabr →'}
          </Link>
        </div>
      </footer>
    </div>
  )
}
