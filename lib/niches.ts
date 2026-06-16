import { CREATOR_NICHES, NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'

// ── Shared canonical niche taxonomy (Discovery Foundation) ──────────────────
// One vocabulary for BOTH creators and campaigns. The 12 canonical slugs are
// the source of truth (mirrored in the `niches` table, migration 013). Free
// text from anywhere ("F&B", "Food & Beverage", "fnb", "restaurant", "cafe")
// is folded onto a canonical slug via the alias map so matching is reliable.
//
// This runtime map MUST stay in sync with the `niche_aliases` seed in
// migration 013 - both are seeded from the same list below.

export const NICHE_SLUGS = CREATOR_NICHES
export { NICHE_LABELS }
export type NicheSlug = CreatorNiche

/** alias (already lowercased) → canonical slug. Keep in sync with migration 013. */
export const NICHE_ALIASES: Record<string, NicheSlug> = {
  // food
  'food': 'food', 'foods': 'food', 'f&b': 'food', 'fnb': 'food', 'f & b': 'food',
  'food & beverage': 'food', 'food and beverage': 'food', 'food&beverage': 'food',
  'restaurant': 'food', 'restaurants': 'food', 'cafe': 'food', 'cafes': 'food',
  'coffee': 'food', 'dining': 'food', 'foodie': 'food', 'culinary': 'food',
  'cooking': 'food', 'recipe': 'food', 'recipes': 'food', 'bakery': 'food', 'dessert': 'food',
  // beauty
  'beauty': 'beauty', 'skincare': 'beauty', 'skin care': 'beauty', 'makeup': 'beauty',
  'make up': 'beauty', 'cosmetics': 'beauty', 'cosmetic': 'beauty', 'haircare': 'beauty',
  'hair': 'beauty', 'nails': 'beauty', 'grooming': 'beauty',
  // fashion
  'fashion': 'fashion', 'style': 'fashion', 'apparel': 'fashion', 'clothing': 'fashion',
  'streetwear': 'fashion', 'outfit': 'fashion', 'ootd': 'fashion', 'accessories': 'fashion',
  'retail': 'fashion',
  // fitness
  'fitness': 'fitness', 'gym': 'fitness', 'workout': 'fitness', 'health': 'fitness',
  'wellness': 'fitness', 'yoga': 'fitness', 'sports': 'fitness', 'nutrition': 'fitness',
  'healthcare': 'fitness',
  // travel
  'travel': 'travel', 'tourism': 'travel', 'hospitality': 'travel', 'hotel': 'travel',
  'hotels': 'travel', 'staycation': 'travel', 'adventure': 'travel', 'destination': 'travel',
  // tech
  'tech': 'tech', 'technology': 'tech', 'gadgets': 'tech', 'gadget': 'tech', 'saas': 'tech',
  'software': 'tech', 'apps': 'tech', 'app': 'tech', 'ai': 'tech', 'electronics': 'tech',
  'startup': 'tech',
  // gaming
  'gaming': 'gaming', 'games': 'gaming', 'game': 'gaming', 'esports': 'gaming',
  'streamer': 'gaming', 'twitch': 'gaming',
  // parenting
  'parenting': 'parenting', 'parent': 'parenting', 'family': 'parenting', 'kids': 'parenting',
  'mom': 'parenting', 'mum': 'parenting', 'baby': 'parenting', 'children': 'parenting',
  // business
  'business': 'business', 'finance': 'business', 'fintech': 'business', 'entrepreneur': 'business',
  'entrepreneurship': 'business', 'marketing': 'business', 'career': 'business', 'money': 'business',
  // education
  'education': 'education', 'learning': 'education', 'edtech': 'education', 'tutoring': 'education',
  'study': 'education', 'language': 'education', 'courses': 'education',
  // lifestyle
  'lifestyle': 'lifestyle', 'life': 'lifestyle', 'vlog': 'lifestyle', 'vlogging': 'lifestyle',
  'daily': 'lifestyle', 'home': 'lifestyle', 'decor': 'lifestyle', 'interior': 'lifestyle',
  'pets': 'lifestyle', 'photography': 'lifestyle',
  // other
  'other': 'other', 'misc': 'other', 'general': 'other',
}

/** Normalize one free-text tag to a canonical slug, or null if unmappable. */
export function normalizeNiche(input: string | null | undefined): NicheSlug | null {
  if (!input) return null
  const key = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return null
  if ((NICHE_SLUGS as readonly string[]).includes(key)) return key as NicheSlug
  return NICHE_ALIASES[key] ?? null
}

/** Normalize a list of free-text tags to a deduped set of canonical slugs. */
export function normalizeNicheTags(inputs: (string | null | undefined)[]): NicheSlug[] {
  const out = new Set<NicheSlug>()
  for (const i of inputs) {
    const slug = normalizeNiche(i)
    if (slug) out.add(slug)
  }
  return Array.from(out)
}

export function nicheLabel(slug: string): string {
  return NICHE_LABELS[slug as NicheSlug] ?? slug
}

/** Jaccard overlap of two niche-slug sets (0..1). Empty campaign side → 1. */
export function nicheOverlap(creatorSlugs: string[], campaignSlugs: string[]): number {
  const a = Array.from(new Set(normalizeNicheTags(creatorSlugs)))
  const b = Array.from(new Set(normalizeNicheTags(campaignSlugs)))
  if (b.length === 0) return 1 // untargeted campaign - everyone is on-niche
  if (a.length === 0) return 0
  const bSet = new Set(b)
  let inter = 0
  for (const s of a) if (bSet.has(s)) inter++
  const union = new Set(a.concat(b)).size
  return union === 0 ? 0 : inter / union
}

// ── Chip colour coding ──────────────────────────────────────────────────────
// Deterministic colour for a niche / industry chip so the same label always
// reads the same colour across the app (profiles, cards, signup).
const CHIP_PALETTE: { bg: string; fg: string }[] = [
  { bg: 'rgba(249,115,22,.13)', fg: '#C2410C' }, // orange
  { bg: '#EDE9FE',              fg: '#6D28D9' }, // violet
  { bg: 'var(--money-tint)',    fg: 'var(--money-deep)' }, // green
  { bg: '#FCE7F3',              fg: '#BE185D' }, // pink
  { bg: '#E0F2FE',              fg: '#0369A1' }, // sky
  { bg: 'var(--warn-tint)',     fg: 'var(--warn-deep)' }, // amber
  { bg: 'var(--accent-tint)',   fg: 'var(--accent-deep)' }, // indigo
  { bg: '#CCFBF1',              fg: '#0F766E' }, // teal
]

export function chipColor(key: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return CHIP_PALETTE[h % CHIP_PALETTE.length]
}
