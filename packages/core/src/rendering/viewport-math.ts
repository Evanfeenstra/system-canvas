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
