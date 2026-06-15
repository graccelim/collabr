import { Instagram, Youtube, Music2, Twitter, Citrus, BookHeart, Link2 } from 'lucide-react'
import type { SocialPlatform } from '@/lib/onboarding'

// Per-platform glyphs. lucide has no TikTok/X-bird/Lemon8/XHS marks, so we map
// to the closest recognisable icon (Music2 = short-form video, Citrus = Lemon8,
// BookHeart = RED/Xiaohongshu's "little red book").
const ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  lemon8: Citrus,
  xiaohongshu: BookHeart,
}

export function socialIcon(platform: string): typeof Instagram {
  return ICONS[platform as SocialPlatform] || Link2
}

// Per-platform tints (brand-adjacent) so social rows feel alive, not grey.
const TINTS: Record<SocialPlatform, { bg: string; fg: string }> = {
  instagram:   { bg: '#FCE7F3', fg: '#C13584' },
  tiktok:      { bg: '#E6F7F6', fg: '#0B7C84' },
  youtube:     { bg: '#FEE2E2', fg: '#DC2626' },
  x:           { bg: '#E8EAED', fg: '#111827' },
  lemon8:      { bg: '#FEF3C7', fg: '#B45309' },
  xiaohongshu: { bg: '#FFE4E6', fg: '#E11D48' },
}

export function socialTint(platform: string): { bg: string; fg: string } {
  return TINTS[platform as SocialPlatform] || { bg: 'var(--surface-2)', fg: 'var(--ink-soft)' }
}
