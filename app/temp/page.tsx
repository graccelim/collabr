import CollabResultsForm from '@/components/CollabResultsForm'
import CollabResultsView from '@/components/CollabResultsView'
import ResultsSummary from '@/components/ResultsSummary'
import CreatorTrust from '@/components/CreatorTrust'
import { aggregateResults } from '@/lib/results/report'

// TEMPORARY preview of the self-reported results UI (sample data). Visible in
// production so it can be eyeballed on the live site. REMOVE once reviewed.
// ?embed=1 renders just the gallery (used inside the phone-frame iframe below,
// which gets a real ≤768px viewport so the mobile layout actually triggers).
export default function TempResultsPreview({ searchParams }: { searchParams?: { embed?: string } }) {
  const embed = searchParams?.embed === '1'

  const sample = { views: 24500, likes: 1820, comments: 96, shares: 210, saves: 340, post_url: 'https://www.tiktok.com/@sample/video/123', reported_at: new Date().toISOString() }
  const agg = aggregateResults([
    { views: 24500, likes: 1820, comments: 96, shares: 210, saves: 340 },
    { views: 12800, likes: 940, comments: 41, shares: 88, saves: 120 },
    { views: 6100, likes: 510, comments: 22, shares: 30, saves: 60 },
  ])

  const Frame = ({ page, children }: { page: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A909C', marginBottom: 8 }}>Page · {page}</div>
      <div style={{ border: '1px solid rgba(20,30,80,.1)', borderRadius: 16, background: 'var(--app-bg, #F4F6FB)', padding: 14 }}>{children}</div>
    </div>
  )
  const Mock = ({ label, h = 44 }: { label: string; h?: number }) => (
    <div className="card" style={{ padding: 12, opacity: 0.6 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8A909C' }}>{label}</div>
      <div style={{ height: h, borderRadius: 8, background: 'rgba(20,30,80,.05)', marginTop: 8 }} />
    </div>
  )
  const New = ({ children }: { children: React.ReactNode }) => (
    <div style={{ outline: '2px dashed rgba(91,83,224,.45)', outlineOffset: 4, borderRadius: 16 }}>{children}</div>
  )

  const gallery = (
    <>
      <Frame page="Collab detail — creator, after the post is live">
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Mock label="Brief & chat" h={34} />
          <div className="card" style={{ padding: 12 }}>
            <span className="badge badge-safe">Live</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--creator-deep, #5B53E0)', marginTop: 8, wordBreak: 'break-all' }}>tiktok.com/@you/video/123</div>
          </div>
          <New><CollabResultsForm collabId="preview" existing={null} /></New>
        </div>
      </Frame>

      <Frame page="Collab detail — brand, read-only">
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Mock label="Live post" h={26} />
          <New><CollabResultsView result={sample} /></New>
        </div>
      </Frame>

      <Frame page="Campaign detail — brand, right rail">
        <div className="resp-1col" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, alignItems: 'start' }}>
          <Mock label="Applicants" h={130} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <New><ResultsSummary agg={agg} title="Campaign results" reportedOf="3 creators reported" /></New>
            <Mock label="The brief" />
          </div>
        </div>
      </Frame>

      <Frame page="Creator profile — Trust & reliability">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Mock label="Profile header" h={30} />
          <div style={{ marginTop: 12 }}>
            <New><CreatorTrust completedCount={12} completionRate={0.96} responseTimeMedianHours={5} disputesCount={0} ratingAvg={4.8} ratingCount={9} repeatBrands={3} reportsResults /></New>
          </div>
        </div>
      </Frame>
    </>
  )

  if (embed) return <div style={{ padding: 12 }}>{gallery}</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 90px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Results feature preview</h1>
      <p style={{ fontSize: 13.5, color: '#545A66', marginBottom: 4 }}>Sample data only. Temporary preview, will be removed.</p>
      <p style={{ fontSize: 12.5, color: '#8A909C', marginBottom: 26 }}>The <span style={{ color: '#5B53E0', fontWeight: 600 }}>dashed purple outline</span> is the new piece. Below: mobile on the left, desktop on the right.</p>

      <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Mobile — a real 390px viewport via the iframe */}
        <div style={{ flex: 'none' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1016', marginBottom: 8 }}>📱 Mobile (390px)</div>
          <div style={{ width: 390, height: 720, border: '10px solid #0A0C22', borderRadius: 34, overflow: 'hidden', boxShadow: '0 30px 60px -30px rgba(20,30,80,.5)' }}>
            <iframe src="/temp?embed=1" title="Mobile preview" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
          </div>
          <div style={{ fontSize: 11.5, color: '#8A909C', marginTop: 8, width: 390 }}>Scroll inside the phone. This is the true ≤768px layout.</div>
        </div>

        {/* Desktop */}
        <div style={{ flex: '1 1 460px', minWidth: 320 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1016', marginBottom: 8 }}>🖥 Desktop</div>
          {gallery}
        </div>
      </div>
    </div>
  )
}
