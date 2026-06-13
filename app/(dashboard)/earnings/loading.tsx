export default function EarningsLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="skel" style={{ width: 110, height: 22, borderRadius: 6 }} />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card">
            <div className="skel" style={{ width: 90, height: 24, borderRadius: 5, marginBottom: 8 }} />
            <div className="skel" style={{ width: 70, height: 11, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <div className="skel" style={{ height: 72, borderRadius: 10 }} />
      <div>
        <div className="skel" style={{ width: 100, height: 13, borderRadius: 4, marginBottom: 12 }} />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="skel" style={{ width: 170, height: 13, borderRadius: 4, marginBottom: 6 }} />
                <div className="skel" style={{ width: 120, height: 11, borderRadius: 4 }} />
              </div>
              <div className="skel" style={{ width: 64, height: 14, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
