import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function legacyStoragePath(fileUrl: string) {
  try {
    const url = new URL(fileUrl)
    const marker = '/storage/v1/object/sign/draft-submissions/'
    const index = url.pathname.indexOf(marker)
    return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : null
  } catch {
    return null
  }
}

function privateRedirect(url: string | URL) {
  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: submission } = await supabase.from('submissions')
    .select(`
      id, file_url, storage_path, external_url,
      collabs(
        creator_profiles(user_id),
        brand_profiles(user_id)
      )
    `)
    .eq('id', params.id)
    .single()
  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  const collab = submission.collabs as any
  const isParty = collab?.creator_profiles?.user_id === user.id
    || collab?.brand_profiles?.user_id === user.id
  if (!isParty) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const storagePath = submission.storage_path
    || (submission.file_url ? legacyStoragePath(submission.file_url) : null)

  if (storagePath) {
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('draft-submissions')
      .createSignedUrl(storagePath, 300)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Draft file is unavailable' }, { status: 404 })
    }
    return privateRedirect(data.signedUrl)
  }

  const externalUrl = submission.external_url || submission.file_url
  if (!externalUrl) return NextResponse.json({ error: 'Draft file is unavailable' }, { status: 404 })

  try {
    const url = new URL(externalUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL')
    return privateRedirect(url)
  } catch {
    return NextResponse.json({ error: 'Draft link is invalid' }, { status: 400 })
  }
}
