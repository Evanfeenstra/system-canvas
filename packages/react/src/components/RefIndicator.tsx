import React, { useState } from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'

type Corner = 'bottom-right' | 'top-right'

interface RefIndicatorProps {
  node: ResolvedNode
  theme: CanvasTheme
  /** The node's absolute bounding box. */
  nodeX: number
  nodeY: number
  nodeWidth: number
  nodeHeight: number
  /** Color of the node's own stroke — the carved lines match it. */
  strokeColor: string
  /** Stroke width of the node — carved lines match it. */
  strokeWidth?: number
  /** Which corner of the node to carve. Defaults to bottom-right. */
  corner?: Corner
  /** Size of the carved square region. */
  size?: number
  /** Fired when the user clicks the indicator. The parent should navigate. */
  onNavigate: (node: ResolvedNode, event: React.MouseEvent) => void
}

/**
 * Turns a corner of the node into a clickable "enter sub-canvas" region.
 * Renders as two short lines that continue the node's own stroke to form
 * a small square, with the configured arrow glyph inside.
 *
 * Hovering fills the square with a subtle tint for affordance.
 * Stops pointer/mouse event propagation so it doesn't trigger node drag
 * or node click handlers.
 */
export function RefIndicator({
  node,
  theme,
  nodeX,
  nodeY,
  nodeWidth,
  nodeHeight,
  strokeColor,
  strokeWidth,
  corner = 'bottom-right',
  size = 18,
  onNavigate,
}: RefIndicatorProps) {
  const [hover, setHover] = useState(false)
  const iconKind = theme.node.refIndicator.icon
  if (iconKind === 'none') return null

  const stopAll = (e: React.SyntheticEvent) => e.stopPropagation()

  // Compute the carved square bounds.
  const right = nodeX + nodeWidth
  const bottom = nodeY + nodeHeight

  // Round the inner corner (the one facing into the node body) so the carve
  // visually echoes the box's rounding, but keep the arc noticeably tighter
  // than the node's own radius so the carve still reads as a distinct corner
  // rather than a soft scoop. Clamp to half the carve size so it always fits.
  const nodeRadius =
    corner === 'top-right' ? theme.group.cornerRadius : node.resolvedCornerRadius
  const innerR = Math.max(0, Math.min(nodeRadius * 0.64, size / 2))

  let squareX: number
  let squareY: number
  // Path tracing the carve from one outer edge to the other, with a rounded
  // concave arc at the inner corner. The arc sweeps away from the outer
  // corner so the inside of the carve matches the node's own rounding.
  let carvePath: string

  if (corner === 'bottom-right') {
    squareX = right - size
    squareY = bottom - size
    // Start at the top of the carve on the node's right edge, walk left
    // along the top of the square to the arc, curve down, then walk down
    // to the node's bottom edge.
    carvePath =
      `M ${right} ${squareY} ` +
      `L ${squareX + innerR} ${squareY} ` +
      `A ${innerR} ${innerR} 0 0 0 ${squareX} ${squareY + innerR} ` +
      `L ${squareX} ${bottom}`
  } else {
    // top-right
    squareX = right - size
    squareY = nodeY
    // Start at the left of the carve on the node's top edge, walk down
    // to the arc, curve right, then walk right to the node's right edge.
    carvePath =
      `M ${squareX} ${nodeY} ` +
      `L ${squareX} ${squareY + size - innerR} ` +
      `A ${innerR} ${innerR} 0 0 0 ${squareX + innerR} ${squareY + size} ` +
      `L ${right} ${squareY + size}`
  }

  const cx = squareX + size / 2
  const cy = squareY + size / 2

  const sw = strokeWidth ?? theme.node.strokeWidth
  const restGlyph = theme.node.refIndicator.color
  // On hover the carved square fills with the node's own stroke color (the
  // category/accent) and the glyph flips to the canvas background so it
  // reads as a cutout — a green node's button turns solid green, a red
  // node's red.
  const hoverFill = strokeColor
  const hoverGlyph = theme.background

  // Hover fill needs to respect the rounded inner corner. We build a closed
  // path from the square's outer corner around to the inner arc.
  let hoverPath: string
  if (corner === 'bottom-right') {
    hoverPath =
      `M ${right} ${squareY} ` +
      `L ${right} ${bottom} ` +
      `L ${squareX} ${bottom} ` +
      `L ${squareX} ${squareY + innerR} ` +
      `A ${innerR} ${innerR} 0 0 1 ${squareX + innerR} ${squareY} ` +
      `Z`
  } else {
    hoverPath =
      `M ${squareX} ${nodeY} ` +
      `L ${right} ${nodeY} ` +
      `L ${right} ${squareY + size} ` +
      `L ${squareX + innerR} ${squareY + size} ` +
      `A ${innerR} ${innerR} 0 0 1 ${squareX} ${squareY + size - innerR} ` +
      `Z`
  }

  return (
    <g
      className="system-canvas-ref-indicator"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        onNavigate(node, e)
      }}
      onDoubleClick={stopAll}
      onPointerDown={stopAll}
      onMouseDown={stopAll}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {/* Hover fill — inside the carved square, respecting the inner arc */}
      {hover && (
        <path
          d={hoverPath}
          fill={hoverFill}
          pointerEvents="none"
        />
      )}

      {/* The carved corner stroke — two edges joined by a rounded inner arc */}
      <path
        d={carvePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={sw}
        strokeLinecap="butt"
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {/* Transparent hit target covering the carved square */}
      <rect
        x={squareX}
        y={squareY}
        width={size}
        height={size}
        fill="transparent"
      />

      <Glyph kind={iconKind} cx={cx} cy={cy} color={hover ? hoverGlyph : restGlyph} />
    </g>
  )
}

function Glyph({
  kind,
  cx,
  cy,
  color,
}: {
  kind: 'chevron' | 'arrow' | 'expand'
  cx: number
  cy: number
  color: string
}) {
  // Inner icon half-size. Slightly smaller than before so the glyph sits
  // comfortably inside the 18px carved square with breathing room.
  const s = 3
  switch (kind) {
    case 'chevron':
      return (
        <path
          d={`M ${cx - s / 2} ${cy - s} L ${cx + s / 2} ${cy} L ${cx - s / 2} ${cy + s}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )
    case 'arrow': {
      const h = s * 0.9 // head size
      return (
        <path
          d={`M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx + s - h} ${cy - h} L ${cx + s} ${cy} L ${cx + s - h} ${cy + h}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )
    }
    case 'expand':
      return (
        <g pointerEvents="none">
          <path
            d={`M ${cx - s} ${cy - s} L ${cx + s} ${cy - s} L ${cx + s} ${cy + s} L ${cx - s} ${cy + s} Z`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <line x1={cx} y1={cy - s + 1} x2={cx} y2={cy + s - 1} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
          <line x1={cx - s + 1} y1={cy} x2={cx + s - 1} y2={cy} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )
  }
}
