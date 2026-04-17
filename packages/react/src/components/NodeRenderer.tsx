import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import { TextNode } from './TextNode.js'
import { FileNode } from './FileNode.js'
import { LinkNode } from './LinkNode.js'
import { GroupNode } from './GroupNode.js'

interface NodeRendererProps {
  nodes: ResolvedNode[]
  theme: CanvasTheme
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  onNavigate: (node: ResolvedNode, event: React.MouseEvent) => void
  onPointerDown?: (node: ResolvedNode, event: React.PointerEvent) => void
  selectedId?: string | null
  editingId?: string | null
}

/**
 * Renders all nodes, dispatching to the appropriate type-specific component.
 * Groups are rendered first (lower z-index), then other nodes in array order.
 */
export function NodeRenderer({
  nodes,
  theme,
  onClick,
  onDoubleClick,
  onContextMenu,
  onNavigate,
  onPointerDown,
  selectedId,
  editingId,
}: NodeRendererProps) {
  // Separate groups from other nodes to ensure proper z-ordering.
  // Groups render first (behind), other nodes render on top.
  const groups = nodes.filter((n) => n.type === 'group')
  const others = nodes.filter((n) => n.type !== 'group')

  const common = (node: ResolvedNode) => ({
    node,
    theme,
    onClick,
    onDoubleClick,
    onContextMenu,
    onNavigate,
    onPointerDown,
    isSelected: selectedId === node.id,
    isEditing: editingId === node.id,
  })

  return (
    <>
      {/* Groups first (behind) */}
      {groups.map((node) => (
        <GroupNode key={node.id} {...common(node)} />
      ))}

      {/* Other nodes on top, in array order */}
      {others.map((node) => {
        const Component = getNodeComponent(node.type)
        return <Component key={node.id} {...common(node)} />
      })}
    </>
  )
}

function getNodeComponent(type: string) {
  switch (type) {
    case 'file':
      return FileNode
    case 'link':
      return LinkNode
    default:
      return TextNode
  }
}
