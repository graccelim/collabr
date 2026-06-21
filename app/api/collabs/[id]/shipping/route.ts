import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'

// Structured shipping details for BARTER collabs. Creator submits/edits (until
// the brand marks it shipped); brand views + marks shipped. Party-checked here;
// the table's RLS only grants the two parties READ access.
async function loadCollab(supabase: ReturnType<typeof createClient>, id: string) {
  const { data: collab } = await supabase.from('collabs')
    .select('id, agreed_rate, creator_profiles(user_id), brand_profiles(user_id)')
    .eq('id', id).single()
  return collab
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const collab = await loadCollab(supabase, params.id)
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const brandUserId = (collab.brand_profiles as any)?.user_id
  if (creatorUserId !== user.id) return NextResponse.json({ error: 'Only the creator can submit shipping details' }, { status: 403 })
  if ((collab.agreed_rate ?? 0) !== 0) return NextResponse.json({ error: 'Shipping details are only for barter collaborations' }, { status: 400 })

  const admin = createAdminClient()
  // Locked once the brand marks it shipped.
  const { data: existing } = await admin.from('collab_shipping').select('shipped_at').eq('collab_id', params.id).maybeSingle()
  if (existing?.shipped_at) return NextResponse.json({ error: 'This has already been shipped and can no longer be edited.' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const s = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
  const row = {
    recipient_name: s(body.recipient_name, 120),
    phone: s(body.phone, 40),
    address_line1: s(body.address_line1),
    address_line2: s(body.address_line2) || null,
    postal_code: s(body.postal_code, 20),
    country: s(body.country, 80),
    delivery_notes: s(body.delivery_notes, 500) || null,
  }
  if (!row.recipient_name || !row.phone || !row.address_line1 || !row.postal_code || !row.country) {
    return NextResponse.json({ error: 'Name, phone, address, postal code and country are required.' }, { status: 400 })
  }

  const isUpdate = Boolean(existing)
  const { error } = await admin.from('collab_shipping')
    .upsert({ collab_id: params.id, ...row, updated_at: new Date().toISOString() }, { onConflict: 'collab_id' })
  if (error) return NextResponse.json({ error: 'Could not save your shipping details. Please try again.' }, { status: 500 })

  if (brandUserId) {
    await sendNotification({
      userId: brandUserId, type: 'shipping_submitted',
      title: isUpdate ? 'Shipping details updated' : 'Shipping details provided',
      body: 'The creator added their shipping address. Open the collab to view it and send the product.',
      payload: { collab_id: params.id },
      dedupeKey: `collab:${params.id}:shipping:${isUpdate ? Date.now() : 'first'}`,
    })
  }
  return NextResponse.json({ success: true })
}

// Brand marks the product shipped (locks the details). tracking/courier optional.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const collab = await loadCollab(supabase, params.id)
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((collab.brand_profiles as any)?.user_id !== user.id) return NextResponse.json({ error: 'Only the brand can mark this shipped' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const { data: updated, error } = await admin.from('collab_shipping')
    .update({
      shipped_at: new Date().toISOString(),
      tracking_number: body.tracking_number ? String(body.tracking_number).trim().slice(0, 120) : null,
      courier: body.courier ? String(body.courier).trim().slice(0, 80) : null,
    })
    .eq('collab_id', params.id).is('shipped_at', null).select('collab_id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'No editable shipping details to mark shipped.' }, { status: 409 })

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (creatorUserId) {
    await sendNotification({
      userId: creatorUserId, type: 'shipping_submitted',
      title: 'Your product is on the way',
      body: 'The brand marked your barter item as shipped.',
      payload: { collab_id: params.id },
      dedupeKey: `collab:${params.id}:shipped`,
    })
  }
  return NextResponse.json({ success: true })
}
