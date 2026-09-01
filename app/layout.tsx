import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import Toasts from '@/components/Toasts'

// Self-hosted fonts (no render-blocking Google Fonts @import, no third-party
// request, zero layout shift via size-adjusted fallbacks). Geist comes from
// Vercel's official package; the rest via next/font.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--nf-bricolage' })
const instrument = Instrument_Serif({
  subsets: ['latin'], weight: '400', style: ['normal', 'italic'],
  display: 'swap', variable: '--nf-instrument',
})

// Reuse the canonical app URL (LAUNCH.md mandates the www host) so OG/canonical
// URLs match production exactly; NEXT_PUBLIC_SITE_URL remains an override.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || 'https://www.joincollabr.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Collabr — Brand–creator collaborations you can trust',
    template: '%s · Collabr',
  },
  description:
    'Collabr connects brands and creators with protected payments, structured approvals, and real reputation. Funds stay secured until content is approved.',
  keywords: [
    'creator marketplace', 'influencer marketing', 'brand collaborations',
    'UGC creators', 'protected payments', 'Singapore creators',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Collabr',
    title: 'Collabr — Brand–creator collaborations you can trust',
    description:
      'Protected payments, structured approvals, and real reputation for brands and creators.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Collabr — Brand–creator collaborations you can trust',
    description:
      'Protected payments, structured approvals, and real reputation for brands and creators.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#F6F7F9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${bricolage.variable} ${instrument.variable}`}
    >
      <body>
        {children}
        <Toasts />
      </body>
    </html>
  )
}
