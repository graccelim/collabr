export default function CreatorProfileLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="skel" style={{ width: 70, height: 12, borderRadius: 4 }} />
      <div className="card">
        <div style={{ display: 'flex', gap: 16 }}>
          <div className="skel" style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ width: 160, height: 17, borderRadius: 5, marginBottom: 8 }} />
            <div className="skel" style={{ width: 110, height: 12, borderRadius: 4, marginBottom: 6 }} />
            <div className="skel" style={{ width: 90, height: 11, borderRadius: 4 }} />
          </div>
        </div>
        <div className="skel" style={{ width: '85%', height: 12, borderRadius: 4, marginTop: 16 }} />
        <div className="skel" style={{ width: '60%', height: 12, borderRadius: 4, marginTop: 8 }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card">
            <div className="skel" style={{ width: 50, height: 11, borderRadius: 4, marginBottom: 8 }} />
            <div className="skel" style={{ width: 90, height: 16, borderRadius: 5 }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skel" style={{ width: 120, height: 13, borderRadius: 4, marginBottom: 14 }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="skel" style={{ width: 140, height: 13, borderRadius: 4 }} />
            <div className="skel" style={{ width: 90, height: 13, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
