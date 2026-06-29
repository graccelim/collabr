'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Zap, AlignLeft, Send, Hash, Video, Copy } from 'lucide-react'
import PlatformSwitcher from '@/components/studio/PlatformSwitcher'


type Result = {
  hooks: string[]; captions: string[]; ctas: string[]; hashtags: string[]
  videos: { title: string; structure: string }[]; tailored: string | null
}
type CatKey = 'hooks' | 'captions' | 'ctas' | 'hashtags' | 'videos'
const CATS: { key: CatKey; label: string; accent: string; icon: typeof Zap }[] = [
  { key: 'hooks', label: 'Hooks', accent: '#5B53E0', icon: Zap },
  { key: 'captions', label: 'Captions', accent: '#0A0C22', icon: AlignLeft },
  { key: 'ctas', label: 'CTA ideas', accent: '#157A55', icon: Send },
  { key: 'hashtags', label: 'Hashtags', accent: '#5B53E0', icon: Hash },
  { key: 'videos', label: 'Post ideas', accent: '#0A0C22', icon: Video },
]

const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 16, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, ui-monospace, monospace)"
const EYEBROW: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A909C' }
const FIELD: React.CSSProperties = { fontSize: 14, color: '#0E1016', background: '#F7F8FC', border: '1px solid rgba(20,30,80,.12)', borderRadius: 10, padding: '11px 13px', outline: 'none', width: '100%' }

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => toast.error('Could not copy'))
}
function catText(r: Result, cat: CatKey): string {
  if (cat === 'videos') return r.videos.map((v) => `${v.title}: ${v.structure}`).join('\n')
  if (cat === 'hashtags') return r.hashtags.join(' ')
  return (r[cat] as string[]).join('\n')
}

export default function ContentLab({ platforms = [] }: { platforms?: string[] }) {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState(platforms[0] ?? 'tiktok')
  const [result, setResult] = useState<Result | null>(null)
  const [cat, setCat] = useState<CatKey>('hooks')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function generate() {
    if (!topic.trim() || loading) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/insights/content-lab', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), platform }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.result) { setResult(data.result); setCat('hooks') }
      else setErr(res.status === 503 ? 'Content Lab is being set up. Check back soon.' : data.error || 'Could not generate ideas.')
    } catch { setErr('Could not generate ideas.') }
    setLoading(false)
  }

  const active = CATS.find((c) => c.key === cat)!
  const count = (k: CatKey) => (result ? (result[k] as unknown[]).length : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* per-platform switcher — only the creator's OWN platforms (not hardcoded) */}
      {platforms.length > 0 && <PlatformSwitcher platforms={platforms} active={platform} onSelect={setPlatform} />}

      {/* light form card */}
      <div style={{ ...CARD, padding: 18 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={EYEBROW}>Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Western hawker food" style={FIELD}
              onKeyDown={(e) => { if (e.key === 'Enter') generate() }} />
          </label>
          <button type="button" onClick={generate} disabled={loading || !topic.trim()}
            style={{ cursor: topic.trim() ? 'pointer' : 'not-allowed', background: '#0A0C22', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 24px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', opacity: topic.trim() ? 1 : 0.55 }}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {err && <div style={{ ...CARD, padding: 14, fontSize: 13, color: '#B23A33' }}>{err}</div>}

      {!result && !err && (
        <div style={{ ...CARD, padding: '28px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: '#545A66', margin: 0 }}>Enter a topic and generate hooks, captions, CTAs, hashtags and video ideas based on your own winning patterns.</p>
        </div>
      )}

      {result && (
        <>
          <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '212px 1fr', gap: 16, alignItems: 'start' }}>
            {/* category menu */}
            <div style={{ ...CARD, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {CATS.map((c) => {
                const on = c.key === cat
                const Icon = c.icon
                return (
                  <button key={c.key} type="button" onClick={() => setCat(c.key)}
                    style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', border: 'none', borderRadius: 11, background: on ? `${c.accent}12` : 'transparent', width: '100%' }}>
                    <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: on ? c.accent : '#EEF1F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={on ? '#fff' : '#8A909C'} />
                    </span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: on ? '#0E1016' : '#545A66' }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: '#B4B9C4' }}>{count(c.key)}</span>
                  </button>
                )
              })}
            </div>

            {/* panel */}
            <div style={{ ...CARD, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, marginBottom: 4, borderBottom: '1px solid rgba(14,16,22,.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: `${active.accent}16`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <active.icon size={16} color={active.accent} />
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: '#0E1016' }}>{active.label}</span>
                  <span style={{ fontSize: 12, color: '#B4B9C4' }}>{count(active.key)}</span>
                </div>
                <button type="button" onClick={() => copy(catText(result, cat))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: active.accent }}>
                  <Copy size={14} color={active.accent} /> Copy all
                </button>
              </div>
              {cat === 'hashtags' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 12 }}>
                  {result.hashtags.map((t, i) => (
                    <button key={i} type="button" onClick={() => copy(t)} style={{ cursor: 'pointer', fontSize: 13, color: '#5B53E0', background: '#F1F0FE', border: '1px solid rgba(91,83,224,.2)', borderRadius: 999, padding: '7px 13px' }}>{t}</button>
                  ))}
                </div>
              ) : cat === 'videos' ? (
                result.videos.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: i ? '15px 0' : '12px 0 15px', borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none' }}>
                    <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: '#F1F5FC', border: '1px solid rgba(20,30,80,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, color: '#0A0C22' }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0E1016' }}>{v.title}</div>
                      <div style={{ fontSize: 12.5, color: '#8A909C', marginTop: 2 }}>{v.structure}</div>
                    </div>
                  </div>
                ))
              ) : (
                (result[cat] as string[]).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: i ? '14px 0' : '12px 0 14px', borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: '#C4CAD6', marginTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.5, color: '#0E1016' }}>{t}</span>
                    </div>
                    <button type="button" onClick={() => copy(t)} aria-label="Copy" style={{ flex: 'none', border: 'none', background: 'transparent', cursor: 'pointer', marginTop: 2 }}><Copy size={15} color="#B4B9C4" /></button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: '#B4B9C4', textAlign: 'center' }}>
            {result.tailored ? `${result.tailored} · ` : ''}Suggestions are based on available data and may not guarantee results.
          </div>
        </>
      )}
    </div>
  )
}
