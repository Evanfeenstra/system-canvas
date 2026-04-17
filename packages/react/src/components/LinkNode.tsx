import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import { RefIndicator } from './RefIndicator.js'

interface LinkNodeProps {
  node: ResolvedNode
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  onNavigate: (node: ResolvedNode, event: React.MouseEvent) => void
  onPointerDown?: (node: ResolvedNode, event: React.PointerEvent) => void
  isSelected?: boolean
  isEditing?: boolean
}

export function LinkNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
  onNavigate,
  onPointerDown,
  isSelected,
  isEditing,
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
      style={{ cursor: onPointerDown ? 'move' : 'pointer' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
      onPointerDown={onPointerDown ? (e) => onPointerDown(node, e) : undefined}
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

      {/* Selection outline */}
      {isSelected && (
        <rect
          x={x - 3}
          y={y - 3}
          width={width + 6}
          height={height + 6}
          rx={node.resolvedCornerRadius + 3}
          fill="none"
          stroke={theme.node.labelColor}
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.6}
          pointerEvents="none"
        />
      )}

      {/* Link icon */}
      {!isEditing && (
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
      )}

      {/* URL display */}
      {!isEditing && (
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
      )}

      {/* Ref indicator — carved bottom-right corner */}
      {node.isNavigable && (
        <RefIndicator
          node={node}
          theme={theme}
          nodeX={x}
          nodeY={y}
          nodeWidth={width}
          nodeHeight={height}
          strokeColor={node.resolvedStroke}
          strokeWidth={theme.node.strokeWidth}
          onNavigate={onNavigate}
        />
      )}
    </g>
  )
}
