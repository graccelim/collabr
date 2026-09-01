'use client'
import { LazyMotion, domAnimation, m } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'

const EASE = [0.2, 0.7, 0.2, 1] as const

/**
 * Scroll-reveal wrapper (landing page). Fades + rises its content into view
 * once. Respects reduced-motion via Framer. Keeps the existing design - just
 * animates it in. `stagger` cascades direct children for grids/lists.
 * Uses LazyMotion + m (domAnimation subset) so the landing bundle carries
 * ~2/3 less framer-motion than the full `motion` import.
 */
export function Reveal({
  children, y = 18, x = 0, scale = 1, delay = 0, duration = 0.5,
  immediate = false, className, style, stagger = false,
}: {
  children: ReactNode; y?: number; x?: number; scale?: number; delay?: number; duration?: number
  /** Animate on mount (above-the-fold heroes) instead of on scroll-into-view. */
  immediate?: boolean
  className?: string; style?: CSSProperties; stagger?: boolean
}) {
  // whileInView for below-the-fold; animate for immediate (on-load) entrances.
  const trigger = immediate
    ? { animate: 'show' as const }
    : { whileInView: 'show' as const, viewport: { once: true, amount: 0.2 } }

  if (stagger) {
    return (
      <LazyMotion features={domAnimation}>
        <m.div
          className={className} style={style}
          initial="hidden" {...trigger}
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}
        >
          {children}
        </m.div>
      </LazyMotion>
    )
  }
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={className} style={style}
        initial="hidden" {...trigger}
        variants={{
          hidden: { opacity: 0, y, x, scale },
          show: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration, ease: EASE, delay } },
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}

/** A child of a `stagger` Reveal. */
export function RevealItem({ children, y = 16, className, style }: {
  children: ReactNode; y?: number; className?: string; style?: CSSProperties
}) {
  return (
    <m.div
      className={className}
      style={style}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
    >
      {children}
    </m.div>
  )
}
