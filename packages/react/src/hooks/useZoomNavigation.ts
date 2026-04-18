import { useCallback, useEffect, useRef } from 'react'
import type {
  CanvasData,
  CanvasTheme,
  Rect,
  ResolvedNode,
  ViewportState,
} from 'system-canvas'
import {
  computeBoundingBox,
  fitBoundsIntoRect,
  canvasRectToScreenRect,
  resolveCanvas,
} from 'system-canvas'

/**
 * Controls how zoom-to-navigate behaves.
 */
export interface ZoomNavigationConfig {
  /**
   * When a ref-bearing node's on-screen size reaches this fraction of the
   * viewport in the dominant dimension, the library commits navigation
   * into the sub-canvas. Default 0.7.
   */
  enterThreshold?: number
  /**
   * When the current sub-canvas's on-screen bounding box shrinks to this
   * fraction of the viewport in the dominant dimension, the library pops
   * back to the parent. Should be well below `enterThreshold` to avoid
   * oscillation. Default 0.35.
   */
  exitThreshold?: number
  /**
   * When a ref-bearing node reaches this fraction of the viewport (a
   * lower bar than `enterThreshold`), the library pre-fetches its
   * sub-canvas via `onResolveCanvas` so the handoff is synchronous when
   * `enterThreshold` is crossed. Default 0.4.
   */
  prefetchThreshold?: number
  /**
   * Post-handoff, the child canvas is fit into the parent node's old
   * on-screen rect expanded by this factor around its center. A value of
   * 1.0 means "exactly where the parent node was"; 1.2 means the child
   * lands 20% larger than the parent node, centered on the same point.
   * The transform is then clamped so no child content falls outside the
   * viewport. Default 1.2.
   */
  landingScale?: number
  /**
   * Fraction of the target rect's smaller dimension reserved as padding
   * around the child content on landing. Gives the landed content visual
   * breathing room so it doesn't hug the edges of the parent node's old
   * rect. Default 0.08 (8%).
   */
  landingPadding?: number
}

interface UseZoomNavigationOptions {
  enabled: boolean
  config: Required<ZoomNavigationConfig>
  /**
   * The nodes of the *current* canvas, with resolved dimensions. Used to
   * hit-test against the viewport.
   */
  nodes: ResolvedNode[]
  /** The current canvas (used to compute its bbox for exit detection). */
  currentCanvas: CanvasData
  /**
   * The ref of the canvas we just entered via zoom-enter, along with the
   * resolved rect of the parent node at the moment of entry. Null when at
   * a canvas not reached via zoom-enter.
   */
  parentFrame: ParentFrame | null
  /** Sync canvases map — used for pre-resolution check and pre-fetch. */
  canvases?: Record<string, CanvasData>
  /** Async resolver — used for pre-fetch. */
  onResolveCanvas?: (ref: string) => Promise<CanvasData>
  /**
   * Called to seed pre-fetched canvas data into whatever cache
   * `navigateToRef` consults, so the subsequent navigation is synchronous.
   */
  onSeedCanvas?: (ref: string, data: CanvasData) => void
  /**
   * The active theme, needed so we can resolve the pre-fetched sub-canvas
   * to compute its bounding box for the handoff math.
   */
  theme: CanvasTheme
  /** Getter for the current viewport screen size. */
  getViewportSize: () => { width: number; height: number } | null
  /**
   * Called to commit a zoom-enter navigation. Receives the (resolved)
   * node being entered and the target viewport transform that must be
   * applied on the newly-loaded canvas to make the handoff seamless.
   */
  onEnter: (node: ResolvedNode, targetTransform: ViewportState) => void
  /**
   * Called to commit a zoom-exit navigation. Receives the target viewport
   * transform that must be applied on the parent canvas to make the
   * handoff seamless.
   */
  onExit: (targetTransform: ViewportState) => void
}

/**
 * Remembers the parent node rect (in parent-canvas coordinates) and the
 * parent canvas ref for the canvas we most recently entered via
 * zoom-navigation. Used to compute the reverse handoff on zoom-exit.
 */
export interface ParentFrame {
  parentCanvasRef: string | undefined
  parentNodeRect: Rect
}

