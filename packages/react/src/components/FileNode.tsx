import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'

interface FileNodeProps {
  node: ResolvedNode
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
}

/**
 * File nodes have a distinct visual style:
 * - Square corners (rx=2) instead of rounded
 * - Thinner border (0.75px)
 * - Dog-ear fold in the top-right corner
 * - Monospace filename rendering
 */
export function FileNode({
  node,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileNodeProps) {
  const { x, y, width, height } = node

  // Display the filename (last segment of path)
  const filePath = node.file ?? ''
  const fileName = filePath.split('/').pop() ?? filePath
  const dirPath = filePath.includes('/')
    ? filePath.slice(0, filePath.lastIndexOf('/'))
    : ''
  const subpath = node.subpath ?? ''

  // Dog-ear size
  const fold = 10

  // File shape: rectangle with a folded corner (top-right)
  const shapePath = [
    `M ${x + 2} ${y}`,              // top-left (slight radius start)
    `L ${x + width - fold} ${y}`,    // top edge to fold start
    `L ${x + width} ${y + fold}`,    // diagonal fold
    `L ${x + width} ${y + height - 2}`, // right edge
    `Q ${x + width} ${y + height} ${x + width - 2} ${y + height}`, // bottom-right corner
    `L ${x + 2} ${y + height}`,      // bottom edge
    `Q ${x} ${y + height} ${x} ${y + height - 2}`, // bottom-left corner
    `L ${x} ${y + 2}`,              // left edge
    `Q ${x} ${y} ${x + 2} ${y}`,    // top-left corner
    'Z',
  ].join(' ')

  // Fold crease line
  const foldPath = `M ${x + width - fold} ${y} L ${x + width - fold} ${y + fold} L ${x + width} ${y + fold}`

  const strokeColor = node.resolvedStroke
  const thinStroke = 0.75

  return (
    <g
      className="system-canvas-node system-canvas-node--file"
      style={{ cursor: node.isNavigable ? 'pointer' : 'default' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
    >
      {/* Opaque backer */}
      <path d={shapePath} fill={theme.background} />
      {/* Styled overlay */}
      <path
        d={shapePath}
        fill={node.resolvedFill}
        stroke={strokeColor}
        strokeWidth={thinStroke}
      />
      {/* Fold crease */}
      <path
        d={foldPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={thinStroke}
        opacity={0.5}
      />

      {/* Directory path (small, above filename) */}
      {dirPath && (
        <text
          x={x + 10}
          y={y + 14}
          fill={theme.node.sublabelColor}
          fontSize={theme.node.sublabelFontSize - 1}
          fontFamily={theme.node.fontFamily}
          pointerEvents="none"
          opacity={0.6}
        >
          {dirPath}/
        </text>
      )}

      {/* Filename */}
      <text
        x={x + 10}
        y={y + (dirPath ? 28 : height / 2 + (subpath ? -2 : 4))}
        fill={theme.node.labelColor}
        fontSize={theme.node.fontSize - 1}
        fontWeight={500}
        fontFamily={theme.node.fontFamily}
        pointerEvents="none"
      >
        {fileName}
      </text>

      {/* Subpath */}
      {subpath && (
        <text
          x={x + 10}
          y={y + (dirPath ? 40 : height / 2 + theme.node.fontSize + 2)}
          fill={theme.node.sublabelColor}
          fontSize={theme.node.sublabelFontSize}
          fontFamily={theme.node.fontFamily}
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
