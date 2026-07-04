import CollabResultsForm from '@/components/CollabResultsForm'
import CollabResultsView from '@/components/CollabResultsView'
import ResultsSummary from '@/components/ResultsSummary'
import CreatorTrust from '@/components/CreatorTrust'
import { aggregateResults } from '@/lib/results/report'

// TEMPORARY preview of the self-reported results UI (sample data). Visible in
// production so it can be eyeballed on the live site. REMOVE once reviewed.
// Each block mocks the real page; the dashed outline marks the NEW component.
export default function TempResultsPreview() {
  const sample = { views: 24500, likes: 1820, comments: 96, shares: 210, saves: 340, post_url: 'https://www.tiktok.com/@sample/video/123', reported_at: new Date().toISOString() }
  const agg = aggregateResults([
    { views: 24500, likes: 1820, comments: 96, shares: 210, saves: 340 },
    { views: 12800, likes: 940, comments: 41, shares: 88, saves: 120 },
    { views: 6100, likes: 510, comments: 22, shares: 30, saves: 60 },
  ])

  const Frame = ({ page, children }: { page: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A909C', marginBottom: 8 }}>Page · {page}</div>
      <div style={{ border: '1px solid rgba(20,30,80,.1)', borderRadius: 16, background: 'var(--app-bg, #F4F6FB)', padding: 16 }}>{children}</div>
    </div>
  )
  const Mock = ({ label, h = 52 }: { label: string; h?: number }) => (
    <div className="card" style={{ padding: 14, opacity: 0.6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8A909C' }}>{label}</div>
      <div style={{ height: h, borderRadius: 8, background: 'rgba(20,30,80,.05)', marginTop: 8 }} />
    </div>
  )
  const New = ({ children }: { children: React.ReactNode }) => (
    <div style={{ outline: '2px dashed rgba(91,83,224,.45)', outlineOffset: 4, borderRadius: 16 }}>{children}</div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 90px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Results feature preview</h1>
      <p style={{ fontSize: 13.5, color: '#545A66', marginBottom: 4 }}>Sample data only. Temporary preview, will be removed.</p>
      <p style={{ fontSize: 12.5, color: '#8A909C', marginBottom: 28 }}>The <span style={{ color: '#5B53E0', fontWeight: 600 }}>dashed purple outline</span> is the new piece; greyed cards are the rest of the page.</p>

      <Frame page="Collab detail — creator, after the post is live">
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Mock label="Brief & chat" h={40} />
          <div className="card" style={{ padding: 14 }}>
            <span className="badge badge-safe">Live</span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--creator-deep, #5B53E0)', marginTop: 8 }}>tiktok.com/@you/video/123</div>
          </div>
          <New><CollabResultsForm collabId="preview" existing={null} /></New>
          <Mock label="Leave a review" h={40} />
        </div>
      </Frame>

      <Frame page="Collab detail — brand, read-only">
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Mock label="Live post" h={30} />
          <New><CollabResultsView result={sample} /></New>
        </div>
      </Frame>

      <Frame page="Campaign detail — brand, right rail">
        <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
          <Mock label="Applicants" h={150} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <New><ResultsSummary agg={agg} title="Campaign results" reportedOf="3 creators reported" /></New>
            <Mock label="The brief" />
          </div>
        </div>
      </Frame>

      <Frame page="Creator profile — Trust & reliability">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Mock label="Profile header" h={36} />
          <div style={{ marginTop: 14 }}>
            <New><CreatorTrust completedCount={12} completionRate={0.96} responseTimeMedianHours={5} disputesCount={0} ratingAvg={4.8} ratingCount={9} repeatBrands={3} reportsResults /></New>
          </div>
        </div>
      </Frame>
    </div>
  )
}
