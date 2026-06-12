export default function CampaignsLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="skel" style={{ width: 130, height: 22, borderRadius: 6 }} />
        <div className="skel" style={{ width: 90, height: 34, borderRadius: 8 }} />
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="skel" style={{ width: 200, height: 14, borderRadius: 4, marginBottom: 7 }} />
              <div className="skel" style={{ width: 150, height: 12, borderRadius: 4 }} />
            </div>
            <div className="skel" style={{ width: 56, height: 20, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
