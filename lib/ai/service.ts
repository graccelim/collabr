import { getAnthropic, AI_MODELS } from './client'
import { enforceAiText } from './guard'
import { PLATFORM_INSIGHTS_SYSTEM, REPORT_SYSTEM, COLLAB_ANALYSIS_SYSTEM, CONTENT_LAB_SYSTEM, STRATEGIST_SYSTEM } from './prompts'
import type Anthropic from '@anthropic-ai/sdk'

// All functions: deterministic data in → Claude explains → guard enforces. They
// throw if ANTHROPIC_API_KEY is missing (callers gate on aiConfigured() first).

function textOf(msg: Anthropic.Message): string {
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim()
}

async function run(system: string, userContent: string, model: string, maxTokens = 1200): Promise<string> {
  const client = getAnthropic()
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    // Cache the stable system prompt (rules) across calls; volatile data goes in the user turn.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })
  return enforceAiText(textOf(msg))
}

// Raw variant for structured (JSON) outputs — no prose guard (the guard targets
// human-facing narration). Callers JSON.parse the result and validate the shape.
async function runRaw(system: string, userContent: string, model: string, maxTokens = 1400): Promise<string> {
  const client = getAnthropic()
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })
  return textOf(msg)
}
const stripJson = (s: string): string => s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

// AI STRATEGIST: reasons BEYOND the deterministic facts (given as knownFacts, never
// restated) to produce an analyst read, 4-6 personalised cards, and 3 experiments.
export type StrategyKind = 'pattern' | 'opportunity' | 'watch' | 'strategy'
export interface StrategyCard { kind: StrategyKind; title: string; body: string; confidence: string }
export interface StrategyExperiment { title: string; hypothesis: string; expected: string; confidence: string }
export interface StrategyOutput { analystRead: string; cards: StrategyCard[]; experiments: StrategyExperiment[]; questions: string[] }

export async function strategistRead(platform: string, payload: unknown): Promise<StrategyOutput | null> {
  const raw = await runRaw(
    STRATEGIST_SYSTEM,
    `Platform: ${platform}. The "knownFacts" below are ALREADY shown to the creator; never restate them. Study the account and return ONLY the JSON object:\n${JSON.stringify(payload)}`,
    AI_MODELS.interactive,
    2400,
  )
  let j: any
  try { j = JSON.parse(stripJson(raw)) } catch { return null }
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')
  const KINDS = new Set<StrategyKind>(['pattern', 'opportunity', 'watch', 'strategy'])
  const cards: StrategyCard[] = Array.isArray(j?.cards)
    ? j.cards.filter((c: any) => c && KINDS.has(c.kind) && str(c.title) && str(c.body))
        .slice(0, 6).map((c: any) => ({ kind: c.kind, title: str(c.title), body: str(c.body), confidence: str(c.confidence) }))
    : []
  const experiments: StrategyExperiment[] = Array.isArray(j?.experiments)
    ? j.experiments.filter((e: any) => e && str(e.title) && str(e.hypothesis))
        .slice(0, 3).map((e: any) => ({ title: str(e.title), hypothesis: str(e.hypothesis), expected: str(e.expected), confidence: str(e.confidence) }))
    : []
  const questions: string[] = Array.isArray(j?.questions)
    ? j.questions.filter((q: any) => str(q)).slice(0, 3).map((q: any) => str(q))
    : []
  const analystRead = str(j?.analystRead)
  if (!analystRead && !cards.length) return null
  return { analystRead, cards, experiments, questions }
}

// AI NARRATOR (not a tool): explains the deterministic per-platform insights.
// Input is the structured engine output; output is a short "analyst's read".
// If AI is disabled this is simply skipped — the deterministic insights remain.
export function narratePlatformInsights(platform: string, payload: unknown): Promise<string> {
  return run(
    PLATFORM_INSIGHTS_SYSTEM,
    `Platform: ${platform}. Deterministic insights for this creator's own ${platform} history:\n${JSON.stringify(payload)}`,
    AI_MODELS.batch,
    600,
  )
}

export interface ContentLabInput {
  topic: string; platform: string; tone?: string; goal?: string
  // The creator's own winning patterns for this platform (best length/window/
  // category/style), so generation is tailored. Optional → generic fallback.
  insights?: unknown
}
export interface ContentLabResult {
  hooks: string[]
  captions: string[]
  ctas: string[]
  hashtags: string[]
  videos: { title: string; structure: string }[]
  tailored: string | null
}
export async function contentLab(input: ContentLabInput): Promise<ContentLabResult> {
  const raw = await runRaw(
    CONTENT_LAB_SYSTEM,
    `Generate content for this input. If "insights" are present, tailor hooks/captions/length/timing to the ` +
      `creator's own winning patterns; if absent, produce solid generic ideas. Return ONLY the JSON object:\n${JSON.stringify(input)}`,
    AI_MODELS.interactive,
    1600,
  )
  const j = JSON.parse(stripJson(raw))
  const arr = (x: unknown, n: number): string[] => (Array.isArray(x) ? x.filter((s) => typeof s === 'string').slice(0, n) : [])
  const videos = Array.isArray(j?.videos)
    ? j.videos.filter((v: any) => v && typeof v.title === 'string' && typeof v.structure === 'string').slice(0, 3).map((v: any) => ({ title: v.title, structure: v.structure }))
    : []
  const result: ContentLabResult = {
    hooks: arr(j?.hooks, 5), captions: arr(j?.captions, 3), ctas: arr(j?.ctas, 3),
    hashtags: arr(j?.hashtags, 12).map((t) => (t.startsWith('#') ? t : `#${t}`)),
    videos, tailored: typeof j?.tailored === 'string' ? j.tailored : null,
  }
  if (!result.hooks.length && !result.captions.length && !result.videos.length) throw new Error('empty content lab result')
  return result
}

// Collaboration analysis (grounded in deterministic data, not "coaching").
export interface CollabAnalysisInput {
  campaign: { title?: string | null }
  performance?: unknown // the campaign's own deterministic rollup, if any
  platformInsights?: unknown // the creator's per-platform winning patterns
}
export function collaborationAnalysis(input: CollabAnalysisInput): Promise<string> {
  return run(
    COLLAB_ANALYSIS_SYSTEM,
    `Analyse this completed collaboration using only the creator's own deterministic data, explain why it ` +
      `performed as it did, which patterns contributed, what to repeat, and what to improve:\n${JSON.stringify(input)}`,
    AI_MODELS.interactive,
  )
}

// Weekly/monthly report from the deterministic per-platform insights.
export interface ReportInput { periodStart: string; periodEnd: string; platforms: unknown }
export function weeklyReport(input: ReportInput): Promise<string> {
  return run(
    REPORT_SYSTEM,
    `Write the report for ${input.periodStart} → ${input.periodEnd} from these per-platform insights ` +
      `(keep platforms separate):\n${JSON.stringify(input.platforms)}`,
    AI_MODELS.batch,
    1600,
  )
}
