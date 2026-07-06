import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <p className="text-7xl font-semibold text-gray-200">404</p>
        <h1 className="text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        {/* "/" works for everyone: middleware sends signed-in users straight
            to their dashboard, guests get the landing page (a logged-out
            visitor sent to /dashboard would bounce through the login gate). */}
        <Link href="/" className="btn-primary inline-flex mt-2">
          Back to collabr
        </Link>
      </div>
    </div>
  )
}
