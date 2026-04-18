import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react'
import type {
  CanvasEdge,
  ResolvedNode,
  CanvasTheme,
  EdgeStyle,
  Side,
  ViewportState,
  NodeUpdate,
  EdgeUpdate,
} from 'system-canvas'
import { computeEdgeMidpoint, screenToCanvas } from 'system-canvas'
import { useViewport } from '../hooks/useViewport.js'
import { NodeRenderer } from './NodeRenderer.js'
import { EdgeRenderer } from './EdgeRenderer.js'
import { NodeEditor } from './NodeEditor.js'
import { EdgeLabelEditor } from './EdgeLabelEditor.js'
import { ConnectionHandles } from './ConnectionHandles.js'
import { PendingEdgeRenderer } from './PendingEdgeRenderer.js'
import type { ResizeCorner, ResizeOverride } from '../hooks/useNodeResize.js'
import type { PendingEdgeState } from '../hooks/useEdgeCreate.js'

/**
 * Extra padding around each node's bounding box when hit-testing for hover.
 * This keeps the node "hovered" while the cursor is on a connection handle,
 * which sits on the node border and extends slightly outside the rect.
 * Matches (or slightly exceeds) the handle's hit radius.
 */
const HOVER_PADDING = 10

/**
 * A connection handle is shown only when the cursor is within this many
 * pixels (canvas-space) of the node's perimeter on the nearest side.
 * Deeper into the node's interior and no handle appears, so the user can
 * freely click/drag the node body without a handle flashing in.
 */
const EDGE_PROXIMITY = 16

interface ViewportProps {
  nodes: ResolvedNode[]
  edges: CanvasEdge[]
  nodeMap: Map<string, ResolvedNode>
  theme: CanvasTheme
  edgeStyle: EdgeStyle
  minZoom: number
  maxZoom: number
  defaultViewport?: ViewportState
  onViewportChange?: (viewport: ViewportState) => void
  onNodeClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onNodeDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onNodeNavigate: (node: ResolvedNode, event: React.MouseEvent) => void
  onEdgeClick: (edge: CanvasEdge, event: React.MouseEvent) => void
  onEdgeDoubleClick?: (edge: CanvasEdge, event: React.MouseEvent) => void
  onCanvasClick?: (event: React.MouseEvent) => void
  onCanvasContextMenu: (event: React.MouseEvent) => void
  onNodeContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  onEdgeContextMenu: (edge: CanvasEdge, event: React.MouseEvent) => void

  // Editable
  onNodePointerDown?: (node: ResolvedNode, event: React.PointerEvent) => void
  selectedId?: string | null
  editingId?: string | null
  selectedEdgeId?: string | null
  editingEdgeId?: string | null
  dragOverrides?: Map<string, { x: number; y: number }>
  resizeOverrides?: Map<string, ResizeOverride>
  onResizeHandlePointerDown?: (
    node: ResolvedNode,
    corner: ResizeCorner,
    event: React.PointerEvent
  ) => void
  onEditorCommit?: (patch: NodeUpdate) => void
  onEditorCancel?: () => void
  onEdgeEditorCommit?: (patch: EdgeUpdate) => void
  onEdgeEditorCancel?: () => void

  // Edge creation (editable mode)
  pendingEdge?: PendingEdgeState | null
  onConnectionHandlePointerDown?: (
    node: ResolvedNode,
    side: Side,
    event: React.PointerEvent
  ) => void
  /** When true, enable handle-on-hover and pending-edge preview layer */
  edgeCreateEnabled?: boolean
}

export interface ViewportHandle {
  zoomToNode: (node: ResolvedNode, onComplete?: () => void) => void
  fitToContent: (nodes: ResolvedNode[], animate?: boolean) => void
  getSvgElement: () => SVGSVGElement | null
  getViewport: () => ViewportState
}

