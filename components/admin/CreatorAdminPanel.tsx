'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Plus, Copy, RefreshCw, Ban, Pencil, Archive, ArchiveRestore, X,
  MessageSquareText, Search, ChevronDown, ChevronRight, Upload,
} from 'lucide-react'
import { CREATOR_NICHES, NICHE_LABELS, SOCIAL_PLATFORMS, SOCIAL_LABELS, type CreatorNiche, type SocialPlatform } from '@/lib/onboarding'
import SocialProfileBuilder, { newSocialRow, type SocialRow } from '@/components/SocialProfileBuilder'
import CreatorActiveBadge from '@/components/CreatorActiveBadge'

const REQUEST_STATUSES = ['pending', 'contacted', 'interested', 'declined'] as const
type RequestStatus = (typeof REQUEST_STATUSES)[number]

export interface AdminCreatorRow {
  id: string
  displayName: string
  email: string | null
  bio: string
  nicheTags: string[]
  internalNotes: string
  claimed: boolean
  onboardingCompleted: boolean
  archived: boolean
  createdByAdmin: boolean
  slug: string | null
  socials: SocialRow[]
  activeClaimExpiresAt: string | null
  /** Brands interested in this creator - pre-claim (pending_collab_requests,
   *  admin-editable outreach status) and post-claim (campaign_invites, the
   *  creator's own accept/decline) shown together, newest first. */
  requests: {
    id: string
    kind: 'pending' | 'invite'
    brandName: string
    campaignName: string
    rate: number
    status: string
    createdAt: string
  }[]
}

function toSocialsPayload(rows: SocialRow[]) {
  return rows
    .filter(r => r.username.trim())
    .map(r => ({
      platform: r.platform,
      handle: r.username.trim(),
      follower_count: r.followers.trim() ? parseInt(r.followers, 10) : null,
    }))
}

function outreachMessage(displayName: string, claimUrl: string): string {
  const first = displayName.split(' ')[0]
  return `Hi ${first}! I'm building Collabr, a platform connecting brands and creators in Singapore for paid collabs. I put together a profile for you — it's yours if you want it: ${claimUrl}`
}

