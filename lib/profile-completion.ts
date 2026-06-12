// Profile completion scoring (Phase 6). Items mirror what brands/creators see
// as trust signals, and what future Creator Discovery will rank on.

export interface CompletionItem {
  key: string
  label: string
  done: boolean
}

export interface CompletionResult {
  score: number // 0–100
  items: CompletionItem[]
}

function toResult(items: CompletionItem[]): CompletionResult {
  const done = items.filter(i => i.done).length
  return { score: Math.round((done / items.length) * 100), items }
}

export function creatorCompletion(input: {
  avatar_url?: string | null
  niche?: string | null
  bio?: string | null
  location?: string | null
  portfolio_links?: string[] | null
  socials_count: number
}): CompletionResult {
  return toResult([
    { key: 'photo', label: 'Profile photo', done: Boolean(input.avatar_url) },
    { key: 'niche', label: 'Niche', done: Boolean(input.niche) },
    { key: 'bio', label: 'Bio', done: Boolean(input.bio?.trim()) },
    { key: 'location', label: 'Location', done: Boolean(input.location?.trim()) },
    { key: 'portfolio', label: 'Portfolio link', done: (input.portfolio_links?.length || 0) > 0 },
    { key: 'social', label: 'Social account', done: input.socials_count > 0 },
  ])
}

export function brandCompletion(input: {
  logo_url?: string | null
  company_name?: string | null
  company_description?: string | null
  industry?: string | null
  website?: string | null
  social_url?: string | null
}): CompletionResult {
  return toResult([
    { key: 'logo', label: 'Logo', done: Boolean(input.logo_url) },
    { key: 'company', label: 'Company name', done: Boolean(input.company_name?.trim()) },
    { key: 'description', label: 'Description', done: Boolean(input.company_description?.trim()) },
    { key: 'industry', label: 'Industry', done: Boolean(input.industry) },
    { key: 'web', label: 'Website or social', done: Boolean(input.website || input.social_url) },
  ])
}
