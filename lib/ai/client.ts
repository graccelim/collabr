import Anthropic from '@anthropic-ai/sdk'
import { flags } from '@/lib/flags'

// Gated Anthropic client. aiConfigured() requires BOTH the Analytics Suite ON and
// ANTHROPIC_API_KEY present — routes return 404/503 otherwise (fail safe, never fake).
export function aiConfigured(): boolean {
  return flags.analyticsSuite && Boolean(process.env.ANTHROPIC_API_KEY)
}

let _client: Anthropic | null = null
export function getAnthropic(): Anthropic {
  // MASTER GUARD: no Anthropic request can ever execute when the suite is off,
  // even if the key is present and a caller forgets to gate.
  if (!flags.analyticsSuite) throw new Error('Analytics Suite is off')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')
  if (!_client) _client = new Anthropic()
  return _client
}

// Cost-optimised model tiers: cheap Haiku for batch summaries/reports; Sonnet for
// interactive coaching. (Override per call if a task needs more capability.)
export const AI_MODELS = {
  batch: 'claude-haiku-4-5',
  interactive: 'claude-sonnet-4-6',
} as const

export const AI_DISCLAIMER =
  'Suggestions are based on available performance data and may not guarantee results.'
