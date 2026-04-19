import { useEffect, useRef, useCallback } from 'react'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { select } from 'd3-selection'
import 'd3-transition' // Extends d3-selection with .transition()
import type { ViewportState, ResolvedNode } from 'system-canvas'
import { fitToBounds } from 'system-canvas'

interface UseViewportOptions {
  minZoom: number
  maxZoom: number
  defaultViewport?: ViewportState
  onViewportChange?: (viewport: ViewportState) => void
}

interface UseViewportResult {
  svgRef: React.RefObject<SVGSVGElement | null>
  groupRef: React.RefObject<SVGGElement | null>
  viewport: React.RefObject<ViewportState>
  fitToContent: (nodes: ResolvedNode[], animate?: boolean) => void
  resetZoom: () => void
  /** Animate zoom to center on a node, then call onComplete */
  zoomToNode: (
    node: ResolvedNode,
    onComplete?: () => void,
    options?: { durationMs?: number; targetZoom?: number }
  ) => void
  /**
   * Imperatively set the viewport transform. When `animate` is false the
   * transform is applied instantly (used for the seamless zoom-navigation
   * handoff); the change still fires the onViewportChange callback.
   */
  setTransform: (
    transform: ViewportState,
    options?: { animate?: boolean; durationMs?: number }
  ) => void
}

export function useViewport(options: UseViewportOptions): UseViewportResult {
  const { minZoom, maxZoom, defaultViewport, onViewportChange } = options

  const svgRef = useRef<SVGSVGElement | null>(null)
  const groupRef = useRef<SVGGElement | null>(null)
  const viewport = useRef<ViewportState>(
    defaultViewport ?? { x: 0, y: 0, zoom: 1 }
  )
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
    null
  )
  // Keep the latest onViewportChange in a ref so the d3-zoom handler
  // (which is installed once) always calls the current callback rather
  // than the one captured on mount.
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange

  useEffect(() => {
    const svg = svgRef.current
    const group = groupRef.current
    if (!svg || !group) return

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      // Don't start pan/zoom when the gesture begins on a node — that's a
      // node drag. d3-zoom's default filter lets through most events; we
      // extend it to also reject drag-starting events originating inside
      // a node. Wheel events are always allowed so scroll-to-zoom works
      // anywhere over the canvas, even when the cursor is over a node.
      .filter((event) => {
        // Mirror d3-zoom's default rules for the things we still want to
        // honor (ignore secondary buttons etc.). Note: we intentionally
        // don't block ctrl+wheel — letting it through matches d3-zoom's
        // default (native pinch gestures come through as ctrl+wheel).
        if (event.button) return false
        // Wheel events always pass through — zooming should work regardless
        // of what's under the cursor.
        if (event.type === 'wheel') return true
        const target = event.target as Element | null
        if (target && typeof target.closest === 'function') {
          if (target.closest('.system-canvas-node')) return false
          if (target.closest('.system-canvas-resize-handles')) return false
          if (target.closest('.system-canvas-connection-handles')) return false
        }
        return true
      })
      .on('zoom', (event) => {
        const { x, y, k } = event.transform
        group.setAttribute('transform', `translate(${x},${y}) scale(${k})`)
        viewport.current = { x, y, zoom: k }
        onViewportChangeRef.current?.({ x, y, zoom: k })
      })

    zoomBehaviorRef.current = zoomBehavior

    const selection = select(svg)
    selection.call(zoomBehavior)

    // Disable double-click zoom (we use double-click for navigation)
    selection.on('dblclick.zoom', null)

    // Apply default viewport
    if (defaultViewport) {
      const t = zoomIdentity
        .translate(defaultViewport.x, defaultViewport.y)
        .scale(defaultViewport.zoom)
      selection.call(zoomBehavior.transform, t)
    }

    return () => {
      selection.on('.zoom', null)
    }
  }, [minZoom, maxZoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const fitToContent = useCallback((nodes: ResolvedNode[], animate = true) => {
    const svg = svgRef.current
    if (!svg || !zoomBehaviorRef.current || nodes.length === 0) return

    const rect = svg.getBoundingClientRect()
    const target = fitToBounds(nodes, rect.width, rect.height)

    const t = zoomIdentity
      .translate(target.x, target.y)
      .scale(target.zoom)

    if (animate) {
      select(svg)
        .transition()
        .duration(400)
        .call(zoomBehaviorRef.current.transform as any, t)
    } else {
      select(svg).call(zoomBehaviorRef.current.transform, t)
    }
  }, [])

  const resetZoom = useCallback(() => {
    const svg = svgRef.current
    if (!svg || !zoomBehaviorRef.current) return

    select(svg)
      .transition()
      .duration(400)
      .call(zoomBehaviorRef.current.transform as any, zoomIdentity)
  }, [])

  const setTransform = useCallback(
    (
      transform: ViewportState,
      options?: { animate?: boolean; durationMs?: number }
    ) => {
      const svg = svgRef.current
      if (!svg || !zoomBehaviorRef.current) return

      const t = zoomIdentity
        .translate(transform.x, transform.y)
        .scale(transform.zoom)

      const sel = select(svg)
      if (options?.animate) {
        sel
          .transition()
          .duration(options.durationMs ?? 300)
          .call(zoomBehaviorRef.current.transform as any, t)
      } else {
        sel.call(zoomBehaviorRef.current.transform, t)
      }
    },
    []
  )

  const zoomToNode = useCallback(
    (
      node: ResolvedNode,
      onComplete?: () => void,
      options?: { durationMs?: number; targetZoom?: number }
    ) => {
      const svg = svgRef.current
      if (!svg || !zoomBehaviorRef.current) {
        onComplete?.()
        return
      }

      const rect = svg.getBoundingClientRect()

      // Compute a transform that centers the node and zooms in
      const nodeCx = node.x + node.width / 2
      const nodeCy = node.y + node.height / 2

      // Zoom level: either caller-supplied, or fit-with-padding capped at 3x.
      let targetZoom: number
      if (options?.targetZoom != null) {
        targetZoom = options.targetZoom
      } else {
        const padding = 40
        const scaleX = rect.width / (node.width + padding * 2)
        const scaleY = rect.height / (node.height + padding * 2)
        targetZoom = Math.min(scaleX, scaleY, 3)
      }

      const t = zoomIdentity
        .translate(rect.width / 2 - nodeCx * targetZoom, rect.height / 2 - nodeCy * targetZoom)
        .scale(targetZoom)

      select(svg)
        .transition()
        .duration(options?.durationMs ?? 500)
        .call(zoomBehaviorRef.current.transform as any, t)
        .on('end', () => {
          onComplete?.()
        })
    },
    []
  )

  return {
    svgRef,
    groupRef,
    viewport,
    fitToContent,
    resetZoom,
    zoomToNode,
    setTransform,
  }
}
