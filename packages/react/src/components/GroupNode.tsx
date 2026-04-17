import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import { RefIndicator } from './RefIndicator.js'

interface GroupNodeProps {
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

export function GroupNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
  onNavigate,
  onPointerDown,
  isSelected,
  isEditing,
}: GroupNodeProps) {
  const { x, y, width, height } = node

  // Use the node's resolved color for the group border, falling back to group theme
  const stroke = node.color ? node.resolvedStroke : theme.group.stroke
  const fill = node.color ? node.resolvedFill : theme.group.fill

  // Label hit-target dimensions (top-left corner)
  const labelFontSize = theme.group.labelFontSize
  const labelPadX = 12
  const labelPadY = 8
  const labelText = node.label ?? ''
  // Approximate text width — wide enough to click, not so wide it blocks the interior
  const labelHitWidth = Math.min(
    Math.max(labelText.length * (labelFontSize * 0.6) + labelPadX * 2, 60),
    width
  )
  const labelHitHeight = labelFontSize + labelPadY * 2

  return (
    <g
      className="system-canvas-node system-canvas-node--group"
      style={{ cursor: onPointerDown ? 'move' : node.isNavigable ? 'pointer' : 'default' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
      onPointerDown={onPointerDown ? (e) => onPointerDown(node, e) : undefined}
    >
      {/* Dashed boundary.
          pointer-events='stroke' means only the drawn border responds to
          clicks, so the translucent interior lets edges underneath be
          selectable. The label + ref-indicator provide dedicated hit targets. */}
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
        pointerEvents="stroke"
      />

      {/* Selection outline */}
      {isSelected && (
        <rect
          x={x - 3}
          y={y - 3}
          width={width + 6}
          height={height + 6}
          rx={theme.group.cornerRadius + 3}
          fill="none"
          stroke={theme.node.labelColor}
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.6}
          pointerEvents="none"
        />
      )}

      {/* Invisible hit target behind the label — gives the group a
          click/drag handle in the top-left without blocking interior edges. */}
      {!isEditing && (
        <rect
          x={x}
          y={y}
          width={labelHitWidth}
          height={labelHitHeight}
          rx={theme.group.cornerRadius}
          fill="transparent"
        />
      )}

      {/* Label in top-left */}
      {!isEditing && node.label && (
        <text
          x={x + labelPadX}
          y={y + labelFontSize + labelPadY}
          fill={node.color ? stroke : theme.group.labelColor}
          fontSize={labelFontSize}
          fontWeight={600}
          fontFamily={theme.node.fontFamily}
          pointerEvents="none"
        >
          {node.label}
        </text>
      )}

      {/* Ref indicator — carved top-right corner (label is top-left) */}
      {node.isNavigable && (
        <RefIndicator
          node={node}
          theme={theme}
          nodeX={x}
          nodeY={y}
          nodeWidth={width}
          nodeHeight={height}
          strokeColor={stroke}
          strokeWidth={theme.group.strokeWidth}
          corner="top-right"
          onNavigate={onNavigate}
        />
      )}
    </g>
  )
}
