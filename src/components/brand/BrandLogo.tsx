/**
 * EZ Marketing Agency — Brand mark
 *
 * Single source of truth for the logo everywhere in the app (sidebar, portal
 * header, landing, auth pages).
 *
 * It renders the official artwork from /brand/ez-logo.png — the square
 * black-glass "EZ" poster. Drop the exported PNG at:
 *
 *     public/brand/ez-logo.png
 *
 * and every surface picks it up automatically. The artwork has wide margins,
 * so small tiles crop-zoom onto the wordmark. If the file is missing, a
 * monochrome "EZ" tile in the same visual language renders instead — no
 * environment ever shows a broken image.
 */
import { useState } from 'react'

interface BrandLogoProps {
  /** Tile edge in px (matches the old w-8/w-9/w-10 tiles: 32/36/40). */
  size?: number
  /** Corner radius in px (rounded-lg 8 · rounded-xl 12 · rounded-2xl 16). */
  radius?: number
  /**
   * 'mark'  — crop-zoom onto the EZ wordmark (default; right for small tiles)
   * 'full'  — show the complete square artwork (hero / large placements)
   */
  variant?: 'mark' | 'full'
  className?: string
}

export default function BrandLogo({
  size = 36,
  radius = 12,
  variant = 'mark',
  className = '',
}: BrandLogoProps) {
  const [missing, setMissing] = useState(false)

  const frame: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    flexShrink: 0,
    background: '#0A0A0F',
    border: '1px solid rgba(255,255,255,0.14)',
  }

  if (missing) {
    // Fallback tile — monochrome, italic, matching the brand's angular EZ.
    return (
      <div
        className={`flex items-center justify-center select-none ${className}`}
        style={frame}
        aria-label="EZ Marketing Agency"
      >
        <span
          className="font-black text-white leading-none"
          style={{
            fontSize: size * 0.42,
            fontStyle: 'italic',
            letterSpacing: '-0.05em',
            transform: 'skewX(-6deg)',
            textShadow: '0 0 10px rgba(255,255,255,0.25)',
          }}
        >
          EZ
        </span>
      </div>
    )
  }

  return (
    <div className={className} style={frame} aria-label="EZ Marketing Agency">
      <img
        src="/brand/ez-logo.png"
        alt="EZ Marketing Agency"
        draggable={false}
        onError={() => setMissing(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // The wordmark sits in the upper-middle of the square poster;
          // zooming there makes the EZ fill small tiles.
          transform: variant === 'mark' ? 'scale(1.9)' : undefined,
          transformOrigin: '50% 40%',
        }}
      />
    </div>
  )
}
