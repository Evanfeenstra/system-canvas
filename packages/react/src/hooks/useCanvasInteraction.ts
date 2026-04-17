import { useCallback } from 'react'
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
  onEdgeDoubleClick?: (edge: CanvasEdge) => void
  onContextMenu?: (event: ContextMenuEvent) => void
  /** Called when a navigable node (has ref) is clicked to initiate navigation */
  onNavigableNodeClick?: (node: ResolvedNode) => void
  viewport: React.RefObject<ViewportState>

  // Editable-mode extensions
  editable?: boolean
  onSelect?: (nodeId: string | null) => void
  onBeginEdit?: (node: ResolvedNode) => void
  onSelectEdge?: (edgeId: string | null) => void
  onBeginEditEdge?: (edge: CanvasEdge) => void
}

interface UseCanvasInteractionResult {
  handleNodeClick: (node: ResolvedNode, event: React.MouseEvent) => void
  handleNodeDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  handleNodeNavigate: (node: ResolvedNode, event: React.MouseEvent) => void
  handleEdgeClick: (edge: CanvasEdge, event: React.MouseEvent) => void
  handleEdgeDoubleClick: (edge: CanvasEdge, event: React.MouseEvent) => void
  handleCanvasContextMenu: (event: React.MouseEvent) => void
  handleNodeContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  handleEdgeContextMenu: (edge: CanvasEdge, event: React.MouseEvent) => void
  /** Background click — clears selection */
  handleCanvasClick: (event: React.MouseEvent) => void
}

export function useCanvasInteraction(
  options: UseCanvasInteractionOptions
): UseCanvasInteractionResult {
  const {
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onEdgeDoubleClick,
    onContextMenu,
    onNavigableNodeClick,
    viewport,
    editable,
    onSelect,
    onBeginEdit,
    onSelectEdge,
    onBeginEditEdge,
  } = options

  const handleNodeClick = useCallback(
    (node: ResolvedNode, event: React.MouseEvent) => {
      event.stopPropagation()
      if (editable) {
        onSelect?.(node.id)
        onSelectEdge?.(null)
      }
      onNodeClick?.(node)
    },
    [editable, onNodeClick, onSelect, onSelectEdge]
  )

  const handleNodeDoubleClick = useCallback(
    (node: ResolvedNode, event: React.MouseEvent) => {
      event.stopPropagation()
      onNodeDoubleClick?.(node)
      if (editable) {
        onBeginEdit?.(node)
      }
    },
    [editable, onNodeDoubleClick, onBeginEdit]
  )

  const handleNodeNavigate = useCallback(
    (node: ResolvedNode, _event: React.MouseEvent) => {
      if (node.isNavigable) {
        onNavigableNodeClick?.(node)
      }
    },
    [onNavigableNodeClick]
  )

  const handleEdgeClick = useCallback(
    (edge: CanvasEdge, event: React.MouseEvent) => {
      event.stopPropagation()
      if (editable) {
        onSelectEdge?.(edge.id)
        onSelect?.(null)
      }
      onEdgeClick?.(edge)
    },
    [editable, onEdgeClick, onSelectEdge, onSelect]
  )

  const handleEdgeDoubleClick = useCallback(
    (edge: CanvasEdge, event: React.MouseEvent) => {
      event.stopPropagation()
      onEdgeDoubleClick?.(edge)
      if (editable) {
        onBeginEditEdge?.(edge)
      }
    },
    [editable, onEdgeDoubleClick, onBeginEditEdge]
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

  const handleCanvasClick = useCallback(
    (_event: React.MouseEvent) => {
      if (editable) {
        onSelect?.(null)
        onSelectEdge?.(null)
      }
    },
    [editable, onSelect, onSelectEdge]
  )

  return {
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeNavigate,
    handleEdgeClick,
    handleEdgeDoubleClick,
    handleCanvasContextMenu,
    handleNodeContextMenu,
    handleEdgeContextMenu,
    handleCanvasClick,
  }
}
