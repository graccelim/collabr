import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'

// Scoped to the concierge landing page only (LandingTabs applies the
// variables) - the rest of the app keeps Geist/Bricolage from app/layout.tsx.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'], weight: ['400', '500', '600', '700', '800'],
  display: 'swap', variable: '--lp-font-body',
})

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'], weight: ['400', '500'],
  display: 'swap', variable: '--lp-font-mono',
})
