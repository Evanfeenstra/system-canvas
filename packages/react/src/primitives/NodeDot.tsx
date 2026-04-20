import React from 'react'
import type { SlotRect } from 'system-canvas'

interface NodeDotProps {
  region: SlotRect
  color: string
}

/**
 * Small solid dot centered inside the region. Shrinks to ~40% of the
 * region's shorter axis so a dot in a 1.25em corner slot reads as a dot,
 * not a filled square.
 */
export function NodeDot({ region, color }: NodeDotProps) {
  const cx = region.x + region.width / 2
  const cy = region.y + region.height / 2
  const r = Math.max(2, Math.min(region.width, region.height) * 0.2)
  return (
    <circle cx={cx} cy={cy} r={r} fill={color} pointerEvents="none" />
  )
}
