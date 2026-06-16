import { User } from 'lucide-react'

/**
 * Standard avatar used everywhere a creator or brand image appears. Shows the
 * uploaded image when present, otherwise a neutral person icon (no initials,
 * no coloured gradient) so empty states look identical across the app. Always a
 * circle by default for consistency between creators and brands.
 */
export default function Avatar({
  src, name, size = 48, radius = '50%', className,
}: {
  src?: string | null
  name?: string | null
  size?: number
  radius?: number | string
  className?: string
}) {
  return (
    <span
      className={className}
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
        background: 'var(--surface-2)', color: 'var(--ink-faint-solid)',
        display: 'grid', placeItems: 'center',
        boxShadow: 'inset 0 0 0 1px var(--line)',
      }}
    >
      {src
        ? <img src={src} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <User size={Math.round(size * 0.5)} strokeWidth={1.75} />}
    </span>
  )
}
