'use client'
import { useState } from 'react'
import Link from 'next/link'
import { plusJakarta, jetbrainsMono } from '@/lib/landing-fonts'
import { NAVY, NAVY_DEEP, ACCENT_ON_DARK, PAGE_BG } from './tokens'

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
  const isBrand = tab === 'brand'

  return (
    <div
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
      style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: 'var(--lp-font-body), system-ui, sans-serif', color: '#0B1023' }}
    >
      {/* Only the slim logo/login bar stays sticky - that's the part worth
          keeping reachable at any scroll depth. The tab switcher is a
          one-time "which audience am I" choice made once near the top of
          the page, not chrome someone needs while reading the FAQ, so it
          scrolls away with the hero instead of permanently eating ~150px of
          viewport on every screen size (mobile especially).

          `nav` is a direct child of the full-page wrapper below, not nested
          inside the (short) navy band that used to hold it plus the
          switcher - position:sticky only holds an element in place while
          its own parent is still on screen, so nesting nav inside that
          ~150px-tall parent made it scroll away the instant that small box
          passed the top of the viewport. Giving nav the full-height page as
          its containing block is what lets it stay pinned all the way down. */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: NAVY, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            collabr<span style={{ color: ACCENT_ON_DARK }}>.</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {isBrand ? (
              <>
                <Link href="/browse" className="hidden md:inline" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.62)' }}>Browse Creators</Link>
                <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.62)' }}>Log in</Link>
                <Link href="/signup" style={{ background: '#fff', color: NAVY, border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700 }}>Join free</Link>
              </>
            ) : (
              <>
                <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.62)' }}>Log in</Link>
                <Link href="/join" style={{ background: '#fff', color: NAVY, border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700 }}>Join Collabr</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Tab switcher - a sliding white pill behind whichever label is
          active, rather than two independently-colored buttons. Not
          sticky: it lives with the hero, not the persistent nav. Same navy
          background as nav so the two still read as one continuous band. */}
      <div style={{ background: NAVY }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 20px 24px' }}>
          <div role="tablist" aria-label="I am a" style={{
            position: 'relative', display: 'flex', width: 300, padding: 4, borderRadius: 999,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
          }}>
            <span aria-hidden style={{
              position: 'absolute', top: 4, bottom: 4, width: 'calc(50% - 4px)', borderRadius: 999,
              background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.28)',
              transition: 'left 220ms cubic-bezier(.4,0,.2,1)', left: isBrand ? 4 : '50%',
            }} />
            <button
              type="button" role="tab" aria-selected={isBrand} onClick={() => setTab('brand')}
              style={{
                position: 'relative', flex: 1, border: 0, background: 'transparent', borderRadius: 999,
                padding: '10px 0', fontSize: 14.5, fontWeight: 700, transition: 'color 180ms',
                color: isBrand ? NAVY : 'rgba(255,255,255,.55)',
              }}
            >
              I'm a Brand
            </button>
            <button
              type="button" role="tab" aria-selected={!isBrand} onClick={() => setTab('creator')}
              style={{
                position: 'relative', flex: 1, border: 0, background: 'transparent', borderRadius: 999,
                padding: '10px 0', fontSize: 14.5, fontWeight: 700, transition: 'color 180ms',
                color: !isBrand ? NAVY : 'rgba(255,255,255,.55)',
              }}
            >
              I'm a Creator
            </button>
          </div>
        </div>
      </div>

      {isBrand ? brandContent : creatorContent}

      {/* ── Footer ── */}
      <footer style={{
        background: NAVY_DEEP, padding: '40px 0',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px,4vw,32px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20,
        }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            collabr<span style={{ color: ACCENT_ON_DARK }}>.</span>
          </span>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>© 2026 collabr · Singapore</span>
            <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>Terms</Link>
            <Link href="/data-deletion" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>Data deletion</Link>
            <a href="mailto:joincollabr@gmail.com?subject=Collabr%20enquiry" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>Contact us</a>
            <Link href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>Log in</Link>
            <Link href={isBrand ? '/signup' : '/join'} style={{ fontSize: 13, color: ACCENT_ON_DARK, fontWeight: 600 }}>
              {isBrand ? 'Join free →' : 'Join Collabr →'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
