'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Truck, Check, Pencil, MapPin } from 'lucide-react'

export interface Shipping {
  recipient_name: string
  phone: string
  address_line1: string
  address_line2: string | null
  postal_code: string
  country: string
  delivery_notes: string | null
  submitted_at: string
  updated_at: string
  shipped_at: string | null
}

interface Props {
  collabId: string
  isBrand: boolean
  isCreator: boolean
  creatorName: string
  shipping: Shipping | null
}

const FIELDS = [
  ['recipient_name', 'Recipient name', true],
  ['phone', 'Phone number', true],
  ['address_line1', 'Address line 1', true],
  ['address_line2', 'Address line 2', false],
  ['postal_code', 'Postal code', true],
  ['country', 'Country', true],
  ['delivery_notes', 'Delivery notes', false],
] as const

/**
 * Structured shipping details for a barter collab — replaces pasting addresses
 * into chat. Creator fills it in (editable until shipped); brand views + ships.
 */
export default function ShippingDetails({ collabId, isBrand, isCreator, creatorName, shipping }: Props) {
  const router = useRouter()
  const shipped = Boolean(shipping?.shipped_at)
  const [editing, setEditing] = useState(isCreator && !shipping)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(() => ({
    recipient_name: shipping?.recipient_name ?? '',
    phone: shipping?.phone ?? '',
    address_line1: shipping?.address_line1 ?? '',
    address_line2: shipping?.address_line2 ?? '',
    postal_code: shipping?.postal_code ?? '',
    country: shipping?.country ?? '',
    delivery_notes: shipping?.delivery_notes ?? '',
  }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/shipping`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Shipping details saved')
      setEditing(false)
      router.refresh()
    } catch (e: any) { toast.error(e.message || 'Could not save') } finally { setBusy(false) }
  }

  async function markShipped() {
    setBusy(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/shipping`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Marked as shipped')
      router.refresh()
    } catch (e: any) { toast.error(e.message || 'Could not update') } finally { setBusy(false) }
  }

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Truck size={16} color="var(--ink-soft)" />
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Shipping details</h2>
      {shipping && !shipped && (
        <span className="badge badge-safe" style={{ marginLeft: 'auto' }}><Check size={11} /> Provided</span>
      )}
      {shipped && <span className="badge badge-money" style={{ marginLeft: 'auto' }}><Truck size={11} /> Shipped</span>}
    </div>
  )

  // ── Creator: edit form ──
  if (isCreator && editing && !shipped) {
    return (
      <form onSubmit={submit} className="card" style={{ padding: 18 }}>
        {header}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FIELDS.map(([key, label, required]) => (
            <label key={key} style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4 }}>
                {label}{required ? '' : ' (optional)'}
              </span>
              {key === 'delivery_notes' ? (
                <textarea className="input" style={{ width: '100%', minHeight: 60 }} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              ) : (
                <input className="input" style={{ width: '100%' }} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={required} />
              )}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save shipping details'}</button>
          {shipping && <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', margin: '10px 0 0' }}>
          Only {isBrand ? 'you' : 'the brand'} can see this. Editable until the brand ships your item.
        </p>
      </form>
    )
  }

  // ── Creator with no details yet, collapsed prompt ──
  if (isCreator && !shipping) {
    return (
      <div className="card" style={{ padding: 18 }}>
        {header}
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 14px', lineHeight: 1.5 }}>
          This is a barter collaboration. Provide your shipping address so the brand can send your item.
        </p>
        <button type="button" className="btn-primary" onClick={() => setEditing(true)}><MapPin size={15} /> Provide shipping details</button>
      </div>
    )
  }

  // ── Brand: waiting ──
  if (isBrand && !shipping) {
    return (
      <div className="card" style={{ padding: 18 }}>
        {header}
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
          Waiting for {creatorName.split(' ')[0]} to add their shipping details. You&rsquo;ll be notified when they do.
        </p>
      </div>
    )
  }

  // ── Read view (creator submitted / brand viewing / shipped) ──
  const s = shipping!
  const rows: [string, string | null][] = [
    ['Recipient', s.recipient_name], ['Phone', s.phone],
    ['Address', [s.address_line1, s.address_line2].filter(Boolean).join(', ')],
    ['Postal code', s.postal_code], ['Country', s.country],
    ['Notes', s.delivery_notes],
  ]
  return (
    <div className="card" style={{ padding: 18 }}>
      {header}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--ink-faint-solid)', width: 88, flexShrink: 0 }}>{k}</span>
            <span style={{ color: 'var(--ink)', minWidth: 0 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        {isCreator && !shipped && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
        )}
        {isBrand && !shipped && (
          <button type="button" className="btn-primary btn-sm" onClick={markShipped} disabled={busy}>
            <Truck size={14} /> {busy ? 'Updating…' : 'Mark as shipped'}
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginLeft: 'auto' }}>
          {shipped ? `Shipped ${new Date(s.shipped_at!).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : `Provided ${new Date(s.updated_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`}
        </span>
      </div>
    </div>
  )
}
