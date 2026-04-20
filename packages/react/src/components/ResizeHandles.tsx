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
  /**
   * Corners that are visually occupied by category slots (e.g. a
   * `topRightOuter` count badge at `ne`, or a `topLeft` dot at `nw`).
   * Handles at these corners are nudged inward so they don't overlap
   * the slot — the user can still grab them without the badge stealing
   * the click.
   */
  occupiedCorners?: ReadonlySet<ResizeCorner>
}

const HANDLE_SIZE = 7
/**
 * How far to push a resize handle inward when its corner is occupied by
 * a slot. Large enough to clear a `topRightOuter` tab badge (which hangs
 * ~6px outside the node and ~16px tall) and a `topLeft` / `topRight`
 * dot (which sits ~8px inside the corner).
 */
const OCCUPIED_CORNER_INSET = 18

const CORNERS: { corner: ResizeCorner; cursor: string; anchor: 'nw' | 'ne' | 'sw' | 'se' }[] = [
  { corner: 'nw', cursor: 'nwse-resize', anchor: 'nw' },
  { corner: 'ne', cursor: 'nesw-resize', anchor: 'ne' },
  { corner: 'sw', cursor: 'nesw-resize', anchor: 'sw' },
  { corner: 'se', cursor: 'nwse-resize', anchor: 'se' },
]

/**
 * Gentle per-radius inset. A square corner (r=0) gets no inset — the handle
 * sits centered on the geometric corner. As the radius grows, the handle is
 * nudged inward just slightly so it doesn't drift fully outside the rounded
 * outline for larger radii like groups (r=12) or outcome nodes (r=14).
 *
 * Capped at 3px so we never push the handle visibly inward from the corner —
 * the handle's half-width is 3.5px, so even at the cap the outer edge of the
 * handle still pokes ~0.5px past the bbox corner.
 */
const cornerInset = (cornerRadius: number) =>
  Math.min(cornerRadius * 0.25, 3)

/**
 * Renders four small squares at the corners of a selected node. Pointer-down
 * on a handle starts a resize gesture.
 *
 * Placed inside the node's <g> but rendered AFTER the ref indicator so it
 * sits on top of any carved corner. Solid-filled in the node's own stroke
 * color so they read as part of the node; the hovered corner grows slightly.
 *
 * Each handle sits at (or very near) the node's geometric corner: a small
 * radius-proportional inset keeps it visually attached to the outline on
 * larger rounded corners without pulling it noticeably toward the center.
 * Handles at corners flagged as occupied by slots are pushed inward
 * further so they don't collide with corner badges / dots / tab badges.
 */
export function ResizeHandles({
  node,
  theme,
  onHandlePointerDown,
  occupiedCorners,
}: ResizeHandlesProps) {
  const { x, y, width, height } = node
  const [hoveredCorner, setHoveredCorner] = useState<ResizeCorner | null>(null)

  const handleColor = node.resolvedStroke ?? theme.node.labelColor

  const baseInset = cornerInset(node.resolvedCornerRadius)
  const insetFor = (corner: ResizeCorner): number =>
    occupiedCorners?.has(corner) ? OCCUPIED_CORNER_INSET : baseInset
  const anchorPos = (
    anchor: 'nw' | 'ne' | 'sw' | 'se',
    corner: ResizeCorner
  ) => {
    const i = insetFor(corner)
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
        const { cx, cy } = anchorPos(anchor, corner)
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
