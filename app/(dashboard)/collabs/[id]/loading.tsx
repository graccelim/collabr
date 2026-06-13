export default function CollabDetailLoading() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Deal header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="skel" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          <div>
            <div className="skel" style={{ width: 220, height: 18, borderRadius: 5 }} />
            <div className="skel" style={{ width: 120, height: 13, borderRadius: 4, marginTop: 8 }} />
          </div>
        </div>
        <div className="skel" style={{ width: 120, height: 34, borderRadius: 8 }} />
      </div>

      {/* Escrow strip */}
      <div className="skel" style={{ height: 44, borderRadius: 8, marginBottom: 24 }} />

      {/* Two-column grid */}
      <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="skel" style={{ width: 60, height: 13, borderRadius: 4, marginBottom: 12 }} />
            <div className="skel" style={{ width: '100%', height: 12, borderRadius: 4, marginBottom: 8 }} />
            <div className="skel" style={{ width: '85%', height: 12, borderRadius: 4, marginBottom: 8 }} />
            <div className="skel" style={{ width: '60%', height: 12, borderRadius: 4 }} />
          </div>
          <div className="card">
            <div className="skel" style={{ width: 130, height: 13, borderRadius: 4, marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div className="skel" style={{ width: 70, height: 18, borderRadius: 4, margin: '0 auto 6px' }} />
                  <div className="skel" style={{ width: 50, height: 11, borderRadius: 4, margin: '0 auto' }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline skeleton */}
        <div className="card">
          <div className="skel" style={{ width: 70, height: 12, borderRadius: 4, marginBottom: 16 }} />
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <div className="skel" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skel" style={{ width: 110 + (i % 3) * 20, height: 12, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
