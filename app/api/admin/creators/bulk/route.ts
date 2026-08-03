import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { seedCreatorProfile } from '@/lib/admin-creators'
import { SOCIAL_PLATFORMS, extractHandle, HANDLE_REGEX } from '@/lib/onboarding'

// Fast rough-seed for sourcing at scale - one handle per line, all on the same
// platform (an admin typically works through a batch from one platform at a
// time). Each creator is created with just that single social and
// display_name = handle; bio/niche/notes get filled in later via the
// existing single-edit form. Reuses seedCreatorProfile - no new creation
// logic, just a different, faster way to call it.
const bulkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handles: z.array(z.string().trim().min(1).max(300)).min(1).max(200),
})

export async function POST(req: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const created: { handle: string; id: string }[] = []
  const failed: { handle: string; error: string }[] = []

  // Dedup within the pasted batch itself before spending a DB round-trip per line.
  const seen = new Set<string>()
  for (const raw of parsed.data.handles) {
    const handle = extractHandle(parsed.data.platform, raw)
    if (!HANDLE_REGEX.test(handle)) { failed.push({ handle: raw, error: 'Invalid handle' }); continue }
    if (seen.has(handle)) { failed.push({ handle: raw, error: 'Duplicate in this batch' }); continue }
    seen.add(handle)

    const result = await seedCreatorProfile(admin, {
      displayName: handle,
      socials: [{ platform: parsed.data.platform, handle }],
    })
    if (result.ok) created.push({ handle, id: result.id })
    else failed.push({ handle, error: result.error })
  }

  return NextResponse.json({ created, failed }, { status: 201 })
}
