import React from 'react'
import type { ResolvedNode, CanvasTheme } from 'system-canvas'
import { TextNode } from './TextNode.js'
import { FileNode } from './FileNode.js'
import { LinkNode } from './LinkNode.js'
import { GroupNode } from './GroupNode.js'
import { ResizeHandles } from './ResizeHandles.js'
import type { ResizeCorner } from '../hooks/useNodeResize.js'

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
  onResizeHandlePointerDown?: (
    node: ResolvedNode,
    corner: ResizeCorner,
    event: React.PointerEvent
  ) => void
  /**
   * Render only a subset of nodes:
   *   'groups'     → only group nodes
   *   'non-groups' → everything except groups
   *   undefined    → all nodes (groups first, then others)
   * Callers can use this to interleave edges between groups and other nodes.
   */
  only?: 'groups' | 'non-groups'
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
  onResizeHandlePointerDown,
  only,
}: NodeRendererProps) {
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

  const selectedNode =
    selectedId && editingId !== selectedId
      ? nodes.find((n) => n.id === selectedId)
      : undefined

  // Resize handles belong on the topmost layer: only render them when we're
  // drawing non-groups (or everything), so they end up above edges and nodes.
  const renderResizeHandles =
    only !== 'groups' && selectedNode && onResizeHandlePointerDown

  return (
    <>
      {only !== 'non-groups' &&
        groups.map((node) => <GroupNode key={node.id} {...common(node)} />)}

      {only !== 'groups' &&
        others.map((node) => {
          const Component = getNodeComponent(node.type)
          return <Component key={node.id} {...common(node)} />
        })}

      {renderResizeHandles && (
        <ResizeHandles
          node={selectedNode!}
          theme={theme}
          onHandlePointerDown={onResizeHandlePointerDown!}
        />
      )}
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
