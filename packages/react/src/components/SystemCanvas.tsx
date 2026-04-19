import React, {
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react'
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
  snapToLane,
} from 'system-canvas'
import { useNavigation } from '../hooks/useNavigation.js'
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js'
import { useNodeDrag } from '../hooks/useNodeDrag.js'
import { useNodeResize } from '../hooks/useNodeResize.js'
import { useEdgeCreate } from '../hooks/useEdgeCreate.js'
import {
  useZoomNavigation,
  type ParentFrame,
  type ZoomNavigationConfig,
} from '../hooks/useZoomNavigation.js'
import { Viewport, type ViewportHandle } from './Viewport.js'
import { Breadcrumbs } from './Breadcrumbs.js'
import { AddNodeButton, type AddNodeButtonRenderProps } from './AddNodeButton.js'
import { LaneHeaders } from './LaneHeaders.js'
import { NodeToolbar, type NodeToolbarRenderProps } from './NodeToolbar.js'

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

  /**
   * Controls the floating toolbar that appears above a selected node in
   * editable mode. Defaults to `true`. Pass `false` to suppress it entirely
   * (consumers can still build their own UI via `onContextMenu`).
   */
  showNodeToolbar?: boolean

  /**
   * Fully replace the default node toolbar contents. The library still
   * positions the toolbar container above the node; the render prop supplies
   * its inner React nodes. Receives `{ node, theme, patch, deleteNode }`.
   */
  renderNodeToolbar?: (props: NodeToolbarRenderProps) => React.ReactNode

  // --- Theming ---
  /**
   * Theme applied to the entire canvas. When omitted, the library falls
   * back to (in order): the current canvas's `theme.base` hint, then the
   * root canvas's `theme.base` hint, then `darkTheme`. Supplying this
   * prop forces the theme regardless of canvas-level hints.
   */
  theme?: CanvasTheme | Partial<CanvasTheme>

  /**
   * Optional map of additional themes, keyed by name. Merged with the
   * built-in themes (dark, midnight, light, blueprint, warm, roadmap) and
   * consulted when a canvas declares `theme.base`. This is how you wire
   * custom themes into the per-canvas theming mechanism — set
   * `canvas.theme.base = 'kanban'` and the library looks it up here.
   */
  themes?: Record<string, CanvasTheme>

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

  /**
   * Controls rendering of the lane header strips (column labels on top,
   * row labels on the left) when the current canvas has `columns` or `rows`.
   *
   * - `'pinned'` (default): headers stay glued to the viewport edges,
   *   so labels are always visible as the user pans/zooms.
   * - `'scroll'`: headers live at the top/left of the lane grid and
   *   move with the content.
   * - `'none'`: no headers are drawn. The lane bands still render.
   */
  laneHeaders?: 'pinned' | 'scroll' | 'none'

  /**
   * When true and the current canvas has `columns` or `rows`, dragged nodes
   * snap their x (for columns) and y (for rows) to the nearest lane start.
   * Defaults to `false` so existing behavior is preserved.
   */
  snapToLanes?: boolean

  /**
   * When enabled, zooming into a ref-bearing node past a threshold commits
   * the navigation and continues seamlessly inside the sub-canvas. Zooming
   * back out past a threshold pops to the parent. Accepts `true` for the
   * default config, or an object to tune thresholds.
   *
   * Defaults to `false`. When `true` and `maxZoom` is not explicitly set,
   * the effective max zoom is raised so small nodes can reach the enter
   * threshold.
   */
  zoomNavigation?: boolean | ZoomNavigationConfig

  // --- Styling ---
  className?: string
  style?: React.CSSProperties
}

const CASCADE_WINDOW_MS = 1500
const CASCADE_OFFSET = 20

/**
 * Imperative handle exposed on the SystemCanvas component ref. Lets a
 * parent drive the camera — e.g. play a cinematic tour that zooms through
 * a chain of ref-bearing nodes.
 */
