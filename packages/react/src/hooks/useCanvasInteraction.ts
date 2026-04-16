import { useCallback, useRef } from 'react'
import type {
  CanvasNode,
  CanvasEdge,
  ResolvedNode,
  ContextMenuEvent,
  ViewportState,
} from 'system-canvas'
import { screenToCanvas } from 'system-canvas'

interface UseCanvasInteractionOptions {
  onNodeClick?: (node: CanvasNode) => void
  onNodeDoubleClick?: (node: CanvasNode) => void
  onEdgeClick?: (edge: CanvasEdge) => void
  onContextMenu?: (event: ContextMenuEvent) => void
  /** Called when a navigable node (has ref) is clicked */
  onNavigableNodeClick?: (node: ResolvedNode) => void
  viewport: React.RefObject<ViewportState>
}

interface UseCanvasInteractionResult {
  handleNodeClick: (node: ResolvedNode, event: React.MouseEvent) => void
  handleNodeDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  handleEdgeClick: (edge: CanvasEdge, event: React.MouseEvent) => void
  handleCanvasContextMenu: (event: React.MouseEvent) => void
  handleNodeContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  handleEdgeContextMenu: (edge: CanvasEdge, event: React.MouseEvent) => void
}

export function useCanvasInteraction(
  options: UseCanvasInteractionOptions
): UseCanvasInteractionResult {
  const {
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onContextMenu,
    onNavigableNodeClick,
    viewport,
  } = options

  const handleNodeClick = useCallback(
    (node: ResolvedNode, event: React.MouseEvent) => {
      event.stopPropagation()
      if (node.isNavigable) {
        onNavigableNodeClick?.(node)
      }
      onNodeClick?.(node)
    },
    [onNodeClick, onNavigableNodeClick]
  )

  const handleNodeDoubleClick = useCallback(
    (node: ResolvedNode, event: React.MouseEvent) => {
      event.stopPropagation()
      onNodeDoubleClick?.(node)
    },
    [onNodeDoubleClick]
  )

  const handleEdgeClick = useCallback(
    (edge: CanvasEdge, event: React.MouseEvent) => {
      event.stopPropagation()
      onEdgeClick?.(edge)
    },
    [onEdgeClick]
  )

  const createContextMenuHandler = useCallback(
    (
      type: ContextMenuEvent['type'],
      target?: CanvasNode | CanvasEdge
    ) => {
      return (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        if (!onContextMenu) return

        const canvasPos = screenToCanvas(
          event.clientX,
          event.clientY,
          viewport.current
        )
        onContextMenu({
          type,
          target,
          position: canvasPos,
        })
      }
    },
    [onContextMenu, viewport]
  )

  const handleCanvasContextMenu = useCallback(
    (event: React.MouseEvent) => {
      createContextMenuHandler('canvas')(event)
    },
    [createContextMenuHandler]
  )

  const handleNodeContextMenu = useCallback(
    (node: ResolvedNode, event: React.MouseEvent) => {
      createContextMenuHandler('node', node)(event)
    },
    [createContextMenuHandler]
  )

  const handleEdgeContextMenu = useCallback(
    (edge: CanvasEdge, event: React.MouseEvent) => {
      createContextMenuHandler('edge', edge)(event)
    },
    [createContextMenuHandler]
  )

  return {
    handleNodeClick,
    handleNodeDoubleClick,
    handleEdgeClick,
    handleCanvasContextMenu,
    handleNodeContextMenu,
    handleEdgeContextMenu,
  }
}
