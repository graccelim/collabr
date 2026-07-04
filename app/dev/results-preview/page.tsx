import { notFound } from 'next/navigation'
import CollabResultsForm from '@/components/CollabResultsForm'
import CollabResultsView from '@/components/CollabResultsView'
import ResultsSummary from '@/components/ResultsSummary'
import CreatorTrust from '@/components/CreatorTrust'
import { aggregateResults } from '@/lib/results/report'

// Dev/preview-only visual gallery for the self-reported results feature. 404s in
// production (VERCEL_ENV === 'production'), so it never ships to real users. On a
// Vercel Preview deployment (a non-main branch) VERCEL_ENV is 'preview' → visible.
export default function ResultsPreviewPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()

  const sample = { views: 24500, likes: 1820, comments: 96, shares: 210, saves: 340, reach: 31000, post_url: 'https://www.tiktok.com/@sample/video/123', reported_at: new Date().toISOString() }
  const agg = aggregateResults([
    { views: 24500, likes: 1820, comments: 96, shares: 210, saves: 340, reach: 31000 },
    { views: 12800, likes: 940, comments: 41, shares: 88, saves: 120, reach: 16500 },
    { views: 6100, likes: 510, comments: 22, shares: 30, saves: 60, reach: 9000 },
  ])

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 34 }}>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A909C', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Results feature preview</h1>
      <p style={{ fontSize: 13.5, color: '#545A66', marginBottom: 28 }}>Sample data only. This page is hidden in production.</p>

      <Section title="Creator — add / edit results (on a completed collab)">
        <CollabResultsForm collabId="preview" existing={null} />
      </Section>

      <Section title="Brand — reported results (read-only, per collab)">
        <CollabResultsView result={sample} />
      </Section>

      <Section title="Brand — campaign aggregate (rail card)">
        <ResultsSummary agg={agg} title="Campaign results" reportedOf="3 creators reported" />
      </Section>

      <Section title="Brand — campaign aggregate (no data yet)">
        <ResultsSummary agg={aggregateResults([])} title="Campaign results" />
      </Section>

      <Section title="Creator profile — trust tile (includes 'Shares results')">
        <CreatorTrust completedCount={12} completionRate={0.96} responseTimeMedianHours={5} disputesCount={0} ratingAvg={4.8} ratingCount={9} repeatBrands={3} reportsResults />
      </Section>
    </div>
  )
}
