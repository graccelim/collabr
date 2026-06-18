// SEO-friendly slugs for public brand / creator / campaign URLs.
// UUIDs stay the primary key; the slug is a human-readable alias.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Is this route param a raw UUID (vs a slug)? Lets pages resolve either. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Turn a display name into a clean slug: lowercased, accent-stripped, spaces and
 * punctuation collapsed to single hyphens, trimmed, capped. Falls back to
 * 'profile' if nothing usable remains (e.g. an all-emoji name).
 */
export function slugify(name: string): string {
  const base = (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[’'`]/g, '')             // drop apostrophes so "o'brien" -> obrien
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')       // everything else -> hyphen
    .replace(/^-+|-+$/g, '')           // trim hyphens
    .replace(/-{2,}/g, '-')            // collapse repeats
    .slice(0, 60)
    .replace(/-+$/g, '')               // re-trim after slice
  return base || 'profile'
}

/**
 * Resolve a collision-free slug from a base. `isTaken(candidate)` answers whether
 * a slug is already used (by a DIFFERENT row). Appends -2, -3, ... until free.
 * Pure of any DB: the caller supplies the lookup.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxTries = 1000,
): Promise<string> {
  const root = slugify(base)
  if (!(await isTaken(root))) return root
  for (let n = 2; n <= maxTries; n++) {
    const candidate = `${root}-${n}`
    if (!(await isTaken(candidate))) return candidate
  }
  // Extremely unlikely; fall back to a random suffix to guarantee uniqueness.
  return `${root}-${Math.floor(Date.now() % 100000)}`
}
