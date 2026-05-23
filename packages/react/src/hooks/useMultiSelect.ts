import { useState, useRef, useEffect, useCallback } from 'react'
import type { ResolvedNode, ViewportState } from 'system-canvas'
import { screenToCanvas } from 'system-canvas'

export interface MarqueeRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface UseMultiSelectOptions {
  svgRef: React.RefObject<SVGSVGElement | null>
  viewport: React.RefObject<ViewportState>
  nodesRef: React.RefObject<ResolvedNode[]>
  containerRef: React.RefObject<HTMLElement | null>
  enabled: boolean
}

interface UseMultiSelectResult {
  selectedIds: Set<string>
  selectNode: (id: string) => void
  toggleNode: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  selectMultiple: (ids: string[]) => void
  marqueeRect: MarqueeRect | null
  marqueeActiveRef: React.RefObject<boolean>
}

export function useMultiSelect(options: UseMultiSelectOptions): UseMultiSelectResult {
  const { svgRef, viewport, nodesRef, containerRef, enabled } = options

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null)

  const marqueeActiveRef = useRef(false)
  const isDrawingRef = useRef(false)
  const startScreenRef = useRef<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  // Keep a stable ref to the latest selectedIds so callbacks don't stale-close
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  // -------------------------------------------------------------------------
  // Named actions
  // -------------------------------------------------------------------------

  const selectNode = useCallback((id: string) => {
    setSelectedIds(new Set([id]))
  }, [])

  const toggleNode = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    const nodes = nodesRef.current
    if (!nodes) return
    setSelectedIds(new Set(nodes.map(n => n.id)))
  }, [nodesRef])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  // -------------------------------------------------------------------------
  // Space key — toggle marquee mode
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't intercept Space when a text input / editor has focus
        const active = document.activeElement
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        marqueeActiveRef.current = true
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        marqueeActiveRef.current = false
        // Cancel any in-progress marquee draw cleanly
        if (isDrawingRef.current) {
          isDrawingRef.current = false
          startScreenRef.current = null
          pointerIdRef.current = null
          setMarqueeRect(null)
        }
      }
    }

    container.addEventListener('keydown', onKeyDown)
    container.addEventListener('keyup', onKeyUp)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      container.removeEventListener('keyup', onKeyUp)
    }
  }, [enabled, containerRef])

  // -------------------------------------------------------------------------
  // Cmd+A — select all
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        const active = document.activeElement
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        selectAll()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled, containerRef, selectAll])

  // -------------------------------------------------------------------------
  // Pointer events — marquee drawing
  //
  // Listeners are bound to the container div (available synchronously on
  // mount). The SVG element is read lazily inside each handler via
  // `svgRef.current` because it is populated after the Viewport child
  // mounts — binding directly to the SVG in an effect would miss it.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    const onPointerDown = (e: PointerEvent) => {
      if (!marqueeActiveRef.current) return
      if (e.button !== 0) return
      const target = e.target as Element | null
      if (target && typeof target.closest === 'function') {
        if (target.closest('.system-canvas-node')) return
      }

      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      startScreenRef.current = { x, y }
      isDrawingRef.current = true
      pointerIdRef.current = e.pointerId
      setMarqueeRect({ x1: x, y1: y, x2: x, y2: y })

      try {
        container.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }

      e.preventDefault()
      e.stopPropagation()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return
      if (e.pointerId !== pointerIdRef.current) return

      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const start = startScreenRef.current!

      setMarqueeRect({ x1: start.x, y1: start.y, x2: x, y2: y })
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!isDrawingRef.current) return
      if (e.pointerId !== pointerIdRef.current) return

      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const start = startScreenRef.current!

      // Convert marquee corners to canvas-space
      const vp = viewport.current ?? { x: 0, y: 0, zoom: 1 }
      const topLeft = screenToCanvas(
        Math.min(start.x, x),
        Math.min(start.y, y),
        vp
      )
      const bottomRight = screenToCanvas(
        Math.max(start.x, x),
        Math.max(start.y, y),
        vp
      )

      const rectLeft = topLeft.x
      const rectTop = topLeft.y
      const rectRight = bottomRight.x
      const rectBottom = bottomRight.y

      // Hit-test nodes
      const nodes = nodesRef.current ?? []
      const matched = new Set<string>()
      for (const node of nodes) {
        const nRight = node.x + node.width
        const nBottom = node.y + node.height
        if (
          node.x < rectRight &&
          nRight > rectLeft &&
          node.y < rectBottom &&
          nBottom > rectTop
        ) {
          matched.add(node.id)
        }
      }

      setSelectedIds(matched)
      setMarqueeRect(null)
      isDrawingRef.current = false
      startScreenRef.current = null
      pointerIdRef.current = null

      try {
        container.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)

    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
    }
  }, [enabled, containerRef, svgRef, viewport, nodesRef])

  return {
    selectedIds,
    selectNode,
    toggleNode,
    selectAll,
    clearSelection,
    selectMultiple,
    marqueeRect,
    marqueeActiveRef,
  }
}
