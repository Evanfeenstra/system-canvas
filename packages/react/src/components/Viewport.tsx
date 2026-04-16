import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import type {
  CanvasEdge,
  ResolvedNode,
  CanvasTheme,
  EdgeStyle,
  ViewportState,
} from 'system-canvas'
import { useViewport } from '../hooks/useViewport.js'
import { NodeRenderer } from './NodeRenderer.js'
import { EdgeRenderer } from './EdgeRenderer.js'

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
  onEdgeClick: (edge: CanvasEdge, event: React.MouseEvent) => void
  onCanvasContextMenu: (event: React.MouseEvent) => void
  onNodeContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  onEdgeContextMenu: (edge: CanvasEdge, event: React.MouseEvent) => void
}

export interface ViewportHandle {
  zoomToNode: (node: ResolvedNode, onComplete?: () => void) => void
  fitToContent: (nodes: ResolvedNode[], animate?: boolean) => void
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
      onEdgeClick,
      onCanvasContextMenu,
      onNodeContextMenu,
      onEdgeContextMenu,
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
    }))

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
            nodeMap={nodeMap}
            theme={theme}
            defaultEdgeStyle={edgeStyle}
            onClick={onEdgeClick}
            onContextMenu={onEdgeContextMenu}
          />

          {/* Nodes on top */}
          <NodeRenderer
            nodes={nodes}
            theme={theme}
            onClick={onNodeClick}
            onDoubleClick={onNodeDoubleClick}
            onContextMenu={onNodeContextMenu}
          />
        </g>
      </svg>
    )
  }
)
