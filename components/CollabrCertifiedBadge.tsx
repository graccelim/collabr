import { ShieldCheck } from 'lucide-react'
import InfoTip from '@/components/InfoTip'
import { flags } from '@/lib/flags'
import { CERT_TOOLTIP } from '@/lib/certification/criteria'

/**
 * 🛡️ Collabr Certified — a maintained reliability badge earned from Collabr
 * behaviour. Facts-only, no score/ranking. Renders nothing unless the creator
 * is certified AND the flag is on, so non-certified creators are never shown
 * negatively (the badge is simply absent).
 *
 * The tooltip explains exactly how it's earned (transparency), reading the same
 * copy the rules engine exports so UI copy never drifts from the criteria.
 */
export default function CollabrCertifiedBadge({
  certified,
  size = 'md',
  showTip = true,
}: {
  certified: boolean
  size?: 'sm' | 'md'
  showTip?: boolean
}) {
  if (!certified || !flags.collabrCertified) return null
  const sm = size === 'sm'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sm ? 4 : 5,
        padding: sm ? '2px 8px' : '3px 10px',
        borderRadius: 999,
        background: 'var(--money-tint)',
        color: 'var(--money-deep)',
        border: '1px solid rgba(21,122,85,0.18)',
        fontSize: sm ? 11 : 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      <ShieldCheck size={sm ? 12 : 13} style={{ flexShrink: 0 }} />
      Collabr Certified
      {showTip && <InfoTip text={CERT_TOOLTIP} />}
    </span>
  )
}