export const Viewport = forwardRef<ViewportHandle, ViewportProps>(
  function Viewport(
    {
      nodes,
      edges,
      nodeMap,
      theme,
      edgeStyle,
      minZoom,
      maxZoom,
      defaultViewport,
      onViewportChange,
      onNodeClick,
      onNodeDoubleClick,
      onNodeNavigate,
      onEdgeClick,
      onEdgeDoubleClick,
      onCanvasClick,
      onCanvasContextMenu,
      onNodeContextMenu,
      onEdgeContextMenu,
      onNodePointerDown,
      selectedId,
      editingId,
      selectedEdgeId,
      editingEdgeId,
      dragOverrides,
      resizeOverrides,
      onResizeHandlePointerDown,
      onEditorCommit,
      onEditorCancel,
      onEdgeEditorCommit,
      onEdgeEditorCancel,
      pendingEdge,
      onConnectionHandlePointerDown,
      edgeCreateEnabled,
    },
    ref
  ) {
    const { svgRef, groupRef, viewport, fitToContent, zoomToNode } =
      useViewport({
        minZoom,
        maxZoom,
        defaultViewport,
        onViewportChange,
      })

    // Track whether a zoom-to-node navigation just happened.
    // When true, the next fitToContent should be instant (no animation).
    const navigatingRef = useRef(false)

    // Hovered node id — used to render connection handles in editable mode.
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
    // Side of the hovered node the cursor is closest to — only that side's
    // handle is shown. Null when no hover is active.
    const [hoveredSide, setHoveredSide] = useState<Side | null>(null)

    useImperativeHandle(ref, () => ({
      zoomToNode: (node, onComplete) => {
        navigatingRef.current = true
        zoomToNode(node, onComplete)
      },
      fitToContent,
      getSvgElement: () => svgRef.current,
      getViewport: () => viewport.current ?? { x: 0, y: 0, zoom: 1 },
    }))

    // Apply drag + resize overrides to nodes before rendering so edges route correctly.
    const renderNodes = useMemo(() => {
      const hasDrag = dragOverrides && dragOverrides.size > 0
      const hasResize = resizeOverrides && resizeOverrides.size > 0
      if (!hasDrag && !hasResize) return nodes
      return nodes.map((n) => {
        const r = resizeOverrides?.get(n.id)
        if (r) return { ...n, x: r.x, y: r.y, width: r.width, height: r.height }
        const d = dragOverrides?.get(n.id)
        return d ? { ...n, x: d.x, y: d.y } : n
      })
    }, [nodes, dragOverrides, resizeOverrides])

    const renderNodeMap = useMemo(() => {
      const hasDrag = dragOverrides && dragOverrides.size > 0
      const hasResize = resizeOverrides && resizeOverrides.size > 0
      if (!hasDrag && !hasResize) return nodeMap
      const m = new Map(nodeMap)
      for (const n of renderNodes) {
        m.set(n.id, n)
      }
      return m
    }, [renderNodes, nodeMap, dragOverrides, resizeOverrides])

    // Fit to content on initial render and when nodes change
    useEffect(() => {
      if (nodes.length > 0 && !defaultViewport) {
        const animate = !navigatingRef.current
        navigatingRef.current = false
        requestAnimationFrame(() => {
          fitToContent(nodes, animate)
        })
      }
    }, [nodes, fitToContent, defaultViewport])

    const editingNode = editingId
      ? renderNodes.find((n) => n.id === editingId) ?? null
      : null

    // Hit-test pointer position against renderNodes to determine the hovered
    // node. Groups are skipped entirely — they never expose connection
    // handles and are never drop targets, so hovering inside a group "sees"
    // the inner node (or nothing).
    //
    // The bounding box is padded by HOVER_PADDING so the cursor can move
    // onto a connection handle (which sits on the node border, extending
    // slightly outside the node rect) without losing hover.
    const handleSvgPointerMove = useCallback(
      (event: React.PointerEvent<SVGSVGElement>) => {
        if (!edgeCreateEnabled) return
        const svg = svgRef.current
        if (!svg) return
        const rect = svg.getBoundingClientRect()
        const vp = viewport.current ?? { x: 0, y: 0, zoom: 1 }
        const { x, y } = screenToCanvas(
          event.clientX - rect.left,
          event.clientY - rect.top,
          vp
        )
        const pad = HOVER_PADDING
        let hit: ResolvedNode | null = null
        for (let i = renderNodes.length - 1; i >= 0; i--) {
          const n = renderNodes[i]
          if (n.type === 'group') continue
          if (x < n.x - pad || x > n.x + n.width + pad) continue
          if (y < n.y - pad || y > n.y + n.height + pad) continue
          hit = n
          break
        }
        const next = hit?.id ?? null
        setHoveredNodeId((prev) => (prev === next ? prev : next))

        // Determine which side of the hovered node the cursor is closest
        // to, and only expose it if the cursor is within EDGE_PROXIMITY of
        // that side's edge. The distance is signed-from-perimeter: inside
        // the rect we use the perpendicular distance to each edge; outside
        // we fall back to the same absolute distance (still works because
        // the hovered node was already expanded by HOVER_PADDING). This
        // means the node's center is a dead zone where no handle shows.
        if (hit) {
          const dTop = Math.abs(y - hit.y)
          const dBottom = Math.abs(y - (hit.y + hit.height))
          const dLeft = Math.abs(x - hit.x)
          const dRight = Math.abs(x - (hit.x + hit.width))
          let side: Side = 'top'
          let min = dTop
          if (dRight < min) {
            side = 'right'
            min = dRight
          }
          if (dBottom < min) {
            side = 'bottom'
            min = dBottom
          }
          if (dLeft < min) {
            side = 'left'
            min = dLeft
          }
          const next = min <= EDGE_PROXIMITY ? side : null
          setHoveredSide((prev) => (prev === next ? prev : next))
        } else {
          setHoveredSide((prev) => (prev === null ? prev : null))
        }
      },
      [edgeCreateEnabled, renderNodes, svgRef, viewport]
    )

    const handleSvgPointerLeave = useCallback(() => {
      setHoveredNodeId(null)
      setHoveredSide(null)
    }, [])

    // Node to show connection handles on: the hovered node, unless a drag
    // is in progress (then show them on the source so the user always sees
    // where the edge is coming from).
    const handlesNodeId = pendingEdge?.sourceId ?? hoveredNodeId
    const handlesNode =
      edgeCreateEnabled && handlesNodeId
        ? renderNodeMap.get(handlesNodeId) ?? null
        : null

    // Pending edge source/target lookup
    const pendingSourceNode =
      pendingEdge ? renderNodeMap.get(pendingEdge.sourceId) ?? null : null
    const pendingTargetNode =
      pendingEdge?.hoveredTargetId &&
      pendingEdge.hoveredTargetId !== pendingEdge.sourceId
        ? renderNodeMap.get(pendingEdge.hoveredTargetId) ?? null
        : null

    // Compute edge editor anchor (midpoint of the edge being edited)
    const editingEdge = editingEdgeId
      ? edges.find((e) => e.id === editingEdgeId) ?? null
      : null
    const editingEdgeMidpoint = (() => {
      if (!editingEdge) return null
      const from = renderNodeMap.get(editingEdge.fromNode)
      const to = renderNodeMap.get(editingEdge.toNode)
      if (!from || !to) return null
      return computeEdgeMidpoint(editingEdge, from, to)
    })()

    return (
      <svg
        ref={svgRef}
        className="system-canvas-viewport"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: theme.background,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
        onClick={onCanvasClick}
        onContextMenu={onCanvasContextMenu}
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handleSvgPointerLeave}
      >
        {/* Grid pattern */}
        <defs>
          <pattern
            id="system-canvas-grid"
            width={theme.grid.size}
            height={theme.grid.size}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${theme.grid.size} 0 L 0 0 0 ${theme.grid.size}`}
              fill="none"
              stroke={theme.grid.color}
              strokeWidth={theme.grid.strokeWidth}
            />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect
          x="-50000"
          y="-50000"
          width="100000"
          height="100000"
          fill="url(#system-canvas-grid)"
        />

        {/* Transformable group -- d3-zoom applies transforms here */}
        <g ref={groupRef}>
          {/* Groups first (behind everything) */}
          <NodeRenderer
            nodes={renderNodes}
            theme={theme}
            onClick={onNodeClick}
            onDoubleClick={onNodeDoubleClick}
            onContextMenu={onNodeContextMenu}
            onNavigate={onNodeNavigate}
            onPointerDown={onNodePointerDown}
            selectedId={selectedId}
            editingId={editingId}
            only="groups"
          />

          {/* Edges above groups but below regular nodes — so edges appear
              over translucent group fills (and are clickable there), while
              still tucking under opaque nodes at their endpoints. */}
          <EdgeRenderer
            edges={edges}
            nodeMap={renderNodeMap}
            theme={theme}
            defaultEdgeStyle={edgeStyle}
            onClick={onEdgeClick}
            onDoubleClick={onEdgeDoubleClick}
            onContextMenu={onEdgeContextMenu}
            selectedId={selectedEdgeId}
            editingId={editingEdgeId}
          />

          {/* Non-group nodes on top (+ resize handles) */}
          <NodeRenderer
            nodes={renderNodes}
            theme={theme}
            onClick={onNodeClick}
            onDoubleClick={onNodeDoubleClick}
            onContextMenu={onNodeContextMenu}
            onNavigate={onNodeNavigate}
            onPointerDown={onNodePointerDown}
            selectedId={selectedId}
            editingId={editingId}
            onResizeHandlePointerDown={onResizeHandlePointerDown}
            only="non-groups"
          />

          {/* Target highlight (halo) for the currently-hovered drop target
              during an edge-creation drag. */}
          {pendingTargetNode && (
            <rect
              className="system-canvas-drop-target"
              x={pendingTargetNode.x - 4}
              y={pendingTargetNode.y - 4}
              width={pendingTargetNode.width + 8}
              height={pendingTargetNode.height + 8}
              rx={pendingTargetNode.resolvedCornerRadius + 4}
              fill="none"
              stroke={theme.node.labelColor}
              strokeWidth={2}
              opacity={0.85}
              pointerEvents="none"
            />
          )}

          {/* Ghost edge preview during edge-creation drag */}
          {pendingEdge && pendingSourceNode && (
            <PendingEdgeRenderer
              sourceNode={pendingSourceNode}
              sourceSide={pendingEdge.sourceSide}
              cursor={pendingEdge.cursor}
              targetNode={pendingTargetNode}
              theme={theme}
              defaultEdgeStyle={edgeStyle}
            />
          )}

          {/* Connection handles on the hovered (or source-during-drag) node */}
          {handlesNode && onConnectionHandlePointerDown && (
            <ConnectionHandles
              node={handlesNode}
              theme={theme}
              onHandlePointerDown={onConnectionHandlePointerDown}
              immediate={!!pendingEdge}
              activeSide={hoveredSide}
            />
          )}

          {/* Inline editor on top of the edited node */}
          {editingNode && onEditorCommit && onEditorCancel && (
            <NodeEditor
              node={editingNode}
              theme={theme}
              onCommit={onEditorCommit}
              onCancel={onEditorCancel}
            />
          )}

          {/* Inline edge label editor at the edge midpoint */}
          {editingEdge &&
            editingEdgeMidpoint &&
            onEdgeEditorCommit &&
            onEdgeEditorCancel && (
              <EdgeLabelEditor
                initialLabel={editingEdge.label ?? ''}
                midpoint={editingEdgeMidpoint}
                theme={theme}
                onCommit={onEdgeEditorCommit}
                onCancel={onEdgeEditorCancel}
              />
            )}
        </g>
      </svg>
    )
  }
)
