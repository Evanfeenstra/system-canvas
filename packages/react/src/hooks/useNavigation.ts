import { useState, useCallback, useRef, useMemo } from 'react'
import type { CanvasData, CanvasNode, BreadcrumbEntry } from 'system-canvas'
import { getNodeLabel } from 'system-canvas'

interface UseNavigationOptions {
  /** Root canvas data */
  rootCanvas: CanvasData
  /** Root label for breadcrumbs */
  rootLabel?: string
  /**
   * Synchronous map from ref to CanvasData. When present, the hook prefers
   * this over cached async results, so consumer-side edits to sub-canvases
   * are reflected immediately.
   */
  canvases?: Record<string, CanvasData>
  /** Resolve a ref string to canvas data (async fallback) */
  onResolveCanvas?: (ref: string) => Promise<CanvasData>
  /** Called when navigation occurs */
  onNavigate?: (ref: string) => void
  /** Called when breadcrumb is clicked */
  onBreadcrumbClick?: (index: number) => void
}

interface UseNavigationResult {
  /** Current canvas to render */
  canvas: CanvasData
  /** Ref of the current canvas (undefined at root) */
  currentCanvasRef: string | undefined
  /** Current breadcrumb trail */
  breadcrumbs: BreadcrumbEntry[]
  /** Whether a canvas is currently being loaded */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** Navigate into a node's sub-canvas */
  navigateToRef: (node: CanvasNode) => Promise<void>
  /** Navigate back to a breadcrumb */
  navigateToBreadcrumb: (index: number) => void
}

export function useNavigation(options: UseNavigationOptions): UseNavigationResult {
  const {
    rootCanvas,
    rootLabel = 'Home',
    canvases,
    onResolveCanvas,
    onNavigate,
    onBreadcrumbClick,
  } = options

  // Breadcrumb stack — we only track labels and refs; canvas data is looked
  // up each render from `canvases` or the async cache.
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { label: rootLabel },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Async cache: ref -> last-fetched CanvasData. Used only when `canvases`
  // doesn't contain the ref.
  const asyncCacheRef = useRef<Map<string, CanvasData>>(new Map())
  // Bump to force recompute when async cache updates.
  const [, setCacheVersion] = useState(0)

  const currentRef = breadcrumbs.length > 1
    ? breadcrumbs[breadcrumbs.length - 1].ref
    : undefined

  const canvas = useMemo<CanvasData>(() => {
    if (!currentRef) return rootCanvas
    const fromProp = canvases?.[currentRef]
    if (fromProp) return fromProp
    const fromCache = asyncCacheRef.current.get(currentRef)
    if (fromCache) return fromCache
    // No data yet (still loading) — fall back to an empty canvas so the
    // renderer has something valid to work with.
    return { nodes: [], edges: [] }
  }, [rootCanvas, canvases, currentRef])

  const navigateToRef = useCallback(
    async (node: CanvasNode) => {
      if (!node.ref) return

      const ref = node.ref
      onNavigate?.(ref)
      const label = getNodeLabel(node)

      // Synchronous path: data already available.
      if (canvases?.[ref] || asyncCacheRef.current.has(ref)) {
        setBreadcrumbs((prev) => [...prev, { label, ref }])
        setError(null)
        return
      }

      if (!onResolveCanvas) {
        setError(`No data for ref "${ref}" and no resolver configured`)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const childCanvas = await onResolveCanvas(ref)
        asyncCacheRef.current.set(ref, childCanvas)
        setCacheVersion((v) => v + 1)
        setBreadcrumbs((prev) => [...prev, { label, ref }])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load canvas')
      } finally {
        setIsLoading(false)
      }
    },
    [canvases, onResolveCanvas, onNavigate]
  )

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      onBreadcrumbClick?.(index)
      setBreadcrumbs((prev) => prev.slice(0, index + 1))
      setError(null)
    },
    [onBreadcrumbClick]
  )

  return {
    canvas,
    currentCanvasRef: currentRef,
    breadcrumbs,
    isLoading,
    error,
    navigateToRef,
    navigateToBreadcrumb,
  }
}
