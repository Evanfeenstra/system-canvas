import React from 'react'
import type {
  CanvasData,
  CategorySlots,
  ResolvedNode,
  CanvasTheme,
} from 'system-canvas'
import { NodeIcon } from './NodeIcon.js'
import { RefIndicator } from './RefIndicator.js'
import { CategorySlotsLayer } from './CategorySlotsLayer.js'
import { toKebabCorner, type RefCorner } from './refCorner.js'

interface TextNodeProps {
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
  /** Pixels reserved at the top of the node's content box for a header slot. */
  reservedTop?: number
  /** Pixels reserved at the bottom for a footer slot. */
  reservedBottom?: number
  /** Pixels reserved on the left for a leftEdge slot. */
  reservedLeft?: number
  /** Pixels reserved on the right for a rightEdge slot. */
  reservedRight?: number
  /** Corner the ref indicator should occupy (chosen by NodeRenderer). */
  refCorner?: RefCorner
}

export function TextNode({
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
}: TextNodeProps) {
  const { x, y, width, height } = node
  const contentX = x + reservedLeft
  const contentY = y + reservedTop
  const contentWidth = Math.max(0, width - reservedLeft - reservedRight)
  const contentHeight = Math.max(0, height - reservedTop - reservedBottom)

  // Split text into lines for multi-line rendering
  const text = node.text ?? ''
  const lines = text.split('\n').filter(Boolean)
  const mainLabel = lines[0] ?? node.id
  const sublabel = lines[1]

  // Label layout: when the node has a header slot (reservedTop > 0), the
  // label aligns top-left under the header — dashboard-card style. When
  // there's no header, the label centers (historical behavior for
  // plain text nodes).
  const hasHeader = reservedTop > 0
  const labelFont = theme.node.labelFont ?? theme.node.fontFamily
  const labelFontSize = theme.node.fontSize + (hasHeader ? 1 : 0)
  const lineHeight = labelFontSize + 4
  const totalTextHeight = sublabel
    ? lineHeight + theme.node.sublabelFontSize + 4
    : lineHeight

  const labelAnchor: 'middle' | 'start' = hasHeader ? 'start' : 'middle'
  const labelX = hasHeader ? contentX : contentX + contentWidth / 2
  const textStartY = hasHeader
    ? contentY + labelFontSize + 2
    : contentY + (contentHeight - totalTextHeight) / 2 + labelFontSize

  return (
    <g
      className="system-canvas-node system-canvas-node--text"
      style={{ cursor: onPointerDown ? 'move' : node.isNavigable ? 'pointer' : 'default' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
      onPointerDown={onPointerDown ? (e) => onPointerDown(node, e) : undefined}
    >
      {/* Opaque backer — masks edges behind semi-transparent fill */}
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

      {/* Label */}
      {!isEditing && (
        <text
          x={labelX}
          y={textStartY}
          fill={theme.node.labelColor}
          fontSize={labelFontSize}
          fontWeight={600}
          fontFamily={labelFont}
          textAnchor={labelAnchor}
          pointerEvents="none"
        >
          {mainLabel}
        </text>
      )}

      {/* Sublabel */}
      {!isEditing && sublabel && (
        <text
          x={labelX}
          y={textStartY + lineHeight}
          fill={theme.node.sublabelColor}
          fontSize={theme.node.sublabelFontSize}
          fontFamily={theme.node.fontFamily}
          textAnchor={labelAnchor}
          pointerEvents="none"
        >
          {sublabel}
        </text>
      )}

      {/* Category icon */}
      {node.resolvedIcon && (
        <NodeIcon
          icon={node.resolvedIcon}
          x={x + 8 + reservedLeft}
          y={contentY + contentHeight / 2 - 7}
          size={14}
          color={node.resolvedStroke}
          opacity={0.7}
          customIcons={theme.icons}
        />
      )}

      {/* Category slots — declarative visual add-ons from theme */}
      {slots && (
        <CategorySlotsLayer
          node={node}
          theme={theme}
          canvases={canvases}
          slots={slots}
        />
      )}

      {/* Ref indicator — corner is chosen by NodeRenderer based on which
          corner slots (if any) are occupied by the category. */}
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
