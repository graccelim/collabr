import { getAnthropic, AI_MODELS } from './client'
import { enforceAiText } from './guard'
import { GROWTH_COACH_SYSTEM, PLATFORM_INSIGHTS_SYSTEM, BRAND_COACH_SYSTEM, CONTENT_LAB_SYSTEM, CAMPAIGN_RECAP_SYSTEM } from './prompts'
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
export function contentLab(input: ContentLabInput): Promise<string> {
  return run(
    CONTENT_LAB_SYSTEM,
    `Generate content for this input. If "insights" are present, tailor hooks/captions/length/timing to the ` +
      `creator's own winning patterns; if absent, produce solid generic ideas:\n${JSON.stringify(input)}`,
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
