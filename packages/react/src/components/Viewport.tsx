import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
} from 'react'
import type {
  CanvasEdge,
  ResolvedNode,
  CanvasTheme,
  EdgeStyle,
  ViewportState,
  NodeUpdate,
} from 'system-canvas'
import { useViewport } from '../hooks/useViewport.js'
import { NodeRenderer } from './NodeRenderer.js'
import { EdgeRenderer } from './EdgeRenderer.js'
import { NodeEditor } from './NodeEditor.js'

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
  onCanvasClick?: (event: React.MouseEvent) => void
  onCanvasContextMenu: (event: React.MouseEvent) => void
  onNodeContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  onEdgeContextMenu: (edge: CanvasEdge, event: React.MouseEvent) => void

  // Editable
  onNodePointerDown?: (node: ResolvedNode, event: React.PointerEvent) => void
  selectedId?: string | null
  editingId?: string | null
  dragOverrides?: Map<string, { x: number; y: number }>
  onEditorCommit?: (patch: NodeUpdate) => void
  onEditorCancel?: () => void
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
      onCanvasClick,
      onCanvasContextMenu,
      onNodeContextMenu,
      onEdgeContextMenu,
      onNodePointerDown,
      selectedId,
      editingId,
      dragOverrides,
      onEditorCommit,
      onEditorCancel,
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

    useImperativeHandle(ref, () => ({
      zoomToNode: (node, onComplete) => {
        navigatingRef.current = true
        zoomToNode(node, onComplete)
      },
      fitToContent,
      getSvgElement: () => svgRef.current,
      getViewport: () => viewport.current ?? { x: 0, y: 0, zoom: 1 },
    }))

    // Apply drag overrides to nodes before rendering so edges route correctly.
    const renderNodes = useMemo(() => {
      if (!dragOverrides || dragOverrides.size === 0) return nodes
      return nodes.map((n) => {
        const o = dragOverrides.get(n.id)
        return o ? { ...n, x: o.x, y: o.y } : n
      })
    }, [nodes, dragOverrides])

    const renderNodeMap = useMemo(() => {
      if (!dragOverrides || dragOverrides.size === 0) return nodeMap
      const m = new Map(nodeMap)
      for (const n of renderNodes) {
        m.set(n.id, n)
      }
      return m
    }, [renderNodes, nodeMap, dragOverrides])

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

    return (
      <svg
        ref={svgRef}
        className="system-canvas-viewport"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: theme.background,
        }}
        onClick={onCanvasClick}
        onContextMenu={onCanvasContextMenu}
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
          {/* Edges first (behind nodes in painter's model) */}
          <EdgeRenderer
            edges={edges}
            nodeMap={renderNodeMap}
            theme={theme}
            defaultEdgeStyle={edgeStyle}
            onClick={onEdgeClick}
            onContextMenu={onEdgeContextMenu}
          />

          {/* Nodes on top */}
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
          />

          {/* Inline editor on top of the edited node */}
          {editingNode && onEditorCommit && onEditorCancel && (
            <NodeEditor
              node={editingNode}
              theme={theme}
              onCommit={onEditorCommit}
              onCancel={onEditorCancel}
            />
          )}
        </g>
      </svg>
    )
  }
)
