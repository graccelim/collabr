// Collabr Certified — the rules engine (pure, deterministic, unit-tested).
//
// This is the single source of truth for *whether* a creator is certified. The
// heavy aggregation (the windowed facts) is done in SQL by the
// `collabr_certification_facts` function; this module only decides earn / keep /
// suspend from those facts. No scores, no percentiles, no creator-vs-creator
// comparison — every check is the creator's own facts against fixed thresholds.
//
// Maintained & suspendable with HYSTERESIS so the badge is hard to lose:
//   • not certified  → granted only when ALL strict "earn" thresholds are met.
//   • certified      → kept unless a fact falls CLEARLY under a looser "suspend"
//                      band. One bad review or one slow reply can't drop it.
// Evaluated over a trailing window (90 days OR last 20 completed collabs).

export const CERT_THRESHOLDS = {
  /** Strict bar to EARN (or regain) the badge. */
  earn: {
    completed: 5, // ≥5 completed collaborations
    reviews: 5, // ≥5 reviews
    rating: 4.6, // average rating ≥4.6
    completionRate: 0.95, // ≥95%
    disputeRate: 0.02, // ≤2%
    unresolvedDisputes: 0, // none
    responseHours: 48, // median response ≤48h
  },
  /** Looser bar — only a clear breach SUSPENDS an already-certified creator. */
  suspend: {
    rating: 4.4, // suspend if <4.4
    completionRate: 0.9, // suspend if <90%
    disputeRate: 0.04, // suspend if >4%
    unresolvedDisputes: 1, // suspend if ≥1
    responseHours: 72, // suspend if >72h
  },
} as const;

export type CertStatus = 'none' | 'certified' | 'suspended';

export interface CertFacts {
  completed: number;
  reviews: number;
  ratingAvg: number; // 0 when no reviews
  completionRate: number | null; // 0..1, null when no completed+cancelled
  disputeRate: number | null; // 0..1, null when no completed
  unresolvedDisputes: number;
  responseMedianHours: number | null; // null = insufficient invite data (not held against them)
}

export interface CertResult {
  certified: boolean;
  status: CertStatus;
  /** Per-criterion met/not-met at the EARN bar — booleans only, for the creator's own explainability. */
  criteria: {
    completed: boolean;
    reviews: boolean;
    rating: boolean;
    completion: boolean;
    disputes: boolean;
    noUnresolvedDisputes: boolean;
    responsive: boolean;
  };
  /** Plain-language reason when (and only when) status === 'suspended'. */
  suspendedReason: string | null;
}

/** Does the creator meet every strict earn threshold? */
function meetsEarnBar(f: CertFacts): CertResult['criteria'] {
  const e = CERT_THRESHOLDS.earn;
  return {
    completed: f.completed >= e.completed,
    reviews: f.reviews >= e.reviews,
    rating: f.ratingAvg >= e.rating,
    completion: f.completionRate != null && f.completionRate >= e.completionRate,
    disputes: (f.disputeRate ?? 0) <= e.disputeRate,
    noUnresolvedDisputes: f.unresolvedDisputes <= e.unresolvedDisputes,
    // No invite history → can't be held against them.
    responsive: f.responseMedianHours == null || f.responseMedianHours <= e.responseHours,
  };
}

/** Clear breaches of the looser suspend band (the only things that drop a held badge). */
function suspendBreaches(f: CertFacts): string[] {
  const s = CERT_THRESHOLDS.suspend;
  const out: string[] = [];
  // An open dispute is current state — the one immediate-suspend trigger.
  if (f.unresolvedDisputes >= s.unresolvedDisputes) out.push('an unresolved dispute is open');
  // Guard rating with a real sample so a thin window can't suspend on noise.
  if (f.reviews >= CERT_THRESHOLDS.earn.reviews && f.ratingAvg < s.rating)
    out.push('average rating fell below 4.4');
  if (f.completionRate != null && f.completionRate < s.completionRate)
    out.push('completion rate fell below 90%');
  if (f.disputeRate != null && f.disputeRate > s.disputeRate)
    out.push('dispute rate rose above 4%');
  if (f.responseMedianHours != null && f.responseMedianHours > s.responseHours)
    out.push('median response time rose above 72 hours');
  return out;
}

/**
 * Decide certification from windowed facts + the creator's CURRENT status
 * (needed for hysteresis). Pure — same inputs always give the same result.
 */
export function evaluateCertification(facts: CertFacts, current: CertStatus): CertResult {
  const criteria = meetsEarnBar(facts);

  if (current === 'certified') {
    // Keep the badge unless clearly under the suspend band.
    const breaches = suspendBreaches(facts);
    if (breaches.length === 0) {
      return { certified: true, status: 'certified', criteria, suspendedReason: null };
    }
    return { certified: false, status: 'suspended', criteria, suspendedReason: breaches[0] };
  }

  // Not currently certified (none | suspended): grant only on the full strict bar.
  const meetsAll = Object.values(criteria).every(Boolean);
  if (meetsAll) {
    return { certified: true, status: 'certified', criteria, suspendedReason: null };
  }
  return {
    certified: false,
    status: current === 'suspended' ? 'suspended' : 'none',
    criteria,
    suspendedReason: null,
  };
}

/** Brand/creator-facing tooltip copy (kept here so UI copy and the rules never drift). */
export const CERT_TOOLTIP =
  'Collabr Certified\n' +
  'Earned by consistently demonstrating reliability on Collabr.\n' +
  'Typical requirements:\n' +
  '  ✓ Completed collaborations\n' +
  '  ✓ Strong ratings\n' +
  '  ✓ High completion rate\n' +
  '  ✓ Low dispute rate\n' +
  '  ✓ Responsive communication\n' +
  'Thresholds are set by Collabr and reviewed over time.';
