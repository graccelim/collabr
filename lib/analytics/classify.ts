// Classification helpers. Deterministic: cache key + taxonomy validation. `format`
// is set deterministically at sync time (media type is known there); this module
// only validates the AI's category/subcategory/style labels against the taxonomy.
// AI is used ONLY for labelling — never performance, never "what performed best".
import crypto from 'crypto'
import { isCategory, isSubcategory, isStyle } from './taxonomy'

export interface ClassLabels {
  category: string | null
  subcategory: string | null
  style: string | null
  confidence: number // 0..1
  source: 'ai' | 'manual'
}

// Cache key over creator-authored metadata ONLY (no performance). Re-classify a
// post only when this changes; manual overrides (source='manual') are preserved.
export function classHash(input: { title?: string | null; caption?: string | null; hashtags?: string[] | null; durationSec?: number | null }): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    t: input.title || '', c: input.caption || '', h: (input.hashtags || []).join(','), d: input.durationSec ?? '',
  })).digest('hex')
}

// Validate raw AI output against the taxonomy; anything off-taxonomy → null.
export function validateLabels(raw: { category?: unknown; subcategory?: unknown; style?: unknown; confidence?: unknown } | null): ClassLabels {
  const category = isCategory(raw?.category) ? (raw!.category as string) : null
  const subcategory = category && isSubcategory(category, raw?.subcategory) ? (raw!.subcategory as string) : null
  const style = isStyle(raw?.style) ? (raw!.style as string) : null
  const confidence = typeof raw?.confidence === 'number' ? Math.max(0, Math.min(1, raw!.confidence as number)) : 0
  return { category, subcategory, style, confidence, source: 'ai' }
}
