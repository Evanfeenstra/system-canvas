import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  SystemCanvas as SystemCanvasReact,
  type SystemCanvasProps,
} from 'system-canvas-react'
import {
  addNode,
  updateNode,
  removeNode,
  addEdge,
  updateEdge,
  removeEdge,
  themes,
  type CanvasData,
  type CanvasNode,
  type CanvasEdge,
  type CanvasTheme,
  type NodeUpdate,
  type EdgeUpdate,
} from 'system-canvas'

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

type ThemeOption = CanvasTheme | Partial<CanvasTheme> | keyof typeof themes

export interface StandaloneOptions
  extends Omit<SystemCanvasProps, 'canvas' | 'canvases' | 'theme'> {
  /** Root canvas data. Required. */
  canvas: CanvasData

  /**
   * Map of ref -> CanvasData for sub-canvases. Optional. When editable mode
   * is enabled, the standalone wrapper will automatically keep this map
   * up to date as edits are made on sub-canvases.
   */
  canvases?: Record<string, CanvasData>

  /**
   * Theme as an object, a partial override, or a string theme name
   * (one of: 'dark', 'midnight', 'light', 'blueprint', 'warm').
   */
  theme?: ThemeOption

  /**
   * Called whenever the internal canvas state changes (any edit in editable
   * mode). Receives the new root canvas and the sub-canvas map.
   */
  onChange?: (canvas: CanvasData, canvases: Record<string, CanvasData>) => void
}

export interface StandaloneInstance {
  /** Get the current root canvas. */
  getCanvas: () => CanvasData
  /** Get the current sub-canvas map. */
  getCanvases: () => Record<string, CanvasData>
  /** Replace the root canvas and re-render. */
  setCanvas: (canvas: CanvasData) => void
  /** Replace the sub-canvas map and re-render. */
  setCanvasesMap: (canvases: Record<string, CanvasData>) => void
  /**
   * Update any subset of the options (theme, editable, callbacks, etc.)
   * and re-render. `canvas` and `canvases` are also accepted; if provided,
   * they replace the internal state.
   */
  update: (partial: Partial<StandaloneOptions>) => void
  /** Subscribe to change events. Returns an unsubscribe function. */
  on: (
    event: 'change',
    listener: (canvas: CanvasData, canvases: Record<string, CanvasData>) => void
  ) => () => void
  /** Unmount React and release all resources. */
  destroy: () => void
}

// -----------------------------------------------------------------------------
// Implementation
// -----------------------------------------------------------------------------

function resolveThemeOption(
  theme: ThemeOption | undefined
): CanvasTheme | Partial<CanvasTheme> | undefined {
  if (typeof theme === 'string') {
    return themes[theme] ?? undefined
  }
  return theme
}

/**
 * Mount a system-canvas into an HTML element.
 *
 * @example
 *   const instance = SystemCanvas.render(document.getElementById('app'), {
 *     canvas: { nodes: [...], edges: [...] },
 *     theme: 'midnight',
 *     editable: true,
 *     onChange: (canvas) => console.log('updated', canvas),
 *   })
 *   instance.destroy() // when done
 */
