// Loading fallback for public pages (jobs/[slug], brands/[slug]) — these are
// async with several awaits, and link-shared, so a blank screen during fetch
// looked broken. A light skeleton until the page streams in.
export default function PublicLoading() {
  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ height: 18, width: 90, background: 'var(--paper-2)', borderRadius: 8, marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 28 }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--paper-2)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 26, width: '55%', background: 'var(--paper-2)', borderRadius: 8, marginBottom: 10 }} />
          <div style={{ height: 14, width: '35%', background: 'var(--paper-2)', borderRadius: 8 }} />
        </div>
      </div>
      <div className="card" style={{ height: 140, background: 'var(--paper-2)', border: 'none' }} />
    </div>
  )
}
