export default function CollabsLoading() {
  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div className="skel" style={{ width: 110, height: 24, borderRadius: 6, marginBottom: 28 }} />
      <div className="skel" style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 12 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
            <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ width: '50%', height: 14, borderRadius: 4, marginBottom: 7 }} />
              <div className="skel" style={{ width: '30%', height: 12, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div className="skel" style={{ width: 84, height: 20, borderRadius: 6 }} />
              <div className="skel" style={{ width: 120, height: 12, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
