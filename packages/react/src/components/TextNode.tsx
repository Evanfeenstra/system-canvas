import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import { NodeIcon } from './NodeIcon.js'
import { RefIndicator } from './RefIndicator.js'

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
}: TextNodeProps) {
  const { x, y, width, height } = node
  const cx = x + width / 2

  // Split text into lines for multi-line rendering
  const text = node.text ?? ''
  const lines = text.split('\n').filter(Boolean)
  const mainLabel = lines[0] ?? node.id
  const sublabel = lines[1]

  const lineHeight = theme.node.fontSize + 4
  const totalTextHeight = sublabel
    ? lineHeight + theme.node.sublabelFontSize + 4
    : lineHeight
  const textStartY = y + (height - totalTextHeight) / 2 + theme.node.fontSize

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
          x={cx}
          y={textStartY}
          fill={theme.node.labelColor}
          fontSize={theme.node.fontSize}
          fontWeight={600}
          fontFamily={theme.node.fontFamily}
          textAnchor="middle"
          pointerEvents="none"
        >
          {mainLabel}
        </text>
      )}

      {/* Sublabel */}
      {!isEditing && sublabel && (
        <text
          x={cx}
          y={textStartY + lineHeight}
          fill={theme.node.sublabelColor}
          fontSize={theme.node.sublabelFontSize}
          fontFamily={theme.node.fontFamily}
          textAnchor="middle"
          pointerEvents="none"
        >
          {sublabel}
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

      {/* Category icon */}
      {node.resolvedIcon && (
        <NodeIcon
          icon={node.resolvedIcon}
          x={x + 8}
          y={y + height / 2 - 7}
          size={14}
          color={node.resolvedStroke}
          opacity={0.7}
          customIcons={theme.icons}
        />
      )}
    </g>
  )
}
