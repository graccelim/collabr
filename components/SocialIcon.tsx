import type { ComponentType, SVGProps } from 'react'
import { siInstagram, siTiktok, siYoutube, siX, siXiaohongshu } from 'simple-icons'
import type { SocialPlatform } from '@/lib/onboarding'

// Lemon8 isn't in Simple Icons; this is a clean filled "citrus" glyph so all six
// render the same way (single path, fill: currentColor). No brand colours.
const LEMON8_PATH = 'M12 3c3 1 6 4 6 9s-3 8-6 9c-3-1-6-4-6-9s3-8 6-9z'

const PATHS: Record<SocialPlatform, string> = {
  instagram: siInstagram.path,
  tiktok: siTiktok.path,
  youtube: siYoutube.path,
  x: siX.path,
  lemon8: LEMON8_PATH,
  xiaohongshu: siXiaohongshu.path,
}

export type SocialIconProps = { size?: number } & SVGProps<SVGSVGElement>

function makeGlyph(d: string): ComponentType<SocialIconProps> {
  return function SocialGlyph({ size = 20, className, ...rest }: SocialIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        role="img"
        className={['social-glyph', className].filter(Boolean).join(' ')}
        {...rest}
      >
        <path d={d} />
      </svg>
    )
  }
}

const GLYPHS = Object.fromEntries(
  (Object.keys(PATHS) as SocialPlatform[]).map(p => [p, makeGlyph(PATHS[p])]),
) as Record<SocialPlatform, ComponentType<SocialIconProps>>

/** Monochrome Simple Icons glyph for a platform (renders in currentColor). */
export function socialIcon(platform: string): ComponentType<SocialIconProps> {
  return GLYPHS[platform as SocialPlatform] || GLYPHS.x
}
