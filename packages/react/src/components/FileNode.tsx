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
 * - Text clipped to node bounds
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
  const textPadding = 10
  const maxTextWidth = width - textPadding * 2 - fold

  // File shape: rectangle with a folded corner (top-right)
  const shapePath = [
    `M ${x + 2} ${y}`,
    `L ${x + width - fold} ${y}`,
    `L ${x + width} ${y + fold}`,
    `L ${x + width} ${y + height - 2}`,
    `Q ${x + width} ${y + height} ${x + width - 2} ${y + height}`,
    `L ${x + 2} ${y + height}`,
    `Q ${x} ${y + height} ${x} ${y + height - 2}`,
    `L ${x} ${y + 2}`,
    `Q ${x} ${y} ${x + 2} ${y}`,
    'Z',
  ].join(' ')

  // Fold crease line
  const foldPath = `M ${x + width - fold} ${y} L ${x + width - fold} ${y + fold} L ${x + width} ${y + fold}`

  const strokeColor = node.resolvedStroke
  const thinStroke = 0.75
  const clipId = `file-clip-${node.id}`

  return (
    <g
      className="system-canvas-node system-canvas-node--file"
      style={{ cursor: node.isNavigable ? 'pointer' : 'default' }}
      onClick={(e) => onClick(node, e)}
      onDoubleClick={(e) => onDoubleClick(node, e)}
      onContextMenu={(e) => onContextMenu(node, e)}
    >
      {/* Clip path to contain text within the node */}
      <defs>
        <clipPath id={clipId}>
          <rect
            x={x + textPadding}
            y={y}
            width={maxTextWidth}
            height={height}
          />
        </clipPath>
      </defs>

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

      {/* Clipped text group */}
      <g clipPath={`url(#${clipId})`}>
        {/* Directory path (small, above filename) */}
        {dirPath && (
          <text
            x={x + textPadding}
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
          x={x + textPadding}
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
            x={x + textPadding}
            y={y + (dirPath ? 40 : height / 2 + theme.node.fontSize + 2)}
            fill={theme.node.sublabelColor}
            fontSize={theme.node.sublabelFontSize}
            fontFamily={theme.node.fontFamily}
            pointerEvents="none"
          >
            {subpath}
          </text>
        )}
      </g>

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
