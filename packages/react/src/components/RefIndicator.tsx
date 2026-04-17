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
  let squareX: number
  let squareY: number
  let innerTopLine: { x1: number; y1: number; x2: number; y2: number }
  let innerSideLine: { x1: number; y1: number; x2: number; y2: number }

  if (corner === 'bottom-right') {
    squareX = right - size
    squareY = bottom - size
    // Top edge of the square — extends all the way to the node's right edge.
    innerTopLine = {
      x1: squareX,
      y1: squareY,
      x2: right,
      y2: squareY,
    }
    // Left edge of the square — extends all the way to the node's bottom edge.
    innerSideLine = {
      x1: squareX,
      y1: squareY,
      x2: squareX,
      y2: bottom,
    }
  } else {
    // top-right
    squareX = right - size
    squareY = nodeY
    // Bottom edge of the square — extends to the node's right edge.
    innerTopLine = {
      x1: squareX,
      y1: squareY + size,
      x2: right,
      y2: squareY + size,
    }
    // Left edge of the square — extends up to the node's top edge.
    innerSideLine = {
      x1: squareX,
      y1: nodeY,
      x2: squareX,
      y2: squareY + size,
    }
  }

  const cx = squareX + size / 2
  const cy = squareY + size / 2

  const sw = strokeWidth ?? theme.node.strokeWidth
  const hoverFill = theme.node.labelColor
  const hoverGlyph = theme.background
  const restGlyph = theme.node.refIndicator.color

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
      {/* Hover fill — inside the carved square */}
      {hover && (
        <rect
          x={squareX}
          y={squareY}
          width={size}
          height={size}
          fill={hoverFill}
          opacity={0.18}
          pointerEvents="none"
        />
      )}

      {/* The two inner lines that carve the corner, matching the node stroke */}
      <line
        x1={innerTopLine.x1}
        y1={innerTopLine.y1}
        x2={innerTopLine.x2}
        y2={innerTopLine.y2}
        stroke={strokeColor}
        strokeWidth={sw}
        pointerEvents="none"
      />
      <line
        x1={innerSideLine.x1}
        y1={innerSideLine.y1}
        x2={innerSideLine.x2}
        y2={innerSideLine.y2}
        stroke={strokeColor}
        strokeWidth={sw}
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
  const s = 4 // inner icon half-size
  switch (kind) {
    case 'chevron':
      return (
        <path
          d={`M ${cx - s / 2} ${cy - s} L ${cx + s / 2} ${cy} L ${cx - s / 2} ${cy + s}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )
    case 'arrow':
      return (
        <path
          d={`M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx + s / 2} ${cy - s / 2} L ${cx + s} ${cy} L ${cx + s / 2} ${cy + s / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )
    case 'expand':
      return (
        <g pointerEvents="none">
          <path
            d={`M ${cx - s} ${cy - s} L ${cx + s} ${cy - s} L ${cx + s} ${cy + s} L ${cx - s} ${cy + s} Z`}
            fill="none"
            stroke={color}
            strokeWidth={1}
          />
          <line x1={cx} y1={cy - s + 1} x2={cx} y2={cy + s - 1} stroke={color} strokeWidth={1} />
          <line x1={cx - s + 1} y1={cy} x2={cx + s - 1} y2={cy} stroke={color} strokeWidth={1} />
        </g>
      )
  }
}
