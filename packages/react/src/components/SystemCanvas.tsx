import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import type {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  CanvasTheme,
  EdgeStyle,
  ViewportState,
  ContextMenuEvent,
  ResolvedNode,
  NodeUpdate,
  EdgeUpdate,
  NodeMenuOption,
} from 'system-canvas'
import {
  resolveTheme,
  resolveCanvas,
  buildNodeMap,
  darkTheme,
  themes,
  getNodeMenuOptions,
  createNodeFromOption,
  screenToCanvas,
} from 'system-canvas'
import { useNavigation } from '../hooks/useNavigation.js'
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js'
import { useNodeDrag } from '../hooks/useNodeDrag.js'
import { useNodeResize } from '../hooks/useNodeResize.js'
import { useEdgeCreate } from '../hooks/useEdgeCreate.js'
import { Viewport, type ViewportHandle } from './Viewport.js'
import { Breadcrumbs } from './Breadcrumbs.js'
import { AddNodeButton, type AddNodeButtonRenderProps } from './AddNodeButton.js'

export interface SystemCanvasProps {
  /** Canvas data to render */
  canvas: CanvasData

  /** Resolve a ref string to canvas data (for navigation) */
  onResolveCanvas?: (ref: string) => Promise<CanvasData>

  /**
   * Synchronous map from ref to CanvasData. Required for `editable` mode so
   * the library can observe consumer-side edits to sub-canvases.
   */
  canvases?: Record<string, CanvasData>

  /** Root label for breadcrumbs (default: "Home") */
  rootLabel?: string

  /** Called when navigation occurs */
  onNavigate?: (ref: string) => void

  /** Called when a breadcrumb is clicked */
  onBreadcrumbClick?: (index: number) => void

  // --- Interaction callbacks ---
  onNodeClick?: (node: CanvasNode) => void
  onNodeDoubleClick?: (node: CanvasNode) => void
  onEdgeClick?: (edge: CanvasEdge) => void
  onEdgeDoubleClick?: (edge: CanvasEdge) => void
  onContextMenu?: (event: ContextMenuEvent) => void

  // --- Editing ---
  /** When true, the canvas becomes editable (add / edit / move / delete). */
  editable?: boolean
  onNodeAdd?: (node: CanvasNode, canvasRef: string | undefined) => void
  onNodeUpdate?: (
    nodeId: string,
    patch: NodeUpdate,
    canvasRef: string | undefined
  ) => void
  onNodeDelete?: (nodeId: string, canvasRef: string | undefined) => void
  onEdgeUpdate?: (
    edgeId: string,
    patch: EdgeUpdate,
    canvasRef: string | undefined
  ) => void
  onEdgeDelete?: (edgeId: string, canvasRef: string | undefined) => void
  onEdgeAdd?: (edge: CanvasEdge, canvasRef: string | undefined) => void
  /** Fully replace the default add-node FAB. */
  renderAddNodeButton?: (props: AddNodeButtonRenderProps) => React.ReactNode

  // --- Theming ---
  theme?: CanvasTheme | Partial<CanvasTheme>

  // --- Edge rendering ---
  edgeStyle?: EdgeStyle

  // --- Viewport ---
  defaultViewport?: ViewportState
  minZoom?: number
  maxZoom?: number
  onViewportChange?: (viewport: ViewportState) => void
  /**
   * Controls when the viewport auto-fits to the visible content.
   *
   * - `'canvas-change'` (default): fit on initial mount and when navigating
   *   to a different canvas. Edits (add / move / resize / delete) do NOT
   *   trigger a re-fit.
   * - `'always'`: fit on initial mount and whenever the node set changes,
   *   including after every edit. This is the legacy behavior.
   * - `'initial'`: fit once on initial mount only.
   * - `'never'`: do not auto-fit. Use `defaultViewport` and/or manual
   *   control via consumer-managed viewport state.
   */
  autoFit?: 'canvas-change' | 'always' | 'initial' | 'never'

  // --- Styling ---
  className?: string
  style?: React.CSSProperties
}

