import { Scale, Clock, Paperclip, CheckCircle2 } from 'lucide-react'
import DisputeEvidenceForm from './DisputeEvidenceForm'

export interface DisputeEvidenceItem {
  author_type: 'brand' | 'creator'
  body: string | null
  attachment_urls: string[]
  created_at: string
}

const OUTCOME_LABEL: Record<string, string> = {
  pending: 'Under review',
  creator_wins: 'Resolved in the creator’s favour',
  brand_wins: 'Resolved in the brand’s favour',
  split: 'Resolved as a split',
  mutual: 'Mutually resolved',
}

function when(ts: string): string {
  try { return new Date(ts).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return ts }
}

/**
 * Surfaces an open or resolved dispute on the collab page — fixing the prior
 * "goes dark once disputed" gap. Shows who opened it, when, the current status,
 * a party-specific reassurance, the evidence thread, and (while open) a form for
 * either side to add evidence.
 */
export default function DisputeStatusCard({
  collabId, isBrand, raisedByType, reason, openedAt, outcome, resolvedAt, splitPercentage, evidence, isBarter = false,
}: {
  collabId: string
  isBrand: boolean
  raisedByType: 'brand' | 'creator'
  reason: string
  openedAt: string
  outcome: string
  resolvedAt: string | null
  splitPercentage?: number | null
  evidence: DisputeEvidenceItem[]
  isBarter?: boolean
}) {
  const resolved = Boolean(resolvedAt)
  const statusLabel = outcome === 'split' && splitPercentage != null
    ? `Split ${splitPercentage}% / ${100 - splitPercentage}%`
    : OUTCOME_LABEL[outcome] || outcome

  const authorLabel = (t: 'brand' | 'creator') =>
    (t === 'brand') === isBrand ? 'You' : t === 'brand' ? 'Brand' : 'Creator'

  return (
    <div className="card" style={{ padding: 20, border: `1px solid ${resolved ? 'var(--line)' : 'rgba(220,38,38,.25)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: resolved ? 'var(--money-tint)' : 'var(--danger-tint)', color: resolved ? 'var(--money-deep)' : 'var(--danger)' }}>
          {resolved ? <CheckCircle2 size={18} /> : <Scale size={18} />}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{resolved ? 'Dispute resolved' : 'Dispute open'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
            Opened by {raisedByType === 'brand' ? 'the brand' : 'the creator'} · {when(openedAt)}
          </div>
        </div>
      </div>
      {/* Own row, not squeezed into the header - the outcome text can be as
          long as "Resolved in the creator's favour" or a split percentage,
          and flexShrink:0 on a badge sharing a row with that text would
          otherwise crush the title/subtitle column on a narrow screen.
          Neutral, not green: a resolved dispute isn't a "win" for whoever's
          viewing (brand_wins / mutual would otherwise show the loser a
          success badge). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <span className={`badge ${resolved ? 'badge-neutral' : 'badge-warn'}`}>{statusLabel}</span>
      </div>

      {!resolved && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 12px' }}>
          {isBarter
            ? 'This collaboration is paused while the dispute is reviewed. Please submit any evidence that supports your case.'
            : isBrand
              ? 'Payment release has been paused while this dispute is reviewed. Please submit evidence supporting your claim.'
              : 'Your payment is currently on hold while this dispute is reviewed. Please submit any evidence that supports your case.'}
        </p>
      )}
      {resolved && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 12px' }}>
          A Collabr mediator reviewed both sides. Outcome: <strong>{statusLabel}</strong>.{isBarter ? '' : ' The protected payment has been settled accordingly.'}
        </p>
      )}

      {/* Original reason */}
      <div style={{ fontSize: 13, color: 'var(--ink)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint-solid)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Reason</span>
        <div style={{ marginTop: 4, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{reason}</div>
      </div>

      {/* Evidence thread */}
      {evidence.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint-solid)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Evidence</div>
          {evidence.map((ev, i) => (
            <div key={i} style={{ borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{authorLabel(ev.author_type)}</span>
                <Clock size={11} style={{ color: 'var(--ink-faint-solid)' }} />
                <span style={{ color: 'var(--ink-faint-solid)' }}>{when(ev.created_at)}</span>
              </div>
              {ev.body && <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '4px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ev.body}</p>}
              {ev.attachment_urls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {ev.attachment_urls.map((u, j) => (
                    <a key={j} href={u} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent-deep)', fontWeight: 600, background: 'var(--accent-tint)', padding: '3px 9px', borderRadius: 99 }}>
                      <Paperclip size={11} /> Attachment {j + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!resolved && <DisputeEvidenceForm collabId={collabId} />}
    </div>
  )
}
