'use client'
import { socialIcon } from '@/components/SocialIcon'

// Shared per-platform segmented switcher (our brand glyphs). Drives Insights,
// Reports and Content Lab. Active = white chip; full-width on mobile via .pi-switch.
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }

export default function PlatformSwitcher({ platforms, active, onSelect }: { platforms: string[]; active: string; onSelect: (p: string) => void }) {
  return (
    <div className="pi-switch" style={{ display: 'inline-flex', background: '#F1F5FC', border: '1px solid rgba(20,30,80,.09)', borderRadius: 11, padding: 4 }}>
      {platforms.map((p) => {
        const on = p === active
        const Glyph = socialIcon(p)
        return (
          <button key={p} type="button" onClick={() => onSelect(p)}
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 8,
              padding: '8px 15px', fontSize: 13.5, fontWeight: 600,
              background: on ? '#fff' : 'transparent', color: on ? '#0E1016' : '#8A909C',
              boxShadow: on ? '0 2px 6px -2px rgba(14,16,22,.18)' : 'none',
            }}>
            <Glyph size={15} /> {LABEL[p] || p}
          </button>
        )
      })}
    </div>
  )
}