/**
 * Return a new rect expanded by `factor` around its center.
 * factor=1.0 is a no-op; factor=1.4 grows the rect by 40%.
 */
function expandRect(rect: Rect, factor: number): Rect {
  if (factor === 1) return rect
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const w = rect.width * factor
  const h = rect.height * factor
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h }
}

/**
 * Shift `transform` so that `bounds` rendered at that transform stays
 * fully inside the viewport (with a `margin` on each side). Zoom is not
 * changed. If the bounds at the given zoom are too large to fit in the
 * viewport, the content is centered instead.
 */
function clampTransformToViewport(
  transform: ViewportState,
  bounds: { minX: number; minY: number; width: number; height: number },
  viewport: { width: number; height: number },
  margin: number
): ViewportState {
  const { zoom } = transform
  let { x, y } = transform
  const scaledW = bounds.width * zoom
  const scaledH = bounds.height * zoom

  // Where the bounds currently land on screen.
  const screenLeft = bounds.minX * zoom + x
  const screenTop = bounds.minY * zoom + y

  // Horizontal
  if (scaledW + 2 * margin >= viewport.width) {
    // Too wide to respect margins — center horizontally.
    x = (viewport.width - scaledW) / 2 - bounds.minX * zoom
  } else {
    if (screenLeft < margin) x += margin - screenLeft
    else if (screenLeft + scaledW > viewport.width - margin)
      x -= screenLeft + scaledW - (viewport.width - margin)
  }

  // Vertical
  const newScreenTop = bounds.minY * zoom + y
  if (scaledH + 2 * margin >= viewport.height) {
    y = (viewport.height - scaledH) / 2 - bounds.minY * zoom
  } else {
    if (newScreenTop < margin) y += margin - newScreenTop
    else if (newScreenTop + scaledH > viewport.height - margin)
      y -= newScreenTop + scaledH - (viewport.height - margin)
  }

  return { x, y, zoom }
}

interface PrefetchState {
  ref: string
  data?: CanvasData
  loading: boolean
}

