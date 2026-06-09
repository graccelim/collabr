import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-semibold text-gray-900">collabr.</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Log in</Link>
          <Link href="/signup" className="btn-primary">Join free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-800 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Free during beta · Singapore
        </div>
        <h1 className="text-4xl font-semibold text-gray-900 leading-tight mb-4">
          Find creators who actually fit your brand
        </h1>
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Post a campaign, review applicants with verified stats, and pay safely via escrow.
          No agency needed.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup?role=brand" className="btn-primary text-base px-6 py-3">Post a campaign free</Link>
          <Link href="/signup?role=creator" className="btn-secondary text-base px-6 py-3">Join as a creator</Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border py-10">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-6 text-center px-6">
          {[['1,200+','Verified creators'],['340+','Brands'],['$0','To get started']].map(([n,l]) => (
            <div key={l}>
              <div className="text-3xl font-semibold text-gray-900">{n}</div>
              <div className="text-sm text-gray-500 mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold text-gray-900 mb-10 text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            ['Post a brief','Describe what you need, set your budget, and list your campaign in minutes.'],
            ['Review applicants','Creators apply with real verified stats. Pick who fits your brand best.'],
            ['Pay safely','Content held for review before payment releases. Escrow protects both sides.'],
          ].map(([t,d],i) => (
            <div key={t} className="card">
              <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 text-sm font-medium flex items-center justify-center mb-3">{i+1}</div>
              <h3 className="font-medium text-gray-900 mb-1">{t}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center">Why collabr.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Escrow protection','Payment held safely until you approve the content.'],
              ['Verified stats','Follower counts authenticated directly from platform APIs.'],
              ['Two-way ratings','Brands and creators rate each other. Bad actors flagged fast.'],
              ['No agency cut','Direct connection. No $2,000/month retainer.'],
              ['Apple Pay + Google Pay','One-tap payments on mobile.'],
              ['Auto-approve safety','48h review window. Auto-approves if brand doesn\'t respond.'],
            ].map(([t,d]) => (
              <div key={t} className="bg-white rounded-card p-4 border border-border">
                <h3 className="font-medium text-gray-900 text-sm mb-1">{t}</h3>
                <p className="text-sm text-gray-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Ready to start?</h2>
        <p className="text-gray-500 mb-6">Free during beta. No credit card needed.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup?role=brand" className="btn-primary px-6 py-3">I'm a brand</Link>
          <Link href="/signup?role=creator" className="btn-secondary px-6 py-3">I'm a creator</Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 px-6 flex justify-between items-center text-xs text-gray-400">
        <span>collabr. · collabr.sg</span>
        <span>© 2025</span>
      </footer>
    </div>
  )
}
