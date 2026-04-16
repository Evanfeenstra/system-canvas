import React, { useMemo } from 'react'
import type {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  CanvasTheme,
  EdgeStyle,
  ViewportState,
  ContextMenuEvent,
  BreadcrumbEntry,
} from 'system-canvas'
import {
  resolveTheme,
  resolveCanvas,
  buildNodeMap,
  darkTheme,
} from 'system-canvas'
import { useNavigation } from '../hooks/useNavigation.js'
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js'
import { Viewport } from './Viewport.js'
import { Breadcrumbs } from './Breadcrumbs.js'

export interface SystemCanvasProps {
  /** Canvas data to render */
  canvas: CanvasData

  /** Resolve a ref string to canvas data (for navigation) */
  onResolveCanvas?: (ref: string) => Promise<CanvasData>

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
  onContextMenu?: (event: ContextMenuEvent) => void

  // --- Theming ---
  theme?: CanvasTheme | Partial<CanvasTheme>

  // --- Edge rendering ---
  edgeStyle?: EdgeStyle

  // --- Viewport ---
  defaultViewport?: ViewportState
  minZoom?: number
  maxZoom?: number
  onViewportChange?: (viewport: ViewportState) => void

  // --- Styling ---
  className?: string
  style?: React.CSSProperties
}

export function SystemCanvas({
  canvas,
  onResolveCanvas,
  rootLabel = 'Home',
  onNavigate,
  onBreadcrumbClick,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  onContextMenu,
  theme: themeProp,
  edgeStyle = 'bezier',
  defaultViewport,
  minZoom = 0.1,
  maxZoom = 4,
  onViewportChange,
  className,
  style,
}: SystemCanvasProps) {
  // Resolve theme
  const theme = useMemo(() => {
    if (!themeProp) return darkTheme
    if ('name' in themeProp && 'background' in themeProp && 'grid' in themeProp) {
      return themeProp as CanvasTheme
    }
    return resolveTheme(themeProp as Partial<CanvasTheme>)
  }, [themeProp])

  // Navigation state
  const {
    canvas: currentCanvas,
    breadcrumbs,
    isLoading,
    navigateToRef,
    navigateToBreadcrumb,
  } = useNavigation({
    rootCanvas: canvas,
    rootLabel,
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

  // Viewport ref for coordinate conversion
  const viewportRef = React.useRef<ViewportState>(
    defaultViewport ?? { x: 0, y: 0, zoom: 1 }
  )

  // Interaction handlers
  const {
    handleNodeClick,
    handleNodeDoubleClick,
    handleEdgeClick,
    handleCanvasContextMenu,
    handleNodeContextMenu,
    handleEdgeContextMenu,
  } = useCanvasInteraction({
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onContextMenu,
    onNavigableNodeClick: (node) => navigateToRef(node),
    viewport: viewportRef,
  })

  return (
    <div
      className={`system-canvas ${className ?? ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
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
        nodes={nodes}
        edges={edges}
        nodeMap={nodeMap}
        theme={theme}
        edgeStyle={edgeStyle}
        minZoom={minZoom}
        maxZoom={maxZoom}
        defaultViewport={defaultViewport}
        onViewportChange={(vp) => {
          viewportRef.current = vp
          onViewportChange?.(vp)
        }}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={handleEdgeClick}
        onCanvasContextMenu={handleCanvasContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
      />
    </div>
  )
}
