import { describe, it, expect } from 'vitest'
import { ensureSlug } from '@/lib/slug-server'

/**
 * In-memory Supabase-ish admin stub. Holds rows of { id, slug } for one table
 * and supports exactly the two chains ensureSlug uses:
 *   .select('id').eq('slug', x).limit(1)               -> collision check
 *   .update({slug}).eq('id', id).is('slug', null).select('slug').maybeSingle()
 *   .select('slug').eq('id', id).maybeSingle()         -> read-back
 */
function makeAdmin(rows: { id: string; slug: string | null }[]) {
  function from() {
    const q: any = { eqs: {} as Record<string, unknown>, isNull: false, op: 'select', patch: null as any, sel: '' }
    const builder: any = {
      select(cols: string) { q.sel = cols; return builder },
      update(patch: any) { q.op = 'update'; q.patch = patch; return builder },
      eq(col: string, val: unknown) { q.eqs[col] = val; return builder },
      is(col: string, val: unknown) { if (col === 'slug' && val === null) q.isNull = true; return builder },
      limit() { return builder },
      maybeSingle() { return Promise.resolve(run()) },
      then(res: any) { return res(run()) },
    }
    function match(r: { id: string; slug: string | null }) {
      return Object.entries(q.eqs).every(([c, v]) => (r as any)[c] === v)
    }
    function run() {
      if (q.op === 'update') {
        const row = rows.find(r => r.id === q.eqs.id)
        if (row && (!q.isNull || row.slug == null)) {
          row.slug = q.patch.slug
          return { data: { slug: row.slug }, error: null }
        }
        return { data: null, error: null } // guard failed -> 0 rows
      }
      const hits = rows.filter(match)
      if (q.sel === 'id') return { data: hits.map(r => ({ id: r.id })), error: null }
      if (q.sel === 'slug') return { data: hits[0] ? { slug: hits[0].slug } : null, error: null }
      return { data: hits, error: null }
    }
    return builder
  }
  return { from } as any
}

describe('ensureSlug (server)', () => {
  it('is generate-once: an existing slug is returned untouched', async () => {
    const rows = [{ id: 'c1', slug: 'grace-lim' }]
    const admin = makeAdmin(rows)
    const out = await ensureSlug(admin, 'creator_profiles', 'c1', 'Totally Different Name', 'grace-lim')
    expect(out).toBe('grace-lim')
    expect(rows[0].slug).toBe('grace-lim') // not regenerated on name change
  })

  it('generates and stores a slug from the base when none exists', async () => {
    const rows = [{ id: 'c1', slug: null }]
    const admin = makeAdmin(rows)
    const out = await ensureSlug(admin, 'creator_profiles', 'c1', 'Grace Lim')
    expect(out).toBe('grace-lim')
    expect(rows[0].slug).toBe('grace-lim')
  })

  it('appends -2 when the base collides with another row', async () => {
    const rows = [
      { id: 'c1', slug: 'grace-lim' }, // taken by someone else
      { id: 'c2', slug: null },        // the one we're slugging
    ]
    const admin = makeAdmin(rows)
    const out = await ensureSlug(admin, 'creator_profiles', 'c2', 'Grace Lim')
    expect(out).toBe('grace-lim-2')
    expect(rows[1].slug).toBe('grace-lim-2')
  })

  it('builds a brand-context campaign slug', async () => {
    const rows = [{ id: 'k1', slug: null }]
    const admin = makeAdmin(rows)
    const out = await ensureSlug(admin, 'campaigns', 'k1', 'TikTok Food Review Wild Coco')
    expect(out).toBe('tiktok-food-review-wild-coco')
  })
})
