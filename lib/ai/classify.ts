// AI classifier — labels posts into the FIXED taxonomy from creator-authored text
// only. AI's ONLY job in analytics is classification; it never sees or uses
// performance metrics, and never decides what performed best. Output is validated
// against the taxonomy by the caller. Safe to skip when AI is unavailable.
import { getAnthropic, AI_MODELS } from './client'
import { taxonomyForPrompt } from '@/lib/analytics/taxonomy'
import type Anthropic from '@anthropic-ai/sdk'

export interface RawClassifyInput { externalId: string; title?: string | null; caption?: string | null; hashtags?: string[] | null }
export interface RawClassifyOutput { externalId: string; category: string | null; subcategory: string | null; style: string | null; confidence: number }

const SYSTEM = `You classify short social posts into a FIXED taxonomy for a creator marketplace. You are given each
post's creator-authored metadata ONLY (title, caption, hashtags), never any performance numbers, and you must
not infer or request them. For each post choose the single best category and a subcategory that BELONGS to that
category. For STYLE, only assign a value when the text CLEARLY signals how the content is presented (e.g. an
explicit "voiceover", "tutorial", "review", "vlog", "skit", "interview"). The caption usually does NOT reveal the
presentation, so when it is not clearly indicated, set style to null. Never guess a style; in particular do NOT
assume "talking to camera" or any video style just because a post exists. If the category is ambiguous, pick the
closest match and lower the confidence; if you genuinely cannot tell, use null with confidence 0. Use ONLY values
from the taxonomy below, never invent new ones.
Output ONLY a JSON array (no prose, no markdown), one object per input:
{"externalId": string, "category": string|null, "subcategory": string|null, "style": string|null, "confidence": number}

`

export async function classifyContent(inputs: RawClassifyInput[]): Promise<RawClassifyOutput[]> {
  if (!inputs.length) return []
  const client = getAnthropic() // throws if suite off / no key, caller gates on aiConfigured()
  const msg = await client.messages.create({
    model: AI_MODELS.batch,
    max_tokens: 2400,
    system: [{ type: 'text', text: SYSTEM + taxonomyForPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Classify these posts:\n${JSON.stringify(inputs)}` }],
  })
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim()
  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
