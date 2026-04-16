import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'

interface LinkNodeProps {
  node: ResolvedNode
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
}

export function LinkNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
}: LinkNodeProps) {
  const { x, y, width, height } = node
  const cx = x + width / 2

  // Parse URL to show hostname
  let displayUrl = node.url ?? ''
  try {
    const url = new URL(displayUrl)
    displayUrl = url.hostname
  } catch {
    // Keep full URL if parsing fails
  }

  return (
    <g
      className="system-canvas-node system-canvas-node--link"
      style={{ cursor: 'pointer' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
    >
      {/* Opaque backer */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={node.resolvedCornerRadius}
        fill={theme.background}
      />
      {/* Styled overlay */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={node.resolvedCornerRadius}
        fill={node.resolvedFill}
        stroke={node.resolvedStroke}
        strokeWidth={theme.node.strokeWidth}
      />

      {/* Link icon */}
      <text
        x={x + 12}
        y={y + height / 2 + 4}
        fill={node.resolvedStroke}
        fontSize={12}
        fontFamily={theme.node.fontFamily}
        pointerEvents="none"
        opacity={0.6}
      >
        {'\u{29C9}'}
      </text>

      {/* URL display */}
      <text
        x={cx}
        y={y + height / 2 + 4}
        fill={theme.node.labelColor}
        fontSize={theme.node.fontSize}
        fontWeight={600}
        fontFamily={theme.node.fontFamily}
        textAnchor="middle"
        pointerEvents="none"
        textDecoration="underline"
      >
        {displayUrl}
      </text>

      {/* Ref indicator */}
      {node.isNavigable && theme.node.refIndicator.icon !== 'none' && (
        <path
          d={`M ${x + width - 16} ${y + height - 16} l 5 5 l -5 5`}
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