export function render(
  element: HTMLElement,
  options: StandaloneOptions
): StandaloneInstance {
  if (!element) {
    throw new Error('[system-canvas] render(): target element is required')
  }

  // Internal mutable state
  let currentCanvas: CanvasData = options.canvas
  let currentCanvases: Record<string, CanvasData> = { ...(options.canvases ?? {}) }
  let currentOptions: StandaloneOptions = options
  const listeners = new Set<
    (canvas: CanvasData, canvases: Record<string, CanvasData>) => void
  >()

  const root: Root = createRoot(element)

  const emitChange = () => {
    currentOptions.onChange?.(currentCanvas, currentCanvases)
    listeners.forEach((l) => {
      try {
        l(currentCanvas, currentCanvases)
      } catch (err) {
        console.error('[system-canvas] change listener threw:', err)
      }
    })
  }

  // Resolve the target CanvasData for a given canvasRef (undefined = root).
  const getTarget = (canvasRef: string | undefined): CanvasData => {
    if (!canvasRef) return currentCanvas
    return currentCanvases[canvasRef] ?? { nodes: [], edges: [] }
  }

  const setTarget = (canvasRef: string | undefined, next: CanvasData) => {
    if (!canvasRef) {
      currentCanvas = next
    } else {
      currentCanvases = { ...currentCanvases, [canvasRef]: next }
    }
  }

  // Mutation handlers that delegate to core helpers
  const handleNodeAdd = (node: CanvasNode, canvasRef: string | undefined) => {
    const target = getTarget(canvasRef)
    setTarget(canvasRef, addNode(target, node))
    currentOptions.onNodeAdd?.(node, canvasRef)
    doRender()
    emitChange()
  }

  const handleNodeUpdate = (
    nodeId: string,
    patch: NodeUpdate,
    canvasRef: string | undefined
  ) => {
    const target = getTarget(canvasRef)
    setTarget(canvasRef, updateNode(target, nodeId, patch))
    currentOptions.onNodeUpdate?.(nodeId, patch, canvasRef)
    doRender()
    emitChange()
  }

  const handleNodeDelete = (nodeId: string, canvasRef: string | undefined) => {
    const target = getTarget(canvasRef)
    setTarget(canvasRef, removeNode(target, nodeId))
    currentOptions.onNodeDelete?.(nodeId, canvasRef)
    doRender()
    emitChange()
  }

  const handleEdgeAdd = (edge: CanvasEdge, canvasRef: string | undefined) => {
    const target = getTarget(canvasRef)
    setTarget(canvasRef, addEdge(target, edge))
    currentOptions.onEdgeAdd?.(edge, canvasRef)
    doRender()
    emitChange()
  }

  const handleEdgeUpdate = (
    edgeId: string,
    patch: EdgeUpdate,
    canvasRef: string | undefined
  ) => {
    const target = getTarget(canvasRef)
    setTarget(canvasRef, updateEdge(target, edgeId, patch))
    currentOptions.onEdgeUpdate?.(edgeId, patch, canvasRef)
    doRender()
    emitChange()
  }

  const handleEdgeDelete = (edgeId: string, canvasRef: string | undefined) => {
    const target = getTarget(canvasRef)
    setTarget(canvasRef, removeEdge(target, edgeId))
    currentOptions.onEdgeDelete?.(edgeId, canvasRef)
    doRender()
    emitChange()
  }

  const doRender = () => {
    // Strip out our wrapper-specific fields and the raw canvas/canvases/theme
    // so the remaining props pass straight through to SystemCanvas.
    const {
      canvas: _canvas,
      canvases: _canvases,
      theme,
      onChange: _onChange,
      onNodeAdd: _onNodeAdd,
      onNodeUpdate: _onNodeUpdate,
      onNodeDelete: _onNodeDelete,
      onEdgeAdd: _onEdgeAdd,
      onEdgeUpdate: _onEdgeUpdate,
      onEdgeDelete: _onEdgeDelete,
      ...passthrough
    } = currentOptions

    const resolvedTheme = resolveThemeOption(theme)

    const props: SystemCanvasProps = {
      ...passthrough,
      canvas: currentCanvas,
      canvases: currentCanvases,
      theme: resolvedTheme,
      // Always provide our managed handlers so state stays in sync. Consumer
      // callbacks are invoked inside them for observation.
      onNodeAdd: handleNodeAdd,
      onNodeUpdate: handleNodeUpdate,
      onNodeDelete: handleNodeDelete,
      onEdgeAdd: handleEdgeAdd,
      onEdgeUpdate: handleEdgeUpdate,
      onEdgeDelete: handleEdgeDelete,
    }

    root.render(React.createElement(SystemCanvasReact, props))
  }

  doRender()

  return {
    getCanvas: () => currentCanvas,
    getCanvases: () => currentCanvases,
    setCanvas: (next) => {
      currentCanvas = next
      doRender()
      emitChange()
    },
    setCanvasesMap: (next) => {
      currentCanvases = { ...next }
      doRender()
      emitChange()
    },
    update: (partial) => {
      if (partial.canvas) currentCanvas = partial.canvas
      if (partial.canvases) currentCanvases = { ...partial.canvases }
      currentOptions = { ...currentOptions, ...partial }
      doRender()
    },
    on: (event, listener) => {
      if (event !== 'change') {
        throw new Error(`[system-canvas] unknown event: ${event}`)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    destroy: () => {
      listeners.clear()
      root.unmount()
    },
  }
}

// Re-export themes so users can do SystemCanvas.themes.midnight
export { themes }

// Re-export types for the ESM bundle
export type {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  CanvasTheme,
  NodeUpdate,
  EdgeUpdate,
} from 'system-canvas'
