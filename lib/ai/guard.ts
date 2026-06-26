// AI output guard. Every AI string passes through this. It blocks the language
// the product forbids: cross-creator comparison, rankings, percentiles, scores,
// and performance guarantees. Coach, don't judge — self-referential only.

const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /\btop\s*\d+\s*%/i, why: 'percentile/ranking' },
  { re: /\bpercentile\b/i, why: 'percentile' },
  { re: /\brank(?:ed|ing|s)?\b/i, why: 'ranking' },
  { re: /\bbetter than\b/i, why: 'comparison' },
  { re: /\b(?:above|below)\s+average\b/i, why: 'comparison to average' },
  { re: /\bplatform average\b/i, why: 'platform average' },
  { re: /\b(?:vs\.?|versus|compared to)\s+other\s+creators?\b/i, why: 'cross-creator comparison' },
  { re: /\bother creators?\b/i, why: 'cross-creator reference' },
  { re: /\bguarantee(?:d|s)?\b/i, why: 'performance guarantee' },
  { re: /\b\d{1,3}\s*\/\s*100\b/, why: 'score out of 100' },
]

export interface GuardResult { ok: boolean; violations: string[] }

export function lintAiText(text: string): GuardResult {
  const violations: string[] = []
  for (const f of FORBIDDEN) if (f.re.test(text)) violations.push(f.why)
  return { ok: violations.length === 0, violations: Array.from(new Set(violations)) }
}

export class AiGuardError extends Error {
  constructor(public violations: string[]) {
    super(`AI output violated guard rules: ${violations.join(', ')}`)
    this.name = 'AiGuardError'
  }
}

/** Throws AiGuardError if the text contains forbidden language. */
export function enforceAiText(text: string): string {
  const r = lintAiText(text)
  if (!r.ok) throw new AiGuardError(r.violations)
  return text
}
