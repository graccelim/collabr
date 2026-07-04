import { BarChart3, ExternalLink, Eye, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react'

// Read-only display of a creator's self-reported results for one collab. Shown to
// the brand (and to the creator alongside the edit form). Clearly labelled.
type Result = { views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; post_url: string | null; reported_at?: string | null }

const FIELDS: { key: keyof Result; label: string; Icon: typeof Eye }[] = [
  { key: 'views', label: 'Views', Icon: Eye },
  { key: 'likes', label: 'Likes', Icon: Heart },
  { key: 'comments', label: 'Comments', Icon: MessageCircle },
  { key: 'shares', label: 'Shares', Icon: Share2 },
  { key: 'saves', label: 'Saves', Icon: Bookmark },
]
const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString())

export default function CollabResultsView({ result }: { result: Result }) {
  const shown = FIELDS.filter((f) => result[f.key] != null)
  const tiles = shown.length ? shown : FIELDS.slice(0, 3)
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BarChart3 size={16} style={{ color: 'var(--accent-deep, #2A3157)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Reported results</h3>
        </div>
        <span className="badge badge-neutral" style={{ fontSize: 11 }}>Self-reported</span>
      </div>

      <div className="result-tiles" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(5, tiles.length)}, 1fr)`, gap: 10 }}>
        {tiles.map((f) => (
          <div key={String(f.key)} style={{ background: 'linear-gradient(140deg,#EEF3FD,#F6F9FF)', border: '1px solid rgba(40,90,190,.12)', borderRadius: 11, padding: '11px 12px' }}>
            <div className="mono-num" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{fmt(result[f.key] as number | null)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <f.Icon size={12} style={{ color: 'var(--accent-deep, #5B6191)', flex: 'none' }} />
              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{f.label}</span>
            </div>
          </div>
        ))}
      </div>

      {result.post_url && (
        <a href={result.post_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep, #2A3157)', textDecoration: 'none' }}>
          <ExternalLink size={13} /> View the post
        </a>
      )}
    </div>
  )
}
