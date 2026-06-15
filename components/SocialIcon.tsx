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
