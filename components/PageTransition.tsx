'use client'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

/**
 * Wraps dashboard content in a subtle rise-in keyed on the route, so every
 * in-app navigation gets the design's calm "screen-in" micro-interaction.
 *
 * On the FIRST load (a hard navigation, e.g. returning from an OAuth redirect)
 * we skip the animation: otherwise framer renders the `initial` (opacity 0)
 * state into the SSR HTML, so the page paints blank-white for a beat before
 * hydration fades it in. `initial={false}` makes the first paint show the
 * content immediately; later route changes still animate.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const firstLoad = useRef(true)
  useEffect(() => { firstLoad.current = false }, [])
  return (
    <motion.div
      key={pathname}
      initial={firstLoad.current ? false : { opacity: 0, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
