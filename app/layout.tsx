import type { Metadata } from 'next'
import './globals.css'
import Toasts from '@/components/Toasts'

export const metadata: Metadata = {
  title: 'Collabr. Connecting creators and brands',
  description: 'A platform connecting content creators directly with brands. No agency needed.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toasts />
      </body>
    </html>
  )
}