export function useZoomNavigation(options: UseZoomNavigationOptions) {
  const {
    enabled,
    config,
    nodes,
    currentCanvas,
    parentFrame,
    canvases,
    onResolveCanvas,
    onSeedCanvas,
    theme,
    getViewportSize,
    onEnter,
    onExit,
  } = options

  // Guard against firing the commit repeatedly when the viewport is
  // continuously changing past threshold. Cleared explicitly by the
  // consumer via clearCommitting() once the handoff has been applied.
  const committingRef = useRef(false)
  // Also reset on canvas change as a belt-and-braces fallback.
  useEffect(() => {
    committingRef.current = false
  }, [currentCanvas])

  // Most-recent pre-fetch in flight, keyed by ref to avoid duplicates.
  const prefetchRef = useRef<Map<string, PrefetchState>>(new Map())

  const prefetch = useCallback(
    (ref: string) => {
      if (!onResolveCanvas) return
      if (canvases?.[ref]) return // already synchronously available
      const existing = prefetchRef.current.get(ref)
      if (existing) return // already fetched or in flight
      const state: PrefetchState = { ref, loading: true }
      prefetchRef.current.set(ref, state)
      onResolveCanvas(ref)
        .then((data) => {
          state.data = data
          state.loading = false
          onSeedCanvas?.(ref, data)
        })
        .catch(() => {
          state.loading = false
        })
    },
    [canvases, onResolveCanvas, onSeedCanvas]
  )

  /**
   * Called on every viewport change. Detects enter/exit thresholds and
   * dispatches the appropriate handoff.
   */
  const handleViewportChange = useCallback(
    (vp: ViewportState) => {
      if (!enabled) return
      if (committingRef.current) return
      const size = getViewportSize()
      if (!size) return

      // --- Enter detection: any ref-bearing node filling the viewport ---
      for (const n of nodes) {
        if (!n.ref) continue
        const screen = canvasRectToScreenRect(
          { x: n.x, y: n.y, width: n.width, height: n.height },
          vp
        )

        // The node must actually be on-screen — its center must lie
        // inside the viewport. Without this check, any ref-bearing node
        // grows with zoom and may pass the fill-fraction threshold even
        // when it's entirely off to the side; the loop would then enter
        // that node instead of the one the user is actually zooming on.
        const centerX = screen.x + screen.width / 2
        const centerY = screen.y + screen.height / 2
        const centerOnScreen =
          centerX >= 0 &&
          centerX <= size.width &&
          centerY >= 0 &&
          centerY <= size.height
        if (!centerOnScreen) continue

        const fillFraction = Math.max(
          screen.width / size.width,
          screen.height / size.height
        )

        if (
          fillFraction >= config.prefetchThreshold &&
          fillFraction < config.enterThreshold
        ) {
          prefetch(n.ref)
        }

        if (fillFraction >= config.enterThreshold) {
          // Resolve the sub-canvas synchronously from canvases map or
          // pre-fetch cache. If not available, skip (discrete nav will
          // take over via normal maxZoom pinning).
          const childData =
            canvases?.[n.ref] ?? prefetchRef.current.get(n.ref)?.data
          if (!childData) {
            prefetch(n.ref)
            continue
          }

          // Resolve child canvas so we can compute its bounding box.
          const resolved = resolveCanvas(childData, theme)
          if (resolved.nodes.length === 0) continue

          const bounds = computeBoundingBox(resolved.nodes)
          // Target: fit child bbox into the parent node's on-screen rect,
          // expanded by `landingScale` around its center. Expanding makes
          // the child content land larger than the parent node itself,
          // while still anchored to where the parent node was.
          const targetRect = expandRect(screen, config.landingScale)
          // Inset padding (proportional to the smaller dimension) so the
          // child content has breathing room inside the target rect
          // instead of hugging its edges.
          const landingPad =
            Math.min(targetRect.width, targetRect.height) *
            config.landingPadding
          let targetTransform = fitBoundsIntoRect(
            bounds,
            targetRect,
            landingPad
          )
          // Nudge the transform so the child bbox stays fully on screen
          // (with a small margin). This preserves the size and only shifts
          // the translation when the anchored position would put content
          // off the edge of the viewport.
          targetTransform = clampTransformToViewport(
            targetTransform,
            bounds,
            size,
            16
          )

          committingRef.current = true
          // Convert the ResolvedNode back to a plain CanvasNode-ish object
          // with just id + ref (navigation only needs these + label for the
          // breadcrumb). The caller treats n as a CanvasNode-compatible
          // object.
          onEnter(n, targetTransform)
          return
        }
      }

      // --- Exit detection: the current canvas shrunk below threshold ---
      if (parentFrame && nodes.length > 0) {
        const bounds = computeBoundingBox(nodes)
        if (bounds.width === 0 || bounds.height === 0) return
        const screen = canvasRectToScreenRect(
          {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.width,
            height: bounds.height,
          },
          vp
        )
        const fillFraction = Math.max(
          screen.width / size.width,
          screen.height / size.height
        )
        if (fillFraction <= config.exitThreshold) {
          // Target on the parent canvas: the parent node rect should
          // appear at the current on-screen rect of the child canvas bbox.
          const targetTransform = fitBoundsIntoRect(
            {
              minX: parentFrame.parentNodeRect.x,
              minY: parentFrame.parentNodeRect.y,
              maxX:
                parentFrame.parentNodeRect.x + parentFrame.parentNodeRect.width,
              maxY:
                parentFrame.parentNodeRect.y +
                parentFrame.parentNodeRect.height,
              width: parentFrame.parentNodeRect.width,
              height: parentFrame.parentNodeRect.height,
            },
            {
              x: screen.x,
              y: screen.y,
              width: screen.width,
              height: screen.height,
            }
          )
          committingRef.current = true
          onExit(targetTransform)
        }
      }
    },
    [
      enabled,
      nodes,
      parentFrame,
      canvases,
      theme,
      config,
      getViewportSize,
      prefetch,
      onEnter,
      onExit,
    ]
  )

  const clearCommitting = useCallback(() => {
    committingRef.current = false
  }, [])

  return { handleViewportChange, clearCommitting }
}