/** Create/edit form - same shape for both, the caller decides which endpoint to hit. */
function CreatorForm({ initial, busy, onCancel, onSubmit }: {
  initial?: { displayName: string; bio: string; nicheTags: string[]; internalNotes: string; socials: SocialRow[] }
  busy: boolean
  onCancel: () => void
  onSubmit: (data: { displayName: string; bio: string; nicheTags: CreatorNiche[]; internalNotes: string; socials: SocialRow[] }) => void
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName || '')
  const [bio, setBio] = useState(initial?.bio || '')
  const [niches, setNiches] = useState<CreatorNiche[]>((initial?.nicheTags || []) as CreatorNiche[])
  const [internalNotes, setInternalNotes] = useState(initial?.internalNotes || '')
  const [socialRows, setSocialRows] = useState<SocialRow[]>(
    initial?.socials?.length ? initial.socials : [newSocialRow()]
  )

  function toggleNiche(n: CreatorNiche) {
    setNiches(prev => prev.includes(n) ? prev.filter(x => x !== n) : prev.length >= 4 ? prev : [...prev, n])
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">Display name</label>
        <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Alex Tan" disabled={busy} />
      </div>
      <div>
        <label className="label">Bio (optional)</label>
        <textarea className="input min-h-[70px]" value={bio} onChange={e => setBio(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label className="label">Niches</label>
        <div className="flex flex-wrap gap-2">
          {CREATOR_NICHES.map(n => (
            <button key={n} type="button" onClick={() => toggleNiche(n)} disabled={busy}
              className={`chip${niches.includes(n) ? ' on' : ''}`}>
              {NICHE_LABELS[n]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Social profiles</label>
        <SocialProfileBuilder rows={socialRows} onChange={setSocialRows} />
      </div>
      <div>
        <label className="label">Internal notes (admin-only, never shown publicly)</label>
        <textarea className="input min-h-[60px] text-sm" value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
          placeholder="e.g. contacted on Instagram, prefers email, interested next month" disabled={busy} />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={busy}
          onClick={() => onSubmit({ displayName: displayName.trim(), bio: bio.trim(), nicheTags: niches, internalNotes: internalNotes.trim(), socials: socialRows })}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}

/** Paste-many-handles fast seed - platform + one handle per line, all created
 *  via the same seedCreatorProfile the single form uses. Rough on purpose:
 *  bio/niche/notes get filled in later through the existing edit form. */
function BulkAddForm({ busy, onCancel, onSubmit }: {
  busy: boolean
  onCancel: () => void
  onSubmit: (platform: SocialPlatform, handles: string[]) => void
}) {
  const [platform, setPlatform] = useState<SocialPlatform>('instagram')
  const [text, setText] = useState('')

  return (
    <div className="card space-y-3">
      <div>
        <label className="label">Platform</label>
        <select className="input" value={platform} onChange={e => setPlatform(e.target.value as SocialPlatform)} disabled={busy}>
          {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{SOCIAL_LABELS[p]}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Handles, one per line</label>
        <textarea className="input min-h-[140px] text-sm font-mono" value={text} onChange={e => setText(e.target.value)}
          placeholder={'girldevours\n@foodie.sg\nhttps://instagram.com/travelwithmei'} disabled={busy} />
        <p className="text-xs text-gray-400 mt-1">Each line becomes a rough profile (name = handle) you can flesh out later.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={busy}
          onClick={() => onSubmit(platform, text.split('\n').map(l => l.trim()).filter(Boolean))}>
          {busy ? 'Importing…' : 'Import'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}

function RequestsTable({ requests, busyRequestId, onStatusChange }: {
  requests: AdminCreatorRow['requests']
  busyRequestId: string | null
  onStatusChange: (id: string, status: RequestStatus) => void
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="text-left text-gray-400">
            <th className="font-medium pb-1 pr-4">Brand</th>
            <th className="font-medium pb-1 pr-4">Campaign</th>
            <th className="font-medium pb-1 pr-4">Status</th>
            <th className="font-medium pb-1">Requested</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
              <td className="py-1.5 pr-4">{r.brandName}</td>
              <td className="py-1.5 pr-4">{r.campaignName}</td>
              <td className="py-1.5 pr-4">
                {r.kind === 'pending' ? (
                  <select
                    className="input text-xs py-0.5"
                    style={{ width: 'auto' }}
                    value={r.status}
                    disabled={busyRequestId === r.id}
                    onChange={e => onStatusChange(r.id, e.target.value as RequestStatus)}
                  >
                    {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>{r.status}</span>
                )}
              </td>
              <td className="py-1.5 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CreatorAdminPanel({ initialCreators }: { initialCreators: AdminCreatorRow[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [bulkAdding, setBulkAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [linkFor, setLinkFor] = useState<{ id: string; displayName: string; url: string; expiresAt: string } | null>(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialCreators
      .filter(c => showArchived ? c.archived : !c.archived)
      .filter(c => {
        if (!q) return true
        return c.displayName.toLowerCase().includes(q)
          || c.email?.toLowerCase().includes(q)
          || c.socials.some(s => s.username.toLowerCase().includes(q))
          || c.nicheTags.some(n => n.toLowerCase().includes(q))
      })
  }, [initialCreators, query, showArchived])

  async function createCreator(data: { displayName: string; bio: string; nicheTags: string[]; internalNotes: string; socials: SocialRow[] }) {
    if (!data.displayName || data.displayName.length < 2) { toast.error('Enter a display name'); return }
    const socials = toSocialsPayload(data.socials)
    if (socials.length === 0) { toast.error('Add at least one social profile'); return }
    setBusyId('new')
    const res = await fetch('/api/admin/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: data.displayName, bio: data.bio || null, niche_tags: data.nicheTags, internal_notes: data.internalNotes || null, socials }),
    })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { toast.error(json.error || 'Could not create profile'); return }
    toast.success('Creator profile created')
    setCreating(false)
    router.refresh()
  }

  async function bulkImport(platform: SocialPlatform, handles: string[]) {
    if (handles.length === 0) { toast.error('Paste at least one handle'); return }
    setBusyId('bulk')
    const res = await fetch('/api/admin/creators/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, handles }),
    })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { toast.error(json.error || 'Bulk import failed'); return }
    const created = (json.created || []) as { handle: string; id: string }[]
    const failed = (json.failed || []) as { handle: string; error: string }[]
    if (created.length) toast.success(`Created ${created.length} profile${created.length !== 1 ? 's' : ''}`)
    if (failed.length) toast.error(`Skipped ${failed.length}: ${failed.slice(0, 3).map(f => f.handle).join(', ')}${failed.length > 3 ? '…' : ''}`)
    if (created.length) { setBulkAdding(false); router.refresh() }
  }

  async function editCreator(id: string, data: { displayName: string; bio: string; nicheTags: string[]; internalNotes: string; socials: SocialRow[] }) {
    const socials = toSocialsPayload(data.socials)
    if (socials.length === 0) { toast.error('Add at least one social profile'); return }
    setBusyId(id)
    const res = await fetch(`/api/admin/creators/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: data.displayName, bio: data.bio || null, niche_tags: data.nicheTags, internal_notes: data.internalNotes || null, socials }),
    })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { toast.error(json.error || 'Could not save changes'); return }
    toast.success('Saved')
    setEditingId(null)
    router.refresh()
  }

  async function archiveCreator(id: string) {
    if (!confirm('Archive this creator? They\'ll be hidden from brand discovery. You can unarchive anytime.')) return
    setBusyId(id)
    const res = await fetch(`/api/admin/creators/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { toast.error(json.error || 'Could not archive'); return }
    toast.success('Archived')
    router.refresh()
  }

  async function unarchiveCreator(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/admin/creators/${id}`, { method: 'PUT' })
    setBusyId(null)
    if (!res.ok) { toast.error('Could not unarchive'); return }
    toast.success('Unarchived')
    router.refresh()
  }

  async function generateLink(id: string, displayName: string) {
    setBusyId(id)
    const res = await fetch(`/api/admin/creators/${id}/claim-link`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) { toast.error(json.error || 'Could not generate link'); return }
    setLinkFor({ id, displayName, url: json.url, expiresAt: json.expires_at })
    router.refresh()
  }

  async function revokeLink(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/admin/creators/${id}/claim-link`, { method: 'DELETE' })
    setBusyId(null)
    if (!res.ok) { toast.error('Could not revoke link'); return }
    toast.success('Link revoked')
    if (linkFor?.id === id) setLinkFor(null)
    router.refresh()
  }

  async function updateRequestStatus(requestId: string, status: RequestStatus) {
    setBusyRequestId(requestId)
    const res = await fetch(`/api/admin/pending-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusyRequestId(null)
    if (!res.ok) { toast.error('Could not update status'); return }
    router.refresh()
  }

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {!creating && !bulkAdding && (
          <>
            <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setCreating(true)}>
              <Plus size={16} /> Add creator
            </button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setBulkAdding(true)}>
              <Upload size={14} /> Bulk add
            </button>
          </>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 text-sm" placeholder="Search name, handle, niche…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={() => setShowArchived(v => !v)}>
          {showArchived ? 'Show active' : 'Show archived'}
        </button>
      </div>

      {creating && <CreatorForm busy={busyId === 'new'} onCancel={() => setCreating(false)} onSubmit={createCreator} />}
      {bulkAdding && <BulkAddForm busy={busyId === 'bulk'} onCancel={() => setBulkAdding(false)} onSubmit={bulkImport} />}

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} className="card">
            {editingId === c.id ? (
              <CreatorForm
                busy={busyId === c.id}
                initial={{ displayName: c.displayName, bio: c.bio, nicheTags: c.nicheTags, internalNotes: c.internalNotes, socials: c.socials }}
                onCancel={() => setEditingId(null)}
                onSubmit={(data) => editCreator(c.id, data)}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{c.displayName}</p>
                    <CreatorActiveBadge claimed={c.claimed} onboardingCompleted={c.onboardingCompleted} />
                    {c.archived && <span className="badge badge-gray">Archived</span>}
                    {c.email && <span className="text-xs text-gray-400">{c.email}</span>}
                  </div>
                  {c.nicheTags.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{c.nicheTags.map(n => NICHE_LABELS[n as CreatorNiche] ?? n).join(', ')}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {c.socials.map(s => `@${s.username} (${s.platform})`).join(' · ')}
                  </p>
                  {!c.claimed && c.activeClaimExpiresAt && (
                    <p className="text-xs mt-1" style={{ color: 'var(--accent-deep)' }}>
                      Active claim link · expires {new Date(c.activeClaimExpiresAt).toLocaleDateString()}
                    </p>
                  )}
                  {c.internalNotes && (
                    <p className="text-xs mt-1 italic text-gray-400">{c.internalNotes}</p>
                  )}
                  {c.requests.length > 0 && (
                    <div className="mt-1.5">
                      <button type="button" onClick={() => toggleExpanded(c.id)}
                        className="text-xs inline-flex items-center gap-1 text-gray-500 hover:text-gray-700">
                        {expandedIds.has(c.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {c.requests.length} request{c.requests.length !== 1 ? 's' : ''}
                      </button>
                      {expandedIds.has(c.id) && (
                        <RequestsTable requests={c.requests} busyRequestId={busyRequestId} onStatusChange={updateRequestStatus} />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!c.claimed && !c.archived && (
                    <>
                      <button type="button" title="Generate/regenerate claim link" onClick={() => generateLink(c.id, c.displayName)} disabled={busyId === c.id}
                        className="btn-secondary text-xs inline-flex items-center gap-1 px-2 py-1.5">
                        <RefreshCw size={13} /> Link
                      </button>
                      {c.activeClaimExpiresAt && (
                        <button type="button" title="Revoke claim link" onClick={() => revokeLink(c.id)} disabled={busyId === c.id}
                          className="btn-secondary text-xs inline-flex items-center gap-1 px-2 py-1.5">
                          <Ban size={13} />
                        </button>
                      )}
                    </>
                  )}
                  {!c.archived && (
                    <button type="button" title="Edit" onClick={() => setEditingId(c.id)} disabled={busyId === c.id}
                      className="btn-secondary text-xs inline-flex items-center gap-1 px-2 py-1.5">
                      <Pencil size={13} />
                    </button>
                  )}
                  {c.archived ? (
                    <button type="button" title="Unarchive" onClick={() => unarchiveCreator(c.id)} disabled={busyId === c.id}
                      className="btn-secondary text-xs inline-flex items-center gap-1 px-2 py-1.5">
                      <ArchiveRestore size={13} />
                    </button>
                  ) : (
                    <button type="button" title="Archive" onClick={() => archiveCreator(c.id)} disabled={busyId === c.id}
                      className="btn-secondary text-xs inline-flex items-center gap-1 px-2 py-1.5">
                      <Archive size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No creator profiles {query ? 'match your search' : showArchived ? 'archived' : 'yet'}.</p>
        )}
      </div>

      {linkFor && (
        <div role="dialog" aria-modal="true" onClick={() => setLinkFor(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(10,12,34,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 460 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Claim link</h3>
              <button type="button" onClick={() => setLinkFor(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Send this to the creator. It works once and expires {new Date(linkFor.expiresAt).toLocaleDateString()}.</p>
            <div className="flex gap-2 mb-2">
              <input className="input text-xs" readOnly value={linkFor.url} onFocus={e => e.target.select()} />
              <button type="button" className="btn-secondary inline-flex items-center gap-1 flex-shrink-0" onClick={() => copyText(linkFor.url, 'Link')}>
                <Copy size={14} /> Copy
              </button>
            </div>
            <button type="button" className="btn-secondary btn-block inline-flex items-center justify-center gap-2"
              onClick={() => copyText(outreachMessage(linkFor.displayName, linkFor.url), 'Message')}>
              <MessageSquareText size={14} /> Copy outreach message
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
