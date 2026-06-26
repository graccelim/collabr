import { getAnthropic, AI_MODELS } from './client'
import { enforceAiText } from './guard'
import { PLATFORM_INSIGHTS_SYSTEM, REPORT_SYSTEM, COLLAB_ANALYSIS_SYSTEM, CONTENT_LAB_SYSTEM, CAMPAIGN_RECAP_SYSTEM } from './prompts'
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
    `Analyse this completed collaboration using only the creator's own deterministic data — explain why it ` +
      `performed as it did, which patterns contributed, what to repeat, and what to improve:\n${JSON.stringify(input)}`,
    AI_MODELS.interactive,
  )
}

export interface CampaignRecapInput {
  campaign: { title?: string | null }
  metrics: unknown // deterministic campaign_rollups (totals/derived/by_platform/per_creator/top_post/coverage)
}
export function campaignRecap(input: CampaignRecapInput): Promise<string> {
  return run(
    CAMPAIGN_RECAP_SYSTEM,
    `Write a recap of this brand's own campaign using only these deterministic metrics. Cover what performed ` +
      `well, which content styles and platform worked best, and suggestions for the next campaign.\n${JSON.stringify(input)}`,
    AI_MODELS.batch,
    1400,
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
