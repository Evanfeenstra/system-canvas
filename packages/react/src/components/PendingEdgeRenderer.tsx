import React from 'react'
import type {
  CanvasEdge,
  CanvasTheme,
  EdgeStyle,
  ResolvedNode,
  Side,
} from 'system-canvas'
import { computeEdgePath } from 'system-canvas'

interface PendingEdgeRendererProps {
  sourceNode: ResolvedNode
  sourceSide: Side
  cursor: { x: number; y: number }
  targetNode: ResolvedNode | null
  theme: CanvasTheme
  defaultEdgeStyle: EdgeStyle
}

/**
 * Ghost edge rendered while the user is dragging to create a new edge.
 * If the cursor is over a valid target node, the preview snaps to that
 * node's nearest side. Otherwise the preview follows the cursor directly.
 */
export function PendingEdgeRenderer({
  sourceNode,
  sourceSide,
  cursor,
  targetNode,
  theme,
  defaultEdgeStyle,
}: PendingEdgeRendererProps) {
  // When there's no target, build a synthetic zero-sized "target" at the
  // cursor so computeEdgePath produces a curve terminating at the cursor.
  const endNode: ResolvedNode = targetNode ?? {
    id: '__pending__',
    type: 'text',
    x: cursor.x,
    y: cursor.y,
    width: 0,
    height: 0,
    resolvedFill: 'transparent',
    resolvedStroke: 'transparent',
    resolvedCornerRadius: 0,
    isNavigable: false,
    resolvedIcon: null,
  }

  const pendingEdge: CanvasEdge = {
    id: '__pending__',
    fromNode: sourceNode.id,
    fromSide: sourceSide,
    toNode: endNode.id,
  }

  const pathD = computeEdgePath(pendingEdge, sourceNode, endNode, defaultEdgeStyle)

  return (
    <g className="system-canvas-pending-edge" pointerEvents="none">
      <path
        d={pathD}
        fill="none"
        stroke={theme.node.labelColor}
        strokeWidth={theme.edge.strokeWidth * 1.25}
        strokeDasharray="5,4"
        opacity={0.85}
      />
      {/* Small dot at the cursor for affordance when floating free */}
      {!targetNode && (
        <circle
          cx={cursor.x}
          cy={cursor.y}
          r={4}
          fill={theme.background}
          stroke={theme.node.labelColor}
          strokeWidth={1.5}
        />
      )}
    </g>
  )
}
