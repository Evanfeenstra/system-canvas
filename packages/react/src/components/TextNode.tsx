import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import { NodeIcon } from './NodeIcon.js'

interface TextNodeProps {
  node: ResolvedNode
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
}

export function TextNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
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
      style={{ cursor: node.isNavigable ? 'pointer' : 'default' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
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

      {/* Sublabel */}
      {sublabel && (
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

      {/* Ref indicator */}
      {node.isNavigable && theme.node.refIndicator.icon !== 'none' && (
        <RefIndicator
          x={x + width - 16}
          y={y + height - 16}
          color={theme.node.refIndicator.color}
          icon={theme.node.refIndicator.icon}
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
        />
      )}
    </g>
  )
}

function RefIndicator({
  x,
  y,
  color,
  icon,
}: {
  x: number
  y: number
  color: string
  icon: string
}) {
  const size = 10
  switch (icon) {
    case 'chevron':
      return (
        <path
          d={`M ${x} ${y} l ${size / 2} ${size / 2} l ${-size / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )
    case 'arrow':
      return (
        <path
          d={`M ${x} ${y + size} l ${size} ${-size / 2} l ${-size} ${-size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )
    case 'expand':
      return (
        <g pointerEvents="none">
          <rect
            x={x}
            y={y}
            width={size}
            height={size}
            fill="none"
            stroke={color}
            strokeWidth={1}
            rx={2}
          />
          <line
            x1={x + size / 2}
            y1={y + 2}
            x2={x + size / 2}
            y2={y + size - 2}
            stroke={color}
            strokeWidth={1}
          />
          <line
            x1={x + 2}
            y1={y + size / 2}
            x2={x + size - 2}
            y2={y + size / 2}
            stroke={color}
            strokeWidth={1}
          />
        </g>
      )
    default:
      return null
  }
}


