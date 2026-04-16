import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'

interface FileNodeProps {
  node: ResolvedNode
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
}

export function FileNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileNodeProps) {
  const { x, y, width, height } = node
  const cx = x + width / 2

  // Display the filename (last segment of path)
  const filePath = node.file ?? ''
  const fileName = filePath.split('/').pop() ?? filePath
  const subpath = node.subpath ?? ''

  return (
    <g
      className="system-canvas-node system-canvas-node--file"
      style={{ cursor: node.isNavigable ? 'pointer' : 'default' }}
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

      {/* File icon */}
      <text
        x={x + 12}
        y={y + height / 2 + 4}
        fill={node.resolvedStroke}
        fontSize={12}
        fontFamily={theme.node.fontFamily}
        pointerEvents="none"
        opacity={0.6}
      >
        {'\u{25A1}'}
      </text>

      {/* Filename */}
      <text
        x={cx}
        y={y + height / 2 + (subpath ? -2 : 4)}
        fill={theme.node.labelColor}
        fontSize={theme.node.fontSize}
        fontWeight={600}
        fontFamily={theme.node.fontFamily}
        textAnchor="middle"
        pointerEvents="none"
      >
        {fileName}
      </text>

      {/* Subpath */}
      {subpath && (
        <text
          x={cx}
          y={y + height / 2 + theme.node.fontSize + 2}
          fill={theme.node.sublabelColor}
          fontSize={theme.node.sublabelFontSize}
          fontFamily={theme.node.fontFamily}
          textAnchor="middle"
          pointerEvents="none"
        >
          {subpath}
        </text>
      )}

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