export interface SystemCanvasHandle {
  /**
   * Animate the camera into a node in the currently-viewed canvas, then
   * (if the node has a `ref`) navigate into its sub-canvas and fit that
   * sub-canvas to the viewport. Resolves when the new canvas has mounted
   * and finished fitting, so consumers can chain `await` calls to build a
   * multi-step tour.
   *
   * If the node has no `ref`, the zoom animation plays and the promise
   * resolves without navigating.
   */
  zoomIntoNode: (
    nodeId: string,
    options?: { durationMs?: number; targetZoom?: number }
  ) => Promise<void>
  /** Navigate back up one level in the breadcrumb stack. */
  navigateBack: () => void
  /** Reset to the root canvas. */
  navigateToRoot: () => void
}

export const SystemCanvas = forwardRef<SystemCanvasHandle, SystemCanvasProps>(
  function SystemCanvas(
    {
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
      showNodeToolbar = true,
      renderNodeToolbar,
      theme: themeProp,
      themes: customThemes,
      edgeStyle = 'bezier',
      defaultViewport,
      minZoom: minZoomProp,
      maxZoom,
      onViewportChange,
      autoFit = 'canvas-change',
      laneHeaders = 'pinned',
      snapToLanes = false,
      zoomNavigation = false,
      className,
      style,
    },
    forwardedRef
  ) {
  // Resolve zoom-nav config
  const zoomNavConfig = useMemo(() => {
    const defaults = {
      enterThreshold: 0.66,
      exitThreshold: 0.33,
      prefetchThreshold: 0.4,
      landingScale: 1.2,
      landingPadding: 0.08,
      fadeDuration: 216,
    }
    if (!zoomNavigation) return { enabled: false, ...defaults }
    if (zoomNavigation === true) return { enabled: true, ...defaults }
    return {
      enabled: true,
      enterThreshold: zoomNavigation.enterThreshold ?? defaults.enterThreshold,
      exitThreshold: zoomNavigation.exitThreshold ?? defaults.exitThreshold,
      prefetchThreshold:
        zoomNavigation.prefetchThreshold ?? defaults.prefetchThreshold,
      landingScale: zoomNavigation.landingScale ?? defaults.landingScale,
      landingPadding:
        zoomNavigation.landingPadding ?? defaults.landingPadding,
      fadeDuration:
        zoomNavigation.fadeDuration ?? defaults.fadeDuration,
    }
  }, [zoomNavigation])

  // When zoom-navigation is enabled and the zoom extents are not
  // explicitly set, widen them so (a) small nodes can be zoomed up to the
  // enter threshold, and (b) child-canvas handoff transforms that require
  // very small zoom to fit don't get clamped.
  const effectiveMaxZoom = maxZoom ?? (zoomNavConfig.enabled ? 16 : 4)
  const effectiveMinZoom =
    minZoomProp ?? (zoomNavConfig.enabled ? 0.01 : 0.1)
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

  // Zoom-navigation state: stack of parent frames, one per breadcrumb
  // entry beyond root. parentFrames[i] describes how we entered the
  // canvas at breadcrumb index i+1. Frames are populated when entering
  // via zoom-navigation; for discrete (click) navigation they're null so
  // zoom-exit is disabled from that canvas.
  const [parentFrames, setParentFrames] = useState<(ParentFrame | null)[]>([])
  const [pendingHandoff, setPendingHandoff] = useState<ViewportState | null>(
    null
  )

  // Guard to suppress the "clear handoff" side-effect inside
  // handleBreadcrumbClick when the breadcrumb click is a programmatic
  // side-effect of zoom-exit (which needs the handoff preserved).
  const suppressNextHandoffClearRef = useRef(false)

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      // Truncate the parent-frames stack to match the new breadcrumb depth.
      // Breadcrumb index 0 is root (no parent frame); depth of frames is
      // `breadcrumbs.length - 1`. After clicking breadcrumb index, depth
      // becomes `index`.
      setParentFrames((prev) => prev.slice(0, index))
      if (suppressNextHandoffClearRef.current) {
        suppressNextHandoffClearRef.current = false
      } else {
        setPendingHandoff(null)
      }
      onBreadcrumbClick?.(index)
    },
    [onBreadcrumbClick]
  )

  // Navigation state
  const {
    canvas: currentCanvas,
    currentCanvasRef,
    breadcrumbs,
    isLoading,
    navigateToRef,
    navigateToBreadcrumb,
    seedCanvas,
  } = useNavigation({
    rootCanvas: canvas,
    rootLabel,
    canvases,
    onResolveCanvas,
    onNavigate,
    onBreadcrumbClick: handleBreadcrumbClick,
  })

  // Resolve theme with per-canvas awareness.
  //
  //   1. An explicit `theme` prop always wins — consumer is in full control.
  //   2. Else if the *currently-viewed* canvas declares `theme.base`, use
  //      that. This is what enables "zoom into a node, land in a themed
  //      sub-canvas" UX — navigate between canvases and the theme swaps
  //      automatically. Names are resolved against the built-in `themes`
  //      registry plus any `customThemes` the consumer provided.
  //   3. Else if the *root* canvas declares `theme.base`, use that (so the
  //      root's preference carries to sub-canvases that don't specify one).
  //   4. Else fall back to `darkTheme`.
  const theme = useMemo(() => {
    const registry: Record<string, CanvasTheme> = { ...themes, ...customThemes }

    const resolveByName = (name: string | undefined): CanvasTheme | null =>
      name && registry[name] ? registry[name] : null

    if (themeProp) {
      if ('name' in themeProp && 'background' in themeProp && 'grid' in themeProp) {
        return themeProp as CanvasTheme
      }
      return resolveTheme(themeProp as Partial<CanvasTheme>)
    }
    return (
      resolveByName(currentCanvas.theme?.base) ??
      resolveByName(canvas.theme?.base) ??
      darkTheme
    )
  }, [themeProp, customThemes, currentCanvas.theme?.base, canvas.theme?.base])

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

  // Stable refs used by the imperative handle. We keep them updated on
  // every render so the handle methods (created once via
  // useImperativeHandle) always see fresh state without forcing
  // consumers to re-capture the handle on every canvas swap.
  const navigateToRefRef = useRef<typeof navigateToRef>(navigateToRef)
  navigateToRefRef.current = navigateToRef
  const navigateToBreadcrumbRef = useRef<typeof navigateToBreadcrumb>(
    navigateToBreadcrumb
  )
  navigateToBreadcrumbRef.current = navigateToBreadcrumb
  const breadcrumbsRef = useRef(breadcrumbs)
  breadcrumbsRef.current = breadcrumbs

  // Expose an imperative API for programmatic camera control (tours, etc.)
  useImperativeHandle(
    forwardedRef,
    () => ({
      zoomIntoNode: (nodeId, options) => {
        return new Promise<void>((resolve) => {
          const node = nodesRef.current.find((n) => n.id === nodeId)
          const handle = viewportHandleRef.current
          if (!node || !handle) {
            resolve()
            return
          }
          // Phase 1: animate the camera into the node.
          handle.zoomToNode(
            node,
            () => {
              // Phase 2: if the node has a ref, navigate into the
              // sub-canvas. `navigateToRef` is async (may fetch data).
              if (!node.ref) {
                resolve()
                return
              }
              void navigateToRefRef.current(node).then(() => {
                // Give React two frames to render the new canvas so that
                // the next `zoomIntoNode` call — which reads
                // `nodesRef.current` — sees the freshly-mounted sub-canvas
                // nodes. The first rAF lets React commit, the second lets
                // the post-commit effects (including auto-fit) run.
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => resolve())
                })
              })
            },
            options
          )
        })
      },
      navigateBack: () => {
        const crumbs = breadcrumbsRef.current
        if (crumbs.length > 1) {
          navigateToBreadcrumbRef.current(crumbs.length - 2)
        }
      },
      navigateToRoot: () => {
        navigateToBreadcrumbRef.current(0)
      },
    }),
    [forwardedRef]
  )

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

  // Container size — tracked so the lane-header overlay can size itself.
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 }
  )
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setContainerSize({ width: r.width, height: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const hasLanes =
    (currentCanvas.columns && currentCanvas.columns.length > 0) ||
    (currentCanvas.rows && currentCanvas.rows.length > 0)
  const showLaneHeaders = hasLanes && laneHeaders !== 'none'

  const getViewportState = useCallback(
    () => viewportStateRef.current ?? { x: 0, y: 0, zoom: 1 },
    []
  )

  // Drag. If snapToLanes is on and the canvas has lanes, snap the committed
  // x and/or y so the node is centered within its column/row. The node's
  // resolved width/height (from `nodesRef`) is fed to `snapToLane` so the
  // snap accounts for node size — otherwise the node's top-left would
  // align to the lane's start edge, visually jumping to the lane's corner.
  const commitDrag = useCallback(
    (id: string, patch: NodeUpdate) => {
      let final = patch
      if (snapToLanes) {
        const cols = currentCanvas.columns
        const rows = currentCanvas.rows
        const node = nodesRef.current.find((n) => n.id === id)
        const nx = patch.x
        const ny = patch.y
        if (cols && cols.length > 0 && nx != null) {
          const snapped = snapToLane(nx, cols, {
            edge: 'center',
            size: node?.width ?? 0,
          })
          final = { ...final, x: Math.round(snapped) }
        }
        if (rows && rows.length > 0 && ny != null) {
          const snapped = snapToLane(ny, rows, {
            edge: 'center',
            size: node?.height ?? 0,
          })
          final = { ...final, y: Math.round(snapped) }
        }
      }
      onNodeUpdate?.(id, final, currentCanvasRef)
    },
    [onNodeUpdate, currentCanvasRef, snapToLanes, currentCanvas.columns, currentCanvas.rows]
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

  // Selected node with live drag/resize overrides applied — used to position
  // the floating node toolbar so it tracks the node as the user drags it.
  const selectedResolvedNode = useMemo<ResolvedNode | null>(() => {
    if (!selectedId) return null
    const base = nodeMap.get(selectedId)
    if (!base) return null
    const resize = resizeOverrides.get(selectedId)
    if (resize) {
      return { ...base, x: resize.x, y: resize.y, width: resize.width, height: resize.height }
    }
    const drag = dragOverrides.get(selectedId)
    if (drag) {
      return { ...base, x: drag.x, y: drag.y }
    }
    return base
  }, [selectedId, nodeMap, dragOverrides, resizeOverrides])

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

  // Zoom-then-navigate: animate toward the node, then swap canvas.
  // Also stash a parent frame so zoom-exit works on the way back out
  // (even though the entry was a click rather than a zoom).
  //
  // When the zoom animation finishes we capture the final viewport
  // transform and feed it into `pendingHandoff` so that Viewport's
  // canvas-change effect (a) applies the transform instantly on the new
  // canvas instead of auto-fitting, and (b) runs the opacity fade. This
  // makes the sub-canvas fade in on top of the zoomed-in parent node —
  // visually continuous with the zoom motion, like a real zoom into the
  // child document.
  const handleNavigableNodeClick = useCallback(
    (node: ResolvedNode) => {
      const frame: ParentFrame = {
        parentCanvasRef: currentCanvasRef,
        parentNodeRect: {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        },
      }
      setParentFrames((prev) => [...prev, frame])
      const handle = viewportHandleRef.current
      if (handle) {
        handle.zoomToNode(node, () => {
          // Freeze the just-finished transform as the handoff so the
          // sub-canvas renders in-place and then fades in, instead of
          // the default snap-fit.
          const finalVp = viewportStateRef.current
          if (finalVp) setPendingHandoff({ ...finalVp })
          navigateToRef(node)
        })
      } else {
        navigateToRef(node)
      }
    },
    [navigateToRef, currentCanvasRef]
  )

  // --- Zoom-navigation enter/exit handlers ---
  const handleZoomEnter = useCallback(
    (node: ResolvedNode, targetTransform: ViewportState) => {
      const frame: ParentFrame = {
        parentCanvasRef: currentCanvasRef,
        parentNodeRect: {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        },
      }
      setParentFrames((prev) => [...prev, frame])
      setPendingHandoff(targetTransform)
      // Fire the existing navigation flow. Because the data is already
      // resolved synchronously (the hook only fires when data is
      // available), this completes in a single tick.
      navigateToRef(node)
    },
    [currentCanvasRef, navigateToRef]
  )

  const handleZoomExit = useCallback(
    (targetTransform: ViewportState) => {
      setPendingHandoff(targetTransform)
      // Mark the next breadcrumb click as programmatic so its handler
      // doesn't wipe our freshly-set pending handoff.
      suppressNextHandoffClearRef.current = true
      // navigateToBreadcrumb triggers handleBreadcrumbClick which is
      // responsible for truncating parentFrames to match.
      navigateToBreadcrumb(breadcrumbs.length - 2)
    },
    [navigateToBreadcrumb, breadcrumbs.length]
  )

  // Current parent frame (top of the stack) — enables zoom-exit from this
  // canvas only if we entered via zoom-navigation.
  const currentParentFrame = parentFrames[parentFrames.length - 1] ?? null

  const {
    handleViewportChange: handleZoomNavViewportChange,
    clearCommitting: clearZoomNavCommitting,
  } = useZoomNavigation({
    enabled: zoomNavConfig.enabled,
    config: zoomNavConfig,
    nodes,
    currentCanvas,
    parentFrame: currentParentFrame,
    canvases,
    onResolveCanvas,
    onSeedCanvas: seedCanvas,
    theme,
    getViewportSize: () => {
      const svg = viewportHandleRef.current?.getSvgElement()
      if (!svg) return null
      const rect = svg.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    },
    onEnter: handleZoomEnter,
    onExit: handleZoomExit,
  })

  const handleViewportChange = useCallback(
    (vp: ViewportState) => {
      viewportStateRef.current = vp
      handleZoomNavViewportChange(vp)
      onViewportChange?.(vp)
    },
    [handleZoomNavViewportChange, onViewportChange]
  )

  const handleHandoffApplied = useCallback(() => {
    setPendingHandoff(null)
    clearZoomNavCommitting()
  }, [clearZoomNavCommitting])

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
      ref={containerRef}
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
        columns={currentCanvas.columns}
        rows={currentCanvas.rows}
        minZoom={effectiveMinZoom}
        maxZoom={effectiveMaxZoom}
        defaultViewport={defaultViewport}
        autoFit={autoFit}
        canvasRef={currentCanvasRef}
        handoffTransform={pendingHandoff}
        onHandoffApplied={handleHandoffApplied}
        handoffFadeMs={zoomNavConfig.fadeDuration}
        onViewportChange={handleViewportChange}
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

      {/* Sticky lane headers overlay (above the viewport SVG) */}
      {showLaneHeaders && (
        <LaneHeaders
          columns={currentCanvas.columns}
          rows={currentCanvas.rows}
          theme={theme}
          getViewport={getViewportState}
          width={containerSize.width}
          height={containerSize.height}
          pinned={laneHeaders === 'pinned'}
        />
      )}

      {/* Floating node toolbar (above the selected node, editable mode only) */}
      {editable && showNodeToolbar && selectedResolvedNode && !editingId && (
        <NodeToolbar
          node={selectedResolvedNode}
          theme={theme}
          onPatch={(update) => {
            onNodeUpdate?.(selectedResolvedNode.id, update, currentCanvasRef)
          }}
          onDelete={() => {
            onNodeDelete?.(selectedResolvedNode.id, currentCanvasRef)
            setSelectedId(null)
          }}
          getViewport={getViewportState}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          render={renderNodeToolbar}
        />
      )}

      {/* Add-node FAB (editable only) */}
      {editable &&
        (renderAddNodeButton
          ? renderAddNodeButton(renderProps)
          : <AddNodeButton {...renderProps} />)}
    </div>
  )
  }
)
