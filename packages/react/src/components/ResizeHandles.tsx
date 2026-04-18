import React, { useState } from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import type { ResizeCorner } from '../hooks/useNodeResize.js'

interface ResizeHandlesProps {
  node: ResolvedNode
  theme: CanvasTheme
  onHandlePointerDown: (
    node: ResolvedNode,
    corner: ResizeCorner,
    event: React.PointerEvent
  ) => void
}

const HANDLE_SIZE = 7
/**
 * Corners are nudged inward along both axes so that, with rounded node
 * corners, the handle square visually sits inside the curve rather than
 * straddling it (which otherwise leaves a stub poking out past the rounded
 * edge). The inset scales with the node's own resolved corner radius,
 * clamped so it's never zero and never so large it crowds small nodes.
 *
 * Small corners (r≤6) → 1px inset (floor).
 * Groups (r≈12) → ~6px inset.
 */
const computeCornerInset = (cornerRadius: number) => {
  if (cornerRadius <= 6) return 1
  return Math.min(cornerRadius * 0.5, 8)
}

const CORNERS: { corner: ResizeCorner; cursor: string; anchor: 'nw' | 'ne' | 'sw' | 'se' }[] = [
  { corner: 'nw', cursor: 'nwse-resize', anchor: 'nw' },
  { corner: 'ne', cursor: 'nesw-resize', anchor: 'ne' },
  { corner: 'sw', cursor: 'nesw-resize', anchor: 'sw' },
  { corner: 'se', cursor: 'nwse-resize', anchor: 'se' },
]

/**
 * Renders four small squares at the corners of a selected node. Pointer-down
 * on a handle starts a resize gesture.
 *
 * Placed inside the node's <g> but rendered AFTER the ref indicator so it
 * sits on top of any carved corner. Solid-filled in the node's own stroke
 * color so they read as part of the node; the hovered corner grows slightly.
 */
export function ResizeHandles({ node, theme, onHandlePointerDown }: ResizeHandlesProps) {
  const { x, y, width, height } = node
  const [hoveredCorner, setHoveredCorner] = useState<ResizeCorner | null>(null)

  const handleColor = node.resolvedStroke ?? theme.node.labelColor

  const i = computeCornerInset(node.resolvedCornerRadius)
  const anchorPos = (anchor: 'nw' | 'ne' | 'sw' | 'se') => {
    switch (anchor) {
      case 'nw':
        return { cx: x + i, cy: y + i }
      case 'ne':
        return { cx: x + width - i, cy: y + i }
      case 'sw':
        return { cx: x + i, cy: y + height - i }
      case 'se':
        return { cx: x + width - i, cy: y + height - i }
    }
  }

  return (
    <g className="system-canvas-resize-handles" pointerEvents="all">
      {CORNERS.map(({ corner, cursor, anchor }) => {
        const { cx, cy } = anchorPos(anchor)
        const isHovered = hoveredCorner === corner
        const s = isHovered ? HANDLE_SIZE + 2 : HANDLE_SIZE
        const half = s / 2
        return (
          <rect
            key={corner}
            x={cx - half}
            y={cy - half}
            width={s}
            height={s}
            fill={handleColor}
            style={{ cursor }}
            onPointerEnter={() => setHoveredCorner(corner)}
            onPointerLeave={() =>
              setHoveredCorner((c) => (c === corner ? null : c))
            }
            onPointerDown={(e) => onHandlePointerDown(node, corner, e)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        )
      })}
    </g>
  )
}
