import { Info } from 'lucide-react'

/**
 * A tiny inline help marker. Shows its text as a native tooltip on hover/focus
 * (and is exposed to screen readers via aria-label). Used to demystify jargon
 * like "escrow", "barter" and "collab" right where the term appears.
 */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      tabIndex={0}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', color: 'var(--ink-faint-solid)', marginLeft: 5, verticalAlign: 'middle' }}
    >
      <Info size={13} />
    </span>
  )
}

// Canonical plain-language definitions, reused across the app.
export const TERMS = {
  escrow: 'Payment is securely held until campaign requirements are completed.',
  barter: 'Products or services exchanged instead of cash payment.',
  collab: 'A collaboration between a brand and creator.',
} as const
