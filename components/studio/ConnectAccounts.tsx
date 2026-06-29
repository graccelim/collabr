'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Unplug, RefreshCw, CheckCircle2, AlertCircle, Settings2, X, ChevronRight } from 'lucide-react'
import { socialIcon } from '@/components/SocialIcon'

export interface ConnectedAccountView {
  id: string
  platform: string
  status: string
  last_synced_at: string | null
  sync_frozen: boolean
}

const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }

function lastSynced(iso: string | null): string {
  if (!iso) return 'Not synced yet'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'Synced today'
  return `Last synced ${d} day${d === 1 ? '' : 's'} ago`
}

// First-party connect (no Phyllo). All platforms use our OAuth redirect. Connect is
// instant; the first sync runs on the Studio page. Disconnect deletes the account's
// data with a loading state. Rendered as a compact one-liner that opens a popup.
export default function ConnectAccounts({
  accounts, readOnly = false, connectable = [],
}: { accounts: ConnectedAccountView[]; readOnly?: boolean; connectable?: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null) // platform label being synced
  const [disconnecting, setDisconnecting] = useState<string | null>(null) // platform label being removed
  const [step, setStep] = useState(0)
  const [pending, startTransition] = useTransition()
  // Set right before router.refresh() so we keep the loading panel up until the
  // server re-render actually COMMITS (otherwise the modal closes onto stale
  // content for a beat). Cleared once the refresh transition finishes.
  const finishing = useRef(false)

  useEffect(() => {
    if (finishing.current && !pending) {
      finishing.current = false
      setSyncing(null); setDisconnecting(null); setOpen(false)
    }
  }, [pending])

  const SYNC_STEPS = ['Pulling your latest posts', 'Analysing your content', 'Building your insights']
  useEffect(() => {
    if (!syncing) return
    setStep(0)
    const id = setInterval(() => setStep((s) => (s + 1) % SYNC_STEPS.length), 2200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing])

  const connected = accounts.filter((a) => a.status === 'connected')
  const connectedPlatforms = new Set(connected.map((a) => a.platform))
  const canConnect = connectable.filter((p) => !connectedPlatforms.has(p))
  const anyFrozen = connected.some((a) => a.sync_frozen)


  async function disconnect(id: string, label: string) {
    setDisconnecting(label); setErr(null)
    try {
      const res = await fetch(`/api/connected/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('disconnect failed')
      // Keep the loading panel up until the refreshed (account-removed) page commits.
      finishing.current = true
      startTransition(() => router.refresh())
    } catch {
      setDisconnecting(null); setErr('Could not disconnect.')
    }
  }

  async function syncNow(id: string, label: string) {
    setSyncing(label); setErr(null)
    try {
      const res = await fetch(`/api/connected/${id}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // Keep the loading panel up until the freshly-synced board commits, then
        // close (otherwise the popup shuts onto stale content for a beat).
        finishing.current = true
        startTransition(() => router.refresh())
      } else {
        setSyncing(null); setErr(data.error || 'Could not sync right now.')
      }
    } catch {
      setSyncing(null); setErr('Could not sync right now.')
    }
  }

  const summary = connected.length === 0
    ? 'No accounts connected yet'
    : `${connected.length} account${connected.length === 1 ? '' : 's'} connected${anyFrozen ? ' · syncing paused' : ' · synced'}`
  const dot = connected.length === 0 ? 'var(--ink-faint-solid)' : anyFrozen ? 'var(--warn, #B26A1E)' : 'var(--money-deep)'

  return (
    <>
      {/* one-liner */}
      <button type="button" onClick={() => setOpen(true)} style={{
        width: '100%', cursor: 'pointer', textAlign: 'left', background: 'var(--surface, #fff)',
        border: '1px solid var(--hairline, rgba(20,30,80,.1))', borderRadius: 12, padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flex: 'none' }} />
        <span className="ca-glyphs" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          {connected.length > 0
            ? connected.map((a) => { const G = socialIcon(a.platform); return <G key={a.id} size={16} /> })
            : null}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', flex: 'none' }}>
          <Settings2 size={14} /> <span className="ca-manage-label">Manage</span> <ChevronRight size={14} />
        </span>
      </button>

      {/* manage popup */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,10,30,.5)', backdropFilter: 'blur(3px)', overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
            <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(460px, 100%)', padding: 20, position: 'relative' }}>
              <button aria-label="Close" onClick={() => setOpen(false)} style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 999, border: '1px solid var(--hairline, rgba(20,30,80,.12))', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={15} color="var(--ink-soft)" />
              </button>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Connected accounts</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Sync performance from TikTok, Instagram and YouTube. No passwords are shared with Collabr.
              </p>

              {syncing || disconnecting ? (
                <div style={{ padding: '28px 8px 36px', textAlign: 'center' }}>
                  <div style={{ width: 42, height: 42, margin: '0 auto 16px', borderRadius: 999, border: '3px solid var(--hairline, rgba(20,30,80,.12))', borderTopColor: 'var(--accent, #000435)', animation: 'cp-spin .8s linear infinite' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                    {disconnecting ? `Disconnecting ${disconnecting}` : `Syncing your ${syncing}`}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6, minHeight: 18 }}>
                    {disconnecting ? 'Removing your posts and insights' : SYNC_STEPS[step]}…
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 14 }}>
                    {disconnecting ? 'This only takes a moment.' : 'This usually takes a few seconds.'}
                  </div>
                </div>
              ) : (
              <>
              {accounts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {accounts.map((a) => (
                    <div key={a.id} className="card ca-acct-row" style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      {a.status === 'connected' && !a.sync_frozen
                        ? <CheckCircle2 size={16} color="var(--money-deep)" />
                        : <AlertCircle size={16} color="var(--warn, #B26A1E)" />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{LABEL[a.platform] || a.platform}</div>
                        <div style={{ fontSize: 12, color: a.sync_frozen ? 'var(--warn-deep, #8a531a)' : 'var(--ink-faint-solid)' }}>
                          {a.status === 'revoked' ? 'Disconnected' : a.sync_frozen ? `Syncing paused · ${lastSynced(a.last_synced_at)}` : lastSynced(a.last_synced_at)}
                        </div>
                      </div>
                      {!readOnly && a.status === 'connected' && (
                        <div className="ca-acct-actions" style={{ display: 'flex', gap: 6, flex: 'none' }}>
                          <button type="button" className="btn-secondary btn-sm" onClick={() => syncNow(a.id, LABEL[a.platform] || a.platform)} disabled={!!syncing || !!disconnecting}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <RefreshCw size={13} /> Sync now
                          </button>
                          <button type="button" className="btn-ghost btn-sm" onClick={() => disconnect(a.id, LABEL[a.platform] || a.platform)} disabled={!!syncing || !!disconnecting}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Unplug size={13} /> Disconnect
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {readOnly ? (
                <p style={{ fontSize: 12.5, color: 'var(--warn-deep, #8a531a)' }}>
                  <RefreshCw size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  Syncing is paused while Creator Pro is inactive. Renew to resume.
                </p>
              ) : canConnect.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--ink-faint-solid)' }}>
                  {connectable.length === 0 ? 'Account connections are being set up.' : 'All available platforms are connected.'}
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {canConnect.map((p) => (
                    <a key={p} href={`/api/connected/oauth/${p}/start`} className="btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                      <Plus size={13} /> Connect {LABEL[p] || p}
                    </a>
                  ))}
                </div>
              )}
              </>
              )}

              {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #B23A33)', marginTop: 10 }}>{err}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
