import { getAnthropic, AI_MODELS } from './client'
import { enforceAiText } from './guard'
import { GROWTH_COACH_SYSTEM, GROWTH_SUGGESTIONS_SYSTEM, BRAND_COACH_SYSTEM, CONTENT_LAB_SYSTEM, CAMPAIGN_RECAP_SYSTEM } from './prompts'
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

export interface CoachContext {
  contentDna: unknown
  rollup: unknown
}

export function growthSummary(ctx: CoachContext): Promise<string> {
  return run(
    GROWTH_COACH_SYSTEM,
    `Here is the creator's own Content DNA and rollup. Write a short growth summary: what improved or declined ` +
      `vs their own prior period, their strongest platform and content style, and 2–3 next actions. ` +
      `Data:\n${JSON.stringify(ctx)}`,
    AI_MODELS.batch,
  )
}

// Proactive growth insights from the creator's OWN data (replaces the chat coach).
// Returns structured cards; parses the model's JSON defensively (guard already ran).
export interface GrowthSuggestion { title: string; why: string; evidence: string; action: string }
function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}
export async function growthSuggestions(ctx: CoachContext): Promise<GrowthSuggestion[]> {
  const raw = await run(
    GROWTH_SUGGESTIONS_SYSTEM,
    `Generate proactive growth insights from this creator's own data:\n${JSON.stringify(ctx)}`,
    AI_MODELS.batch,
    1600,
  )
  let parsed: unknown
  try { parsed = JSON.parse(stripFences(raw)) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((x): x is Record<string, unknown> => !!x && typeof (x as any).title === 'string')
    .slice(0, 10)
    .map((x) => ({
      title: String(x.title), why: String(x.why ?? ''),
      evidence: String(x.evidence ?? ''), action: String(x.action ?? ''),
    }))
}

export interface ContentLabInput {
  topic: string; platform: string; tone?: string; goal?: string
  contentDna?: unknown // their own best styles/categories, optional
}
export function contentLab(input: ContentLabInput): Promise<string> {
  return run(
    CONTENT_LAB_SYSTEM,
    `Generate content for this input. Use the creator's Content DNA to tailor it:\n${JSON.stringify(input)}`,
    AI_MODELS.interactive,
    1400,
  )
}

export interface BrandCoachInput {
  campaign: { title?: string; brief?: string; deliverables?: unknown; budgetCents?: number }
  contentDna: unknown
  ownHistory?: unknown // the creator's own past collabs/posts
}
export function brandCoachInviteAnalysis(input: BrandCoachInput): Promise<string> {
  return run(
    BRAND_COACH_SYSTEM,
    `A brand invited this creator to a campaign. Using ONLY the creator's own Content DNA and history, ` +
      `explain fit, portfolio gaps, ways to improve selection odds, which of their own posts to showcase, ` +
      `negotiation points and risks. Guide qualitatively — do not forecast numbers.\n${JSON.stringify(input)}`,
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

export function weeklyReport(ctx: CoachContext): Promise<string> {
  return run(
    GROWTH_COACH_SYSTEM,
    `Write this week's report from the creator's own data: top posts, growth, what worked / didn't, best ` +
      `time to post, and next actions. Data:\n${JSON.stringify(ctx)}`,
    AI_MODELS.batch,
    1600,
  )
}
