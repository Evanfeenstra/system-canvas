import { useState, useCallback } from 'react'
import type { CanvasData, CanvasNode, BreadcrumbEntry } from 'system-canvas'
import { getNodeLabel } from 'system-canvas'

interface UseNavigationOptions {
  /** Root canvas data */
  rootCanvas: CanvasData
  /** Root label for breadcrumbs */
  rootLabel?: string
  /** Resolve a ref string to canvas data */
  onResolveCanvas?: (ref: string) => Promise<CanvasData>
  /** Called when navigation occurs */
  onNavigate?: (ref: string) => void
  /** Called when breadcrumb is clicked */
  onBreadcrumbClick?: (index: number) => void
}

interface NavigationState {
  canvas: CanvasData
  breadcrumbs: BreadcrumbEntry[]
  isLoading: boolean
  error: string | null
}

interface UseNavigationResult {
  /** Current canvas to render */
  canvas: CanvasData
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
  /** Replace the current canvas (for external state management) */
  setCanvas: (canvas: CanvasData) => void
}

export function useNavigation(options: UseNavigationOptions): UseNavigationResult {
  const {
    rootCanvas,
    rootLabel = 'Home',
    onResolveCanvas,
    onNavigate,
    onBreadcrumbClick,
  } = options

  const [state, setState] = useState<NavigationState>({
    canvas: rootCanvas,
    breadcrumbs: [{ label: rootLabel }],
    isLoading: false,
    error: null,
  })

  // Keep a stack of canvases so we can navigate back without re-fetching
  const [canvasStack, setCanvasStack] = useState<CanvasData[]>([rootCanvas])

  const navigateToRef = useCallback(
    async (node: CanvasNode) => {
      if (!node.ref || !onResolveCanvas) return

      onNavigate?.(node.ref)

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const childCanvas = await onResolveCanvas(node.ref)
        const label = getNodeLabel(node)

        setCanvasStack((prev) => [...prev, childCanvas])
        setState((prev) => ({
          canvas: childCanvas,
          breadcrumbs: [...prev.breadcrumbs, { label, ref: node.ref }],
          isLoading: false,
          error: null,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load canvas',
        }))
      }
    },
    [onResolveCanvas, onNavigate]
  )

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      onBreadcrumbClick?.(index)

      setCanvasStack((prev) => prev.slice(0, index + 1))
      setState((prev) => ({
        canvas: canvasStack[index],
        breadcrumbs: prev.breadcrumbs.slice(0, index + 1),
        isLoading: false,
        error: null,
      }))
    },
    [canvasStack, onBreadcrumbClick]
  )

  const setCanvas = useCallback((canvas: CanvasData) => {
    setState((prev) => ({ ...prev, canvas }))
  }, [])

  return {
    canvas: state.canvas,
    breadcrumbs: state.breadcrumbs,
    isLoading: state.isLoading,
    error: state.error,
    navigateToRef,
    navigateToBreadcrumb,
    setCanvas,
  }
}
