// Generic hierarchical content taxonomy for a creator marketplace. Niche-agnostic:
// Food is ONE branch, not the system. The classification + insight engines are
// fully taxonomy-driven — no hardcoded niche logic anywhere else.

export const TAXONOMY: Record<string, string[]> = {
  Food: ['Restaurant reviews', 'Recipes', 'Street food', 'Cafés & coffee', 'Baking', 'Drinks & cocktails', 'Healthy eating'],
  Beauty: ['Makeup', 'Skincare', 'Haircare', 'Nails', 'Fragrance', 'Tutorials'],
  Fashion: ['Outfits & OOTD', 'Hauls', 'Styling tips', 'Streetwear', 'Luxury', 'Thrift & vintage'],
  Travel: ['Itineraries', 'Hotels & stays', 'Flights & deals', 'Adventure', 'Budget travel', 'City guides'],
  Tech: ['Reviews', 'Unboxings', 'How-to', 'Gadgets', 'Apps & software', 'AI'],
  Gaming: ['Gameplay', 'Reviews', 'Streams', 'Esports', 'Guides & tips'],
  Fitness: ['Workouts', 'Nutrition', 'Transformation', 'Yoga & mobility', 'Sports'],
  Lifestyle: ['Vlogs', 'Productivity', 'Home & decor', 'Relationships', 'Personal finance', 'Parenting'],
  Entertainment: ['Comedy & skits', 'Reactions', 'Music', 'Dance', 'Storytime'],
  Education: ['Explainers', 'Tutorials', 'Tips & hacks', 'Career', 'Language'],
  Business: ['Marketing', 'Entrepreneurship', 'Side hustles', 'Investing'],
  Pets: ['Dogs', 'Cats', 'Care & training', 'Funny moments'],
}

// Content STYLE = how it's made/delivered (treatment).
export const STYLES = [
  'talking-head', 'voiceover', 'vlog', 'tutorial', 'review', 'skit', 'interview',
  'b-roll montage', 'text-on-screen', 'green-screen', 'demo', 'listicle',
] as const

// Content FORMAT = the container. Usually derivable deterministically from media.
export const FORMATS = [
  'short-form video', 'long-form video', 'carousel', 'image', 'story', 'livestream',
] as const

export const CATEGORIES = Object.keys(TAXONOMY)
export type Format = (typeof FORMATS)[number]

export function isCategory(v: unknown): v is string { return typeof v === 'string' && v in TAXONOMY }
export function isSubcategory(cat: string, v: unknown): boolean {
  return typeof v === 'string' && (TAXONOMY[cat]?.includes(v) ?? false)
}
export function isStyle(v: unknown): boolean { return typeof v === 'string' && (STYLES as readonly string[]).includes(v) }
export function isFormat(v: unknown): boolean { return typeof v === 'string' && (FORMATS as readonly string[]).includes(v) }

/** Deterministic format from media metadata — no AI needed. */
export function formatFromMetadata(mediaType: string | null, durationSec: number | null): Format | null {
  const t = (mediaType || '').toLowerCase()
  if (t.includes('carousel') || t.includes('album')) return 'carousel'
  if (t.includes('story')) return 'story'
  if (t.includes('live')) return 'livestream'
  if (t === 'image' || t.includes('photo')) return 'image'
  if (durationSec != null) return durationSec <= 90 ? 'short-form video' : 'long-form video'
  if (t.includes('video') || t.includes('reel')) return 'short-form video'
  return null
}

/** A compact prompt-ready description of the taxonomy for the AI classifier. */
export function taxonomyForPrompt(): string {
  const cats = Object.entries(TAXONOMY).map(([c, subs]) => `${c}: ${subs.join(', ')}`).join('\n')
  return `CATEGORIES (with allowed subcategories):\n${cats}\n\nSTYLES: ${STYLES.join(', ')}`
}
