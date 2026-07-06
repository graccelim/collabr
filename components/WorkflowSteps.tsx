'use client'
import { LazyMotion, domAnimation, m } from 'framer-motion'

const EASE = [0.2, 0.7, 0.2, 1] as const

/**
 * Animated workflow column for the landing "How it works" cards. Steps reveal
 * in sequence on scroll and the connector line between each draws downward, so
 * the four-stage lifecycle (discover → secure → review → paid) visibly
 * completes. Connectors use `calc(100% + gap)` so they always meet the next dot
 * regardless of copy length, which keeps it solid on mobile too.
 */
export default function WorkflowSteps({
  steps, dotBg, dotInk, lineColor,
}: {
  steps: readonly (readonly [string, string])[]
  dotBg: string
  dotInk: string
  lineColor: string
}) {
  return (
    <LazyMotion features={domAnimation}>
    <m.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      variants={{ show: { transition: { staggerChildren: 0.14 } } }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {steps.map(([title, desc], i) => (
        <m.div
          key={title}
          className="workflow-step"
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
          }}
          style={{ display: 'flex', gap: 13, position: 'relative' }}
        >
          {i < steps.length - 1 && (
            <m.span
              aria-hidden
              variants={{
                hidden: { scaleY: 0 },
                show: { scaleY: 1, transition: { duration: 0.45, ease: EASE, delay: 0.08 } },
              }}
              style={{
                position: 'absolute', left: 12, top: 13, width: 2,
                height: 'calc(100% + 16px)', transformOrigin: 'top',
                background: lineColor, borderRadius: 2, zIndex: 0,
              }}
            />
          )}
          <div
            className="workflow-dot"
            style={{
              width: 26, height: 26, borderRadius: '50%', background: dotBg, color: dotInk,
              display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: 12.5, flexShrink: 0, position: 'relative', zIndex: 1,
            }}
          >
            {i + 1}
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="workflow-title" style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
          </div>
        </m.div>
      ))}
    </m.div>
    </LazyMotion>
  )
}
