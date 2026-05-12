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
  // When the category declares a `body` slot, it owns the main content
  // area — suppress the default label so the two don't stack.
  const hasBodySlot = slots?.body !== undefined

  // Label layout. Three patterns:
  //
  //   1. **Top-aligned** — header / footer / topRight pill / bodyTop bar
  //      (any "top-row" dashboard signal). Title pins under the header
  //      strip; sublabel below. `reservedTop > 0` is the geometry proxy.
  //
  //   2. **Inline row** — only a `topLeft` dot or icon, no top-row signal.
  //      The reflow leaves `reservedTop = 0` but the `topLeft` region is
  //      vertically centered (see core's `computeCategorySlotRegions`),
  //      so the title also vertical-centers — same row as the marker —
  //      AND left-aligns flush-left in the content area.
  //
  //   3. **Centered** — no slots, plain text node. Title centers both
  //      vertically and horizontally (legacy behavior).
  const hasHeader = reservedTop > 0
  const hasInlineLeftMarker =
    slots?.topLeft !== undefined &&
    (slots.topLeft.kind === 'dot' || slots.topLeft.kind === 'icon') &&
    !hasHeader
  // "Left-align the title" is the dashboard convention for both top-aligned
  // and inline-row patterns. Plain text nodes still center.
  const isLeftAligned = hasHeader || hasInlineLeftMarker
  const labelFont = theme.node.labelFont ?? theme.node.fontFamily
  const labelFontSize = theme.node.fontSize + (hasHeader ? 1 : 0)
  const lineHeight = labelFontSize + 4
  const totalTextHeight = sublabel
    ? lineHeight + theme.node.sublabelFontSize + 4
    : lineHeight

  const labelAnchor: 'middle' | 'start' = isLeftAligned ? 'start' : 'middle'
  const labelX = isLeftAligned ? contentX : contentX + contentWidth / 2
  // Vertical anchor: pin-to-top only for the header-led pattern. Inline-row
  // and centered patterns both vertically center.
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

      {/* Label — suppressed when a `body` slot owns the main content area. */}
      {!isEditing && !hasBodySlot && (
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
      {!isEditing && !hasBodySlot && sublabel && (
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
