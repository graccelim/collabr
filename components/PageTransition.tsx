'use client'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

/**
 * Wraps dashboard content in a subtle rise-in keyed on the route, so every
 * navigation gets the design's calm "screen-in" micro-interaction. Respects
 * reduced-motion via Framer's built-in handling.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
