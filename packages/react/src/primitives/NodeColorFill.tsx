import React from 'react'
import type { SlotPosition, SlotRect } from 'system-canvas'

interface NodeColorFillProps {
  region: SlotRect
  color: string
  /**
   * The slot position this fill is rendered in. Edge positions
   * (`topEdge` / `bottomEdge` / `leftEdge` / `rightEdge`) use the
   * short-strip rendering pattern by default: a left/top-pinned strip
   * that covers `length` of the edge with a rounded cap on the inner end.
   * Non-edge positions render as a flat rect.
   */
  position?: SlotPosition
  /** `'short'` (default on edges) or `'full'`. */
  extent?: 'short' | 'full'
  /** Fraction of the edge length to cover in `'short'` mode. Defaults to 0.55. */
  length?: number
  cornerRadius?: number
  opacity?: number
}

/**
 * Flat color fill. For edge-strip positions, renders a pinned short strip
 * with a rounded inner cap by default — the visual language of a
 * "status accent" bar. Set `extent: 'full'` to span the whole edge.
 */
export function NodeColorFill({
  region,
  color,
  position,
  extent,
  length = 0.55,
  cornerRadius,
  opacity = 1,
}: NodeColorFillProps) {
  const isEdge =
    position === 'topEdge' ||
    position === 'bottomEdge' ||
    position === 'leftEdge' ||
    position === 'rightEdge'
  const effectiveExtent: 'short' | 'full' =
    extent ?? (isEdge ? 'short' : 'full')

  if (isEdge && effectiveExtent === 'short') {
    return (
      <ShortEdgeStrip
        region={region}
        color={color}
        position={position!}
        length={Math.max(0.1, Math.min(1, length))}
        opacity={opacity}
      />
    )
  }

  const rx =
    cornerRadius ??
    // On full-width edge strips, round a bit so the ends tuck under the
    // node's own rounded corners cleanly.
    (isEdge ? Math.min(region.height, region.width) / 2 : 0)
  return (
    <rect
      x={region.x}
      y={region.y}
      width={region.width}
      height={region.height}
      rx={rx}
      fill={color}
      opacity={opacity}
      pointerEvents="none"
    />
  )
}

function ShortEdgeStrip({
  region,
  color,
  position,
  length,
  opacity,
}: {
  region: SlotRect
  color: string
  position: 'topEdge' | 'bottomEdge' | 'leftEdge' | 'rightEdge'
  length: number
  opacity: number
}) {
  // For horizontal strips, `length` is width fraction; for vertical, height.
  // Pin to the start (left for horizontal, top for vertical).
  let x = region.x
  let y = region.y
  let w = region.width
  let h = region.height
  if (position === 'topEdge' || position === 'bottomEdge') {
    w = region.width * length
  } else {
    h = region.height * length
  }
  // Radius = half the short dimension, so the "inner" end reads as a pill
  // cap and the "outer" end tucks into the node's rounded corner.
  const shortDim = Math.min(w, h)
  const rx = shortDim / 2
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx}
      fill={color}
      opacity={opacity}
      pointerEvents="none"
    />
  )
}
