export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="skel" style={{ width: 160, height: 24, borderRadius: 6 }} />
          <div className="skel" style={{ width: 120, height: 13, borderRadius: 5, marginTop: 8 }} />
        </div>
        <div className="skel" style={{ width: 120, height: 34, borderRadius: 8 }} />
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }} className="pc-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skel" style={{ width: '60%', height: 12, borderRadius: 5 }} />
            <div className="skel" style={{ width: '40%', height: 24, borderRadius: 5 }} />
          </div>
        ))}
      </div>

      {/* Section heading */}
      <div className="skel" style={{ width: 120, height: 15, borderRadius: 5, marginTop: 8 }} />

      {/* Table-style rows */}
      <div className="table-wrap">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: i < 4 ? '1px solid var(--line)' : 'none',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="skel" style={{ width: 180, height: 13, borderRadius: 4 }} />
              <div className="skel" style={{ width: 100, height: 11, borderRadius: 4 }} />
            </div>
            <div className="skel" style={{ width: 64, height: 20, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
