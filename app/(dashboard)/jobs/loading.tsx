export default function JobsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 880, margin: '0 auto' }}>
      <div>
        <div className="skel" style={{ width: 230, height: 26, borderRadius: 6 }} />
        <div className="skel" style={{ width: 170, height: 14, borderRadius: 4, marginTop: 8 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="skel" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ width: 100, height: 11, borderRadius: 4, marginBottom: 8 }} />
              <div className="skel" style={{ width: '60%', height: 15, borderRadius: 4, marginBottom: 10 }} />
              <div className="skel" style={{ width: '90%', height: 12, borderRadius: 4, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <div className="skel" style={{ width: 70, height: 20, borderRadius: 6 }} />
                <div className="skel" style={{ width: 56, height: 20, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
