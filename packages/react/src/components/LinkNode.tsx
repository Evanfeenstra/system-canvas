import React from 'react'
import type {
  CanvasData,
  CategorySlots,
  ResolvedNode,
  CanvasTheme,
} from 'system-canvas'
import { RefIndicator } from './RefIndicator.js'
import { CategorySlotsLayer } from './CategorySlotsLayer.js'
import { toKebabCorner, type RefCorner } from './refCorner.js'

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
  slots?: CategorySlots
  canvases?: Record<string, CanvasData>
  reservedTop?: number
  reservedBottom?: number
  reservedLeft?: number
  reservedRight?: number
  refCorner?: RefCorner
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
  slots,
  canvases,
  reservedTop = 0,
  reservedBottom = 0,
  reservedLeft = 0,
  reservedRight = 0,
  refCorner = 'bottomRight',
}: LinkNodeProps) {
  const { x, y, width, height } = node
  const contentX = x + reservedLeft
  const contentY = y + reservedTop
  const contentWidth = Math.max(0, width - reservedLeft - reservedRight)
  const contentHeight = Math.max(0, height - reservedTop - reservedBottom)
  const cx = contentX + contentWidth / 2

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

      {/* Link icon — suppressed when a `body` slot owns the content area. */}
      {!isEditing && !slots?.body && (
        <text
          x={contentX + 12}
          y={contentY + contentHeight / 2 + 4}
          fill={node.resolvedStroke}
          fontSize={12}
          fontFamily={theme.node.fontFamily}
          pointerEvents="none"
          opacity={0.6}
        >
          {'\u{29C9}'}
        </text>
      )}

      {/* URL display — suppressed when a `body` slot owns the content area. */}
      {!isEditing && !slots?.body && (
        <text
          x={cx}
          y={contentY + contentHeight / 2 + 4}
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

      {/* Category slots */}
      {slots && (
        <CategorySlotsLayer
          node={node}
          theme={theme}
          canvases={canvases}
          slots={slots}
        />
      )}

      {/* Ref indicator */}
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
          corner={toKebabCorner(refCorner)}
          onNavigate={onNavigate}
        />
      )}
    </g>
  )
}
