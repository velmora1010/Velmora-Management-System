import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>404 - Not Found</h2>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>Could not find requested resource</p>
        <Link href="/" className="btn">
          Return Home
        </Link>
      </div>
    </div>
  )
}
