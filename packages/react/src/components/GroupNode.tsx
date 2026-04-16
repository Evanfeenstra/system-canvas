import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'

interface GroupNodeProps {
  node: ResolvedNode
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
}

export function GroupNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
}: GroupNodeProps) {
  const { x, y, width, height } = node

  // Use the node's resolved color for the group border, falling back to group theme
  const stroke = node.color ? node.resolvedStroke : theme.group.stroke
  const fill = node.color ? node.resolvedFill : theme.group.fill

  return (
    <g
      className="system-canvas-node system-canvas-node--group"
      style={{ cursor: node.isNavigable ? 'pointer' : 'default' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
    >
      {/* Dashed boundary */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={theme.group.cornerRadius}
        fill={fill}
        stroke={stroke}
        strokeWidth={theme.group.strokeWidth}
        strokeDasharray={theme.group.strokeDasharray}
      />

      {/* Label in top-left */}
      {node.label && (
        <text
          x={x + 12}
          y={y + theme.group.labelFontSize + 8}
          fill={node.color ? stroke : theme.group.labelColor}
          fontSize={theme.group.labelFontSize}
          fontWeight={600}
          fontFamily={theme.node.fontFamily}
          pointerEvents="none"
        >
          {node.label}
        </text>
      )}

      {/* Ref indicator */}
      {node.isNavigable && theme.node.refIndicator.icon !== 'none' && (
        <path
          d={`M ${x + width - 20} ${y + 10} l 5 5 l -5 5`}
          fill="none"
          stroke={theme.node.refIndicator.color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </g>
  )
}
