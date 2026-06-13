'use client'
import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'

const EASE = [0.2, 0.7, 0.2, 1] as const

/**
 * Scroll-reveal wrapper (landing page). Fades + rises its content into view
 * once. Respects reduced-motion via Framer. Keeps the existing design — just
 * animates it in. `stagger` cascades direct children for grids/lists.
 */
export function Reveal({
  children, y = 18, delay = 0, className, style, stagger = false,
}: {
  children: ReactNode; y?: number; delay?: number
  className?: string; style?: CSSProperties; stagger?: boolean
}) {
  if (stagger) {
    return (
      <motion.div
        className={className}
        style={style}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}
      >
        {children}
      </motion.div>
    )
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/** A child of a `stagger` Reveal. */
export function RevealItem({ children, y = 16, className, style }: {
  children: ReactNode; y?: number; className?: string; style?: CSSProperties
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
    >
      {children}
    </motion.div>
  )
}
