import React from 'react'
import type { SlotRect } from 'system-canvas'

interface NodeProgressBarProps {
  region: SlotRect
  /** 0..1. Clamped. */
  value: number
  color: string
  bgColor?: string
  /**
   * Override the corner radius of the bar ends. Defaults to half the
   * region's shorter dimension (fully rounded capsule). Pass 0 for
   * square ends.
   */
  cornerRadius?: number
  /** Alpha of the track when no explicit `bgColor` is given. Defaults to 0.12. */
  trackAlpha?: number
}

/**
 * Horizontal progress bar rendered inside a slot region. Fills the bar
 * left-to-right according to `value`. Defaults to capsule ends (rounded
 * to half the region's shorter dimension) so it reads as a progress
 * indicator rather than a flat strip. The track renders in `bgColor`,
 * or in a translucent version of `color` at `trackAlpha` when omitted —
 * matching the "muted continuation" pattern.
 */
export function NodeProgressBar({
  region,
  value,
  color,
  bgColor,
  cornerRadius,
  trackAlpha = 0.12,
}: NodeProgressBarProps) {
  const v = Math.max(0, Math.min(1, value))
  const filled = Math.max(0, region.width * v)
  const rx =
    cornerRadius ?? Math.min(region.width, region.height) / 2
  const track = bgColor ?? colorWithAlpha(color, trackAlpha)

  return (
    <g pointerEvents="none">
      <rect
        x={region.x}
        y={region.y}
        width={region.width}
        height={region.height}
        rx={rx}
        fill={track}
      />
      {filled > 0 && (
        <rect
          x={region.x}
          y={region.y}
          width={filled}
          height={region.height}
          rx={rx}
          fill={color}
        />
      )}
    </g>
  )
}

/**
 * Re-tint a color with a given alpha. Accepts `#rgb` / `#rrggbb` hex and
 * `rgb(...)` / `rgba(...)` strings. Falls back to a neutral translucent
 * white if the input isn't recognized.
 */
function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const h = color.slice(1)
    let r: number
    let g: number
    let b: number
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16)
      g = parseInt(h[1] + h[1], 16)
      b = parseInt(h[2] + h[2], 16)
    } else if (h.length === 6) {
      r = parseInt(h.slice(0, 2), 16)
      g = parseInt(h.slice(2, 4), 16)
      b = parseInt(h.slice(4, 6), 16)
    } else {
      return `rgba(255, 255, 255, ${alpha})`
    }
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }
  const match = color.match(/^rgba?\(([^)]+)\)$/)
  if (match) {
    const parts = match[1].split(',').map((p) => p.trim())
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`
    }
  }
  return `rgba(255, 255, 255, ${alpha})`
}
