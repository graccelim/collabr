// Phase 8: display-only derivation of the collaboration workflow.
// Pure functions - no business logic lives here; this mirrors the states the
// server enforces so every screen can explain where the collab is, what
// happens next, and who must act.

export type WorkflowActor = 'brand' | 'creator' | 'platform' | 'none'

export interface TimelineStep {
  key: string
  label: string
  state: 'done' | 'current' | 'upcoming'
}

export interface WorkflowView {
  steps: TimelineStep[]
  /** What just happened, in plain language. */
  happened: string
  /** What happens next, including automatic outcomes. */
  next: string
  /** Who must act next. */
  actor: WorkflowActor
  /** Deadline driving the next automatic action, if any. */
  deadline: string | null
  /** True when the collab is in a terminal or frozen state. */
  frozen: boolean
}

// [key, paid label, barter label]. Barter has no escrow/payment, so its steps
// read as a plain collaboration timeline.
const STEP_LABELS = [
  ['applied', 'Applied', 'Applied'],
  ['selected', 'Selected', 'Confirmed'],
  ['funded', 'Payment secured', 'Collaboration active'],
  ['draft_submitted', 'Draft submitted', 'Draft submitted'],
  ['revision', 'Revision requested', 'Revision requested'],
  ['draft_approved', 'Draft approved', 'Draft approved'],
  ['live_submitted', 'Live submitted', 'Live submitted'],
  ['payment_released', 'Payment released', 'Completed'],
  ['completed', 'Completed', 'Completed'],
] as const

function buildSteps(
  reachedKey: string,
  currentKey: string | null,
  includeRevision: boolean,
  isBarter = false,
): TimelineStep[] {
  const keys = STEP_LABELS.filter(([k]) => includeRevision || k !== 'revision')
  const reachedIdx = keys.findIndex(([k]) => k === reachedKey)
  return keys.map(([key, paidLabel, barterLabel], i) => ({
    key,
    label: isBarter ? barterLabel : paidLabel,
    state: key === currentKey ? 'current' : i <= reachedIdx ? 'done' : 'upcoming',
  }))
}