const CASCADE_WINDOW_MS = 1500
const CASCADE_OFFSET = 20

export function SystemCanvas({
  canvas,
  onResolveCanvas,
  canvases,
  rootLabel = 'Home',
  onNavigate,
  onBreadcrumbClick,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  onEdgeDoubleClick,
  onContextMenu,
  editable = false,
  onNodeAdd,
  onNodeUpdate,
  onNodeDelete,
  onEdgeUpdate,
  onEdgeDelete,
  onEdgeAdd,
  renderAddNodeButton,
  theme: themeProp,
  edgeStyle = 'bezier',
  defaultViewport,
  minZoom = 0.1,
  maxZoom = 4,
  onViewportChange,
  autoFit = 'canvas-change',
  className,
  style,
}: SystemCanvasProps) {
  // Dev warning for missing canvases prop in editable mode
  useEffect(() => {
    const env = (globalThis as any).process?.env?.NODE_ENV
    if (editable && !canvases && env !== 'production') {
      console.warn(
        '[system-canvas] `editable` is enabled but `canvases` prop is missing. ' +
          'Edits to sub-canvases will not be reflected without a synchronous ' +
          'ref → CanvasData map.'
      )
    }
  }, [editable, canvases])

  // Resolve theme: prop theme > canvas-level base hint > darkTheme
  const theme = useMemo(() => {
    let base: CanvasTheme
    if (themeProp) {
      if ('name' in themeProp && 'background' in themeProp && 'grid' in themeProp) {
        base = themeProp as CanvasTheme
      } else {
        base = resolveTheme(themeProp as Partial<CanvasTheme>)
      }
    } else if (canvas.theme?.base && canvas.theme.base in themes) {
      base = themes[canvas.theme.base as keyof typeof themes]
    } else {
      base = darkTheme
    }
    return base
  }, [themeProp, canvas.theme?.base])

  // Navigation state
  const {
    canvas: currentCanvas,
    currentCanvasRef,
    breadcrumbs,
    isLoading,
    navigateToRef,
    navigateToBreadcrumb,
  } = useNavigation({
    rootCanvas: canvas,
    rootLabel,
    canvases,
    onResolveCanvas,
    onNavigate,
    onBreadcrumbClick,
  })

  // Resolve canvas data (apply theme, categories, defaults)
  const { nodes, edges, nodeMap } = useMemo(() => {
    const resolved = resolveCanvas(currentCanvas, theme)
    const map = buildNodeMap(resolved.nodes)
    return { nodes: resolved.nodes, edges: resolved.edges, nodeMap: map }
  }, [currentCanvas, theme])

  // Keep a ref to the latest nodes so useNodeDrag can look up group children
  // without forcing re-creations of its callbacks.
  const nodesRef = useRef<ResolvedNode[]>(nodes)
  nodesRef.current = nodes

  // Viewport refs
  const viewportStateRef = useRef<ViewportState>(
    defaultViewport ?? { x: 0, y: 0, zoom: 1 }
  )
  const viewportHandleRef = useRef<ViewportHandle>(null)

  // Selection + editing state (editable mode)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)

  // Clear selection/editing when navigating between canvases
  useEffect(() => {
    setSelectedId(null)
    setEditingId(null)
    setSelectedEdgeId(null)
    setEditingEdgeId(null)
  }, [currentCanvasRef])

  // Drag
  const commitDrag = useCallback(
    (id: string, patch: NodeUpdate) => {
      onNodeUpdate?.(id, patch, currentCanvasRef)
    },
    [onNodeUpdate, currentCanvasRef]
  )

  const { dragOverrides, onPointerDown: onNodePointerDown } = useNodeDrag({
    viewport: viewportStateRef,
    nodesRef,
    onCommit: commitDrag,
  })

  const { resizeOverrides, onHandlePointerDown: onResizeHandlePointerDown } =
    useNodeResize({
      viewport: viewportStateRef,
      onCommit: commitDrag,
    })

  // Proxy ref pointing at the SVG element exposed by the viewport handle.
  // Updated on every render so useEdgeCreate can convert client coords.
  const svgProxyRef = useRef<SVGSVGElement | null>(null)
  svgProxyRef.current = viewportHandleRef.current?.getSvgElement() ?? null

  const handleEdgeCreated = useCallback(
    (edge: CanvasEdge) => {
      onEdgeAdd?.(edge, currentCanvasRef)
    },
    [onEdgeAdd, currentCanvasRef]
  )

  const { pending: pendingEdge, onHandlePointerDown: onConnectionHandlePointerDown } =
    useEdgeCreate({
      svgRef: svgProxyRef,
      viewport: viewportStateRef,
      nodesRef,
      onCreate: handleEdgeCreated,
    })

  // Zoom-then-navigate: animate toward the node, then swap canvas
  const handleNavigableNodeClick = useCallback(
    (node: ResolvedNode) => {
      const handle = viewportHandleRef.current
      if (handle) {
        handle.zoomToNode(node, () => {
          navigateToRef(node)
        })
      } else {
        navigateToRef(node)
      }
    },
    [navigateToRef]
  )

  const handleBeginEdit = useCallback((node: ResolvedNode) => {
    setEditingId(node.id)
  }, [])

  const handleBeginEditEdge = useCallback((edge: CanvasEdge) => {
    setEditingEdgeId(edge.id)
  }, [])

  // Interaction handlers
  const {
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeNavigate,
    handleEdgeClick,
    handleEdgeDoubleClick,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleNodeContextMenu,
    handleEdgeContextMenu,
  } = useCanvasInteraction({
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onEdgeDoubleClick,
    onContextMenu,
    onNavigableNodeClick: handleNavigableNodeClick,
    viewport: viewportStateRef,
    editable,
    onSelect: setSelectedId,
    onBeginEdit: handleBeginEdit,
    onSelectEdge: setSelectedEdgeId,
    onBeginEditEdge: handleBeginEditEdge,
  })

  // Editor commit/cancel
  const handleEditorCommit = useCallback(
    (patch: NodeUpdate) => {
      if (editingId) {
        onNodeUpdate?.(editingId, patch, currentCanvasRef)
      }
      setEditingId(null)
    },
    [editingId, onNodeUpdate, currentCanvasRef]
  )
  const handleEditorCancel = useCallback(() => {
    setEditingId(null)
  }, [])

  // Edge editor commit/cancel
  const handleEdgeEditorCommit = useCallback(
    (patch: EdgeUpdate) => {
      if (editingEdgeId) {
        onEdgeUpdate?.(editingEdgeId, patch, currentCanvasRef)
      }
      setEditingEdgeId(null)
    },
    [editingEdgeId, onEdgeUpdate, currentCanvasRef]
  )
  const handleEdgeEditorCancel = useCallback(() => {
    setEditingEdgeId(null)
  }, [])

  // Cascade offset for rapid successive adds
  const lastAddRef = useRef<{ t: number; offset: number } | null>(null)

  // Add-node menu plumbing
  const menuOptions = useMemo<NodeMenuOption[]>(
    () => getNodeMenuOptions(currentCanvas, theme),
    [currentCanvas, theme]
  )

  const addNode = useCallback(
    (option: NodeMenuOption, position?: { x: number; y: number }) => {
      // Compute default position: viewport center in canvas-space, with
      // a cascade offset for rapid successive adds.
      let x: number, y: number
      if (position) {
        x = position.x
        y = position.y
      } else {
        const handle = viewportHandleRef.current
        const svg = handle?.getSvgElement()
        if (svg) {
          const rect = svg.getBoundingClientRect()
          const centerScreen = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          }
          const vp = handle!.getViewport()
          const canvasPos = screenToCanvas(centerScreen.x, centerScreen.y, vp)
          x = canvasPos.x
          y = canvasPos.y
        } else {
          x = 0
          y = 0
        }

        const now = Date.now()
        const last = lastAddRef.current
        const nextOffset =
          last && now - last.t < CASCADE_WINDOW_MS
            ? last.offset + CASCADE_OFFSET
            : 0
        x += nextOffset
        y += nextOffset
        lastAddRef.current = { t: now, offset: nextOffset }
      }

      const node = createNodeFromOption(option, Math.round(x), Math.round(y))
      onNodeAdd?.(node, currentCanvasRef)
    },
    [onNodeAdd, currentCanvasRef]
  )

  // Keyboard: Delete/Backspace removes selected node/edge; Escape clears selection/editing
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!editable) return
      if (e.key === 'Escape') {
        setEditingId(null)
        setSelectedId(null)
        setEditingEdgeId(null)
        setSelectedEdgeId(null)
        return
      }
      if (editingId || editingEdgeId) return // let the editor own the keys
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault()
          onNodeDelete?.(selectedId, currentCanvasRef)
          setSelectedId(null)
        } else if (selectedEdgeId) {
          e.preventDefault()
          onEdgeDelete?.(selectedEdgeId, currentCanvasRef)
          setSelectedEdgeId(null)
        }
      }
    },
    [
      editable,
      editingId,
      editingEdgeId,
      selectedId,
      selectedEdgeId,
      onNodeDelete,
      onEdgeDelete,
      currentCanvasRef,
    ]
  )

  const renderProps: AddNodeButtonRenderProps = { options: menuOptions, addNode, theme }

  return (
    <div
      className={`system-canvas ${className ?? ''}`}
      tabIndex={editable ? 0 : -1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        outline: 'none',
        ...style,
      }}
    >
      {/* Breadcrumbs overlay */}
      <Breadcrumbs
        breadcrumbs={breadcrumbs}
        theme={theme.breadcrumbs}
        onNavigate={navigateToBreadcrumb}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div
          className="system-canvas-loading"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            padding: '6px 12px',
            background: theme.breadcrumbs.background,
            borderRadius: 8,
            color: theme.breadcrumbs.textColor,
            fontFamily: theme.node.fontFamily,
            fontSize: 12,
            backdropFilter: 'blur(8px)',
          }}
        >
          Loading...
        </div>
      )}

      {/* SVG viewport */}
      <Viewport
        ref={viewportHandleRef}
        nodes={nodes}
        edges={edges}
        nodeMap={nodeMap}
        theme={theme}
        edgeStyle={edgeStyle}
        minZoom={minZoom}
        maxZoom={maxZoom}
        defaultViewport={defaultViewport}
        autoFit={autoFit}
        canvasRef={currentCanvasRef}
        onViewportChange={(vp) => {
          viewportStateRef.current = vp
          onViewportChange?.(vp)
        }}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeNavigate={handleNodeNavigate}
        onEdgeClick={handleEdgeClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onCanvasClick={editable ? handleCanvasClick : undefined}
        onCanvasContextMenu={handleCanvasContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodePointerDown={editable ? onNodePointerDown : undefined}
        selectedId={editable ? selectedId : null}
        editingId={editable ? editingId : null}
        selectedEdgeId={editable ? selectedEdgeId : null}
        editingEdgeId={editable ? editingEdgeId : null}
        dragOverrides={dragOverrides}
        resizeOverrides={resizeOverrides}
        onResizeHandlePointerDown={editable ? onResizeHandlePointerDown : undefined}
        onEditorCommit={handleEditorCommit}
        onEditorCancel={handleEditorCancel}
        onEdgeEditorCommit={handleEdgeEditorCommit}
        onEdgeEditorCancel={handleEdgeEditorCancel}
        pendingEdge={editable ? pendingEdge : null}
        onConnectionHandlePointerDown={
          editable ? onConnectionHandlePointerDown : undefined
        }
        edgeCreateEnabled={editable}
      />

      {/* Add-node FAB (editable only) */}
      {editable &&
        (renderAddNodeButton
          ? renderAddNodeButton(renderProps)
          : <AddNodeButton {...renderProps} />)}
    </div>
  )
}
