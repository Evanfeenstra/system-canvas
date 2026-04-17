import React from 'react'
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

const HANDLE_SIZE = 8

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
 * sits on top of any carved corner.
 */
export function ResizeHandles({ node, theme, onHandlePointerDown }: ResizeHandlesProps) {
  const { x, y, width, height } = node
  const s = HANDLE_SIZE
  const half = s / 2

  const anchorPos = (anchor: 'nw' | 'ne' | 'sw' | 'se') => {
    switch (anchor) {
      case 'nw':
        return { cx: x, cy: y }
      case 'ne':
        return { cx: x + width, cy: y }
      case 'sw':
        return { cx: x, cy: y + height }
      case 'se':
        return { cx: x + width, cy: y + height }
    }
  }

  return (
    <g className="system-canvas-resize-handles" pointerEvents="all">
      {CORNERS.map(({ corner, cursor, anchor }) => {
        const { cx, cy } = anchorPos(anchor)
        return (
          <rect
            key={corner}
            x={cx - half}
            y={cy - half}
            width={s}
            height={s}
            fill={theme.background}
            stroke={theme.node.labelColor}
            strokeWidth={1.5}
            style={{ cursor }}
            onPointerDown={(e) => onHandlePointerDown(node, corner, e)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        )
      })}
    </g>
  )
}
