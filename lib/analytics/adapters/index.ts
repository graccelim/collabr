// Adapter registry. First-party (no-Phyllo) per-platform adapters. A platform is
// returned only when the Analytics Suite is ON and that platform's credentials
// exist (OAuth app creds, or a YouTube API key) — otherwise null, so callers
// no-op. No provider client is ever constructed when the suite is off.

import type { Platform, PlatformAdapter } from './types'
import { flags } from '@/lib/flags'
import { platformConnectable } from '@/lib/analytics/oauth'
import { YouTubeAdapter } from './youtube'
import { InstagramAdapter } from './instagram'
import { TikTokAdapter } from './tiktok'

/** True when the suite is ON and at least one platform is configured. */
export function analyticsConfigured(): boolean {
  if (!flags.analyticsSuite) return false
  return (['youtube', 'instagram', 'tiktok'] as Platform[]).some(platformConnectable)
}

/** Adapter for one platform, or null (suite off / platform not configured). */
export function getAdapter(platform: Platform): PlatformAdapter | null {
  if (!flags.analyticsSuite) return null
  if (!platformConnectable(platform)) return null
  if (platform === 'youtube') return new YouTubeAdapter()
  if (platform === 'instagram') return new InstagramAdapter()
  if (platform === 'tiktok') return new TikTokAdapter()
  return null
}