export function deriveWorkflow(opts: {
  status: string
  paymentStatus: string
  isBrand: boolean
  counterpartName: string
  revisionCount?: number
  draftAutoApproveAt?: string | null
  liveAutoReleaseAt?: string | null
  isBarter?: boolean
}): WorkflowView {
  const {
    status, paymentStatus, isBrand, counterpartName,
    revisionCount = 0, draftAutoApproveAt, liveAutoReleaseAt, isBarter = false,
  } = opts
  const paid = ['paid', 'manual_exception'].includes(paymentStatus)
  const funded = !['unfunded', 'authorizing'].includes(paymentStatus)
  const revisionsLeft = Math.max(0, 2 - revisionCount)
  const includeRevision = status === 'in_revision' || revisionCount > 0
  const first = counterpartName.split(' ')[0]

  switch (status) {
    case 'briefed':
      if (!funded) {
        return {
          steps: buildSteps('selected', 'funded', includeRevision, isBarter),
          happened: 'The creator was selected for this campaign.',
          next: isBrand
            ? 'Secure the agreed amount with collabr. The money stays protected, work begins only after Stripe verifies the authorization.'
            : `${first} must secure the payment before you start. Your payment is reserved with collabr before any work begins.`,
          actor: 'brand',
          deadline: null,
          frozen: false,
        }
      }
      return {
        steps: buildSteps('funded', 'draft_submitted', includeRevision, isBarter),
        happened: isBarter
          ? 'The barter collaboration is confirmed and active.'
          : 'The payment is secured, the money is held safely by collabr.',
        next: isBrand
          ? `${first} is working on the draft. You'll review it before anything goes live.`
          : isBarter
            ? 'Submit your draft for review to get the collaboration started.'
            : 'Submit your draft for review. Your payment is protected and guaranteed once requirements are met.',
        actor: 'creator',
        deadline: null,
        frozen: false,
      }

    case 'draft_submitted':
      return {
        steps: buildSteps('draft_submitted', 'draft_approved', includeRevision, isBarter),
        happened: 'The draft has been submitted for review.',
        next: isBrand
          ? 'Review the draft within 48 hours. If no action is taken, it approves automatically.'
          : 'The brand has 48 hours to review. If no action is taken, the draft will automatically approve.',
        actor: 'brand',
        deadline: draftAutoApproveAt || null,
        frozen: false,
      }

    case 'in_revision':
      return {
        steps: buildSteps('draft_submitted', 'revision', true, isBarter),
        happened: 'A revision was requested with feedback.',
        next: isBrand
          ? `${first} is revising the draft. ${revisionsLeft} revision${revisionsLeft === 1 ? '' : 's'} remaining on this collab.`
          : `Submit a new draft addressing the feedback. ${revisionsLeft} revision${revisionsLeft === 1 ? '' : 's'} remaining.`,
        actor: 'creator',
        deadline: null,
        frozen: false,
      }

    case 'draft_approved':
      return {
        steps: buildSteps('draft_approved', 'live_submitted', includeRevision, isBarter),
        happened: 'The draft was approved.',
        next: isBrand
          ? `${first} will post the content live and submit the link.`
          : isBarter
            ? 'Post your content publicly, then submit the live link. The brand confirms to complete the collaboration.'
            : 'Post your content publicly, then submit the live link. Payment releases after the brand confirms.',
        actor: 'creator',
        deadline: null,
        frozen: false,
      }

    case 'live_submitted':
      return {
        steps: buildSteps('live_submitted', 'payment_released', includeRevision, isBarter),
        happened: 'The content is live and the link has been submitted.',
        next: isBrand
          ? (isBarter
              ? 'Verify the post and confirm within 72 hours. It auto-completes if no action is taken.'
              : 'Verify the post and release payment within 72 hours. Payment will auto-release if no action is taken.')
          : isBarter
            ? 'The brand has 72 hours to confirm. It auto-completes if no action is taken.'
            : 'The brand has 72 hours to confirm. Payment will auto-release if no action is taken, you are marked paid once the transfer succeeds.',
        actor: 'brand',
        deadline: liveAutoReleaseAt || null,
        frozen: false,
      }

    case 'live_confirmed':
      return {
        steps: buildSteps('live_submitted', 'payment_released', includeRevision, isBarter),
        happened: 'The live post was confirmed.',
        next: isBarter
          ? 'Wrapping up the collaboration.'
          : 'collabr is settling payment through Stripe. The collab completes once capture and creator transfer succeed.',
        actor: 'platform',
        deadline: null,
        frozen: false,
      }

    case 'completed':
      return {
        steps: buildSteps(paid ? 'completed' : 'live_submitted', null, includeRevision, isBarter),
        happened: isBarter
          ? 'The barter collaboration is complete.'
          : paid
            ? 'Payment was released and the collab is complete.'
            : 'The collab is complete.',
        next: 'Leave a review to build trust for future collabs.',
        actor: 'none',
        deadline: null,
        frozen: true,
      }

    case 'disputed':
      return {
        steps: buildSteps(funded ? 'funded' : 'selected', null, includeRevision, isBarter),
        happened: isBarter ? 'A dispute was raised. The collaboration is paused.' : 'A dispute was raised. The protected payment is frozen.',
        next: isBarter
          ? 'A collabr mediator reviews both sides within 3 business days.'
          : 'A collabr mediator reviews both sides within 3 business days. No money moves until the dispute is resolved.',
        actor: 'platform',
        deadline: null,
        frozen: true,
      }

    case 'cancelled':
      return {
        steps: buildSteps('selected', null, includeRevision, isBarter),
        happened: 'This collab was cancelled.',
        next: isBarter
          ? 'This collaboration has ended.'
          : ['refunded', 'cancelled'].includes(paymentStatus)
            ? 'Any protected funds have been returned to the brand.'
            : 'Any protected funds are being returned to the brand.',
        actor: 'none',
        deadline: null,
        frozen: true,
      }

    default:
      return {
        steps: buildSteps('selected', null, includeRevision, isBarter),
        happened: 'This collab is in progress.',
        next: 'Check back soon.',
        actor: 'none',
        deadline: null,
        frozen: false,
      }
  }
}

/** "Action needed" / "Waiting on …" label for list rows and headers. */
export function actorLabel(view: Pick<WorkflowView, 'actor' | 'frozen'>, isBrand: boolean, counterpartName: string): {
  label: string
  yourTurn: boolean
} {
  if (view.actor === 'none') return { label: '', yourTurn: false }
  if (view.actor === 'platform') return { label: 'collabr is processing', yourTurn: false }
  const yourTurn = (view.actor === 'brand') === isBrand
  return yourTurn
    ? { label: 'Action needed', yourTurn: true }
    : { label: `Waiting on ${counterpartName.split(' ')[0]}`, yourTurn: false }
}

/**
 * 5-step escrow scale for the slim list progress track
 * (Funded → In progress → Draft approved → Live → Released).
 */
export function escrowStep(status: string, paymentStatus: string): number {
  const funded = !['unfunded', 'authorizing'].includes(paymentStatus)
  const paid = ['paid', 'manual_exception'].includes(paymentStatus)
  switch (status) {
    case 'briefed': return funded ? 1 : 0
    case 'draft_submitted':
    case 'in_revision': return 2
    case 'draft_approved': return 3
    case 'live_submitted':
    case 'live_confirmed': return 4
    case 'completed': return paid ? 5 : 4
    case 'disputed': return 2
    default: return 0
  }
}

/** Short absolute deadline like "Thu 12 Jun, 4:30 pm". */
export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  })
}
