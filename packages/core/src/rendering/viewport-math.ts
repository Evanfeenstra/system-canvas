import type {
  ResolvedNode,
  BoundingBox,
  ViewportState,
} from '../types.js'

/**
 * Compute the bounding box of all nodes.
 */
export function computeBoundingBox(nodes: ResolvedNode[]): BoundingBox {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Compute a viewport transform that fits all nodes into the given
 * viewport dimensions with padding.
 */
export function fitToBounds(
  nodes: ResolvedNode[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 60
): ViewportState {
  const bounds = computeBoundingBox(nodes)

  if (bounds.width === 0 || bounds.height === 0) {
    return { x: 0, y: 0, zoom: 1 }
  }

  const availableWidth = viewportWidth - padding * 2
  const availableHeight = viewportHeight - padding * 2

  const scaleX = availableWidth / bounds.width
  const scaleY = availableHeight / bounds.height
  const zoom = Math.min(scaleX, scaleY, 2) // cap at 2x

  // Center the content
  const contentCenterX = bounds.minX + bounds.width / 2
  const contentCenterY = bounds.minY + bounds.height / 2

  const x = viewportWidth / 2 - contentCenterX * zoom
  const y = viewportHeight / 2 - contentCenterY * zoom

  return { x, y, zoom }
}

/**
 * Convert a screen-space point to canvas-space given the current viewport.
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewport: ViewportState
): { x: number; y: number } {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  }
}

/**
 * Convert a canvas-space point to screen-space given the current viewport.
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: ViewportState
): { x: number; y: number } {
  return {
    x: canvasX * viewport.zoom + viewport.x,
    y: canvasY * viewport.zoom + viewport.y,
  }
}

/**
 * Axis-aligned rectangle in either canvas-space or screen-space.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Compute a viewport transform that places the given canvas-space bounds
 * (`bounds`) so that they fit inside the given screen-space rect
 * (`targetScreenRect`), preserving aspect ratio (contain). When the aspect
 * ratios differ, the bounds are letterboxed (centered) on the shorter axis.
 *
 * `padding` (in screen pixels) insets the target rect on all sides before
 * fitting, giving the content visual breathing room.
 *
 * This is the core "seamless handoff" math: given a parent node's on-screen
 * rect and a child canvas's bounding box, it returns the new viewport
 * transform that makes the child canvas appear exactly where the parent
 * node was.
 */
export function fitBoundsIntoRect(
  bounds: BoundingBox,
  targetScreenRect: Rect,
  padding: number = 0
): ViewportState {
  if (bounds.width === 0 || bounds.height === 0) {
    // Degenerate bounds — center the single point in the target rect at 1x.
    return {
      x: targetScreenRect.x + targetScreenRect.width / 2 - bounds.minX,
      y: targetScreenRect.y + targetScreenRect.height / 2 - bounds.minY,
      zoom: 1,
    }
  }

  const availW = Math.max(1, targetScreenRect.width - padding * 2)
  const availH = Math.max(1, targetScreenRect.height - padding * 2)

  const scaleX = availW / bounds.width
  const scaleY = availH / bounds.height
  // Contain (fit-inside): use the smaller scale so both dimensions fit.
  const zoom = Math.min(scaleX, scaleY)

  // Center the scaled bounds inside the padded target rect.
  const scaledW = bounds.width * zoom
  const scaledH = bounds.height * zoom
  const offsetX = padding + (availW - scaledW) / 2
  const offsetY = padding + (availH - scaledH) / 2

  const x = targetScreenRect.x + offsetX - bounds.minX * zoom
  const y = targetScreenRect.y + offsetY - bounds.minY * zoom

  return { x, y, zoom }
}

/**
 * Compute the on-screen rect of a canvas-space rect under the given viewport.
 */
export function canvasRectToScreenRect(
  canvasRect: Rect,
  viewport: ViewportState
): Rect {
  return {
    x: canvasRect.x * viewport.zoom + viewport.x,
    y: canvasRect.y * viewport.zoom + viewport.y,
    width: canvasRect.width * viewport.zoom,
    height: canvasRect.height * viewport.zoom,
  }
}
