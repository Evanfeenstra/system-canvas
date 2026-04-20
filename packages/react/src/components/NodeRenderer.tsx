import React from 'react'
import type { CanvasData, ResolvedNode, CanvasTheme } from 'system-canvas'
import {
  computeReflowReservations,
  getCategorySlots,
  pickRefIndicatorCorner,
} from 'system-canvas'
import { TextNode } from './TextNode.js'
import { FileNode } from './FileNode.js'
import { LinkNode } from './LinkNode.js'
import { GroupNode } from './GroupNode.js'
import { ResizeHandles } from './ResizeHandles.js'
import { CategorySlotsLayer } from './CategorySlotsLayer.js'
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
   * Synchronous canvases map used by slot accessors (`ctx.rollup`,
   * `ctx.getSubCanvas`). Consumers typically pass the same map they give
   * to `SystemCanvas`.
   */
  canvases?: Record<string, CanvasData>
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
 *
 * For each node:
 *   1. Look up its category slots.
 *   2. Compute reflow reservations so text/icons don't collide with slots.
 *   3. Pick a ref-indicator corner (default, or displaced when occupied).
 *   4. Render the node body, then `CategorySlotsLayer` on top in the same
 *      `<g>` so slot primitives paint above the body but below the ref
 *      indicator and resize handles.
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
  canvases,
  only,
}: NodeRendererProps) {
  const groups = nodes.filter((n) => n.type === 'group')
  const others = nodes.filter((n) => n.type !== 'group')

  const common = (node: ResolvedNode) => {
    const slots = getCategorySlots(node, theme)
    const reservations = computeReflowReservations(node, theme, slots)
    // Groups default to top-right; everything else defaults to bottom-right.
    const defaultCorner =
      node.type === 'group' ? 'topRight' : 'bottomRight'
    const refCorner = pickRefIndicatorCorner(defaultCorner, slots)
    return {
      node,
      theme,
      onClick,
      onDoubleClick,
      onContextMenu,
      onNavigate,
      onPointerDown,
      isSelected: selectedId === node.id,
      isEditing: editingId === node.id,
      slots,
      canvases,
      reservedTop: reservations.top,
      reservedBottom: reservations.bottom,
      reservedLeft: reservations.left,
      reservedRight: reservations.right,
      refCorner,
    }
  }

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

export { CategorySlotsLayer }
