export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="skel" style={{ width: 180, height: 32, borderRadius: 8 }} />
          <div className="skel" style={{ width: 140, height: 16, borderRadius: 6, marginTop: 8 }} />
        </div>
        <div className="skel" style={{ width: 140, height: 42, borderRadius: 999 }} />
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="pc-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="skel" style={{ width: '60%', height: 14, borderRadius: 6 }} />
            <div className="skel" style={{ width: '40%', height: 30, borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* Section heading */}
      <div className="skel" style={{ width: 140, height: 18, borderRadius: 6 }} />

      {/* List rows */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skel" style={{ width: 180, height: 15, borderRadius: 5 }} />
            <div className="skel" style={{ width: 110, height: 13, borderRadius: 5 }} />
          </div>
          <div className="skel" style={{ width: 72, height: 22, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  )
}
