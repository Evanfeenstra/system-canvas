import React from 'react'
import type {
  CanvasEdge,
  ResolvedNode,
  CanvasTheme,
  EdgeStyle,
} from 'system-canvas'
import {
  computeEdgePath,
  computeEdgeMidpoint,
  resolveColor,
} from 'system-canvas'

interface EdgeRendererProps {
  edges: CanvasEdge[]
  nodeMap: Map<string, ResolvedNode>
  theme: CanvasTheme
  defaultEdgeStyle: EdgeStyle
  onClick: (edge: CanvasEdge, event: React.MouseEvent) => void
  onContextMenu: (edge: CanvasEdge, event: React.MouseEvent) => void
}

/**
 * Renders all edges. Edges are drawn before nodes in the SVG so they
 * appear behind node rectangles (painter's model).
 */
export function EdgeRenderer({
  edges,
  nodeMap,
  theme,
  defaultEdgeStyle,
  onClick,
  onContextMenu,
}: EdgeRendererProps) {
  return (
    <>
      {/* Arrowhead marker definition */}
      <defs>
        <marker
          id="system-canvas-arrowhead"
          markerWidth={theme.edge.arrowSize}
          markerHeight={theme.edge.arrowSize * 0.7}
          refX={theme.edge.arrowSize - 1}
          refY={theme.edge.arrowSize * 0.35}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon
            points={`0 0, ${theme.edge.arrowSize} ${theme.edge.arrowSize * 0.35}, 0 ${theme.edge.arrowSize * 0.7}`}
            fill={theme.edge.stroke}
          />
        </marker>
      </defs>

      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.fromNode)
        const toNode = nodeMap.get(edge.toNode)
        if (!fromNode || !toNode) return null

        const pathD = computeEdgePath(edge, fromNode, toNode, defaultEdgeStyle)
        const midpoint = computeEdgeMidpoint(edge, fromNode, toNode)

        // Resolve edge color
        const edgeColor = edge.color
          ? resolveColor(edge.color, theme).stroke
          : theme.edge.stroke

        const toEnd = edge.toEnd ?? 'arrow'
        const fromEnd = edge.fromEnd ?? 'none'

        return (
          <g
            key={edge.id}
            className="system-canvas-edge"
            style={{ cursor: 'pointer' }}
            onClick={(e) => onClick(edge, e)}
            onContextMenu={(e) => onContextMenu(edge, e)}
          >
            {/* Invisible wider path for easier click targeting */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
            />

            {/* Visible path */}
            <path
              d={pathD}
              fill="none"
              stroke={edgeColor}
              strokeWidth={theme.edge.strokeWidth}
              markerEnd={
                toEnd === 'arrow'
                  ? 'url(#system-canvas-arrowhead)'
                  : undefined
              }
              markerStart={
                fromEnd === 'arrow'
                  ? 'url(#system-canvas-arrowhead)'
                  : undefined
              }
            />

            {/* Edge label */}
            {edge.label && (
              <>
                {/* Label background for readability */}
                <rect
                  x={midpoint.x - edge.label.length * 3 - 4}
                  y={midpoint.y - theme.edge.labelFontSize - 2}
                  width={edge.label.length * 6 + 8}
                  height={theme.edge.labelFontSize + 6}
                  rx={3}
                  fill={theme.background}
                  opacity={0.8}
                />
                <text
                  x={midpoint.x}
                  y={midpoint.y}
                  fill={theme.edge.labelColor}
                  fontSize={theme.edge.labelFontSize}
                  fontFamily={theme.node.fontFamily}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {edge.label}
                </text>
              </>
            )}
          </g>
        )
      })}
    </>
  )
}
