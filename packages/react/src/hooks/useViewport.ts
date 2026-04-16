import { useEffect, useRef, useCallback } from 'react'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { select } from 'd3-selection'
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
  fitToContent: (nodes: ResolvedNode[]) => void
  resetZoom: () => void
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

  useEffect(() => {
    const svg = svgRef.current
    const group = groupRef.current
    if (!svg || !group) return

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', (event) => {
        const { x, y, k } = event.transform
        group.setAttribute('transform', `translate(${x},${y}) scale(${k})`)
        viewport.current = { x, y, zoom: k }
        onViewportChange?.({ x, y, zoom: k })
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

  const fitToContent = useCallback((nodes: ResolvedNode[]) => {
    const svg = svgRef.current
    if (!svg || !zoomBehaviorRef.current || nodes.length === 0) return

    const rect = svg.getBoundingClientRect()
    const target = fitToBounds(nodes, rect.width, rect.height)

    const t = zoomIdentity
      .translate(target.x, target.y)
      .scale(target.zoom)

    // Apply transform directly (no d3-transition dependency)
    select(svg).call(zoomBehaviorRef.current.transform, t)
  }, [])

  const resetZoom = useCallback(() => {
    const svg = svgRef.current
    if (!svg || !zoomBehaviorRef.current) return

    select(svg).call(zoomBehaviorRef.current.transform, zoomIdentity)
  }, [])

  return { svgRef, groupRef, viewport, fitToContent, resetZoom }
}
