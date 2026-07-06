export default function DashboardLoading() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginTop: 8, marginBottom: 44 }}>
        <div className="skel" style={{ width: 280, height: 30, borderRadius: 7 }} />
        <div className="skel" style={{ width: '100%', maxWidth: 360, height: 15, borderRadius: 5, marginTop: 12 }} />
      </div>

      {/* Dark money panel */}
      <div className="skel" style={{ height: 132, borderRadius: 'var(--radius-lg)', marginBottom: 14 }} />

      {/* Attention row */}
      <div className="skel" style={{ height: 54, borderRadius: 'var(--radius)', marginBottom: 48 }} />

      {/* Quiet list */}
      <div className="skel" style={{ width: 170, height: 11, borderRadius: 4, marginBottom: 14 }} />
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          borderTop: '1px solid var(--line)', padding: '17px 2px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skel" style={{ width: 38, height: 38, borderRadius: '50%' }} />
            <div>
              <div className="skel" style={{ width: 130, height: 13, borderRadius: 4, marginBottom: 7 }} />
              <div className="skel" style={{ width: 180, height: 11, borderRadius: 4 }} />
            </div>
          </div>
          <div className="skel" style={{ width: 60, height: 13, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}
