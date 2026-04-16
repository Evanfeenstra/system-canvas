import type { CanvasData, CanvasNode, CanvasEdge, ResolvedNode, CanvasTheme } from './types.js'
import { resolveNode } from './themes/resolve.js'

/**
 * Resolve all nodes in a canvas, applying category defaults and color resolution.
 */
export function resolveCanvas(
  canvas: CanvasData,
  theme: CanvasTheme
): { nodes: ResolvedNode[]; edges: CanvasEdge[] } {
  const nodes = (canvas.nodes ?? []).map((n) => resolveNode(n, theme))
  const edges = canvas.edges ?? []
  return { nodes, edges }
}

/**
 * Build a lookup map from node IDs to resolved nodes.
 */
export function buildNodeMap(
  nodes: ResolvedNode[]
): Map<string, ResolvedNode> {
  const map = new Map<string, ResolvedNode>()
  for (const node of nodes) {
    map.set(node.id, node)
  }
  return map
}

/**
 * Get the display label for a node (used in breadcrumbs, tooltips, etc.).
 */
export function getNodeLabel(node: CanvasNode): string {
  if (node.type === 'group' && node.label) return node.label
  if (node.type === 'text' && node.text) {
    // Use first line of text, truncated
    const firstLine = node.text.split('\n')[0]
    return firstLine.length > 40
      ? firstLine.slice(0, 37) + '...'
      : firstLine
  }
  if (node.type === 'file' && node.file) return node.file
  if (node.type === 'link' && node.url) return node.url
  return node.id
}

/**
 * Determine which nodes are spatially contained within a group node.
 */
export function getGroupChildren(
  group: ResolvedNode,
  allNodes: ResolvedNode[]
): ResolvedNode[] {
  return allNodes.filter(
    (n) =>
      n.id !== group.id &&
      n.x >= group.x &&
      n.y >= group.y &&
      n.x + n.width <= group.x + group.width &&
      n.y + n.height <= group.y + group.height
  )
}

/**
 * Validate a canvas document. Returns an array of error messages (empty if valid).
 */
export function validateCanvas(canvas: CanvasData): string[] {
  const errors: string[] = []
  const nodeIds = new Set<string>()

  for (const node of canvas.nodes ?? []) {
    if (!node.id) errors.push('Node missing id')
    if (!node.type) errors.push(`Node ${node.id}: missing type`)
    if (node.x == null) errors.push(`Node ${node.id}: missing x`)
    if (node.y == null) errors.push(`Node ${node.id}: missing y`)
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`)
    }
    nodeIds.add(node.id)
  }

  for (const edge of canvas.edges ?? []) {
    if (!edge.id) errors.push('Edge missing id')
    if (!edge.fromNode) errors.push(`Edge ${edge.id}: missing fromNode`)
    if (!edge.toNode) errors.push(`Edge ${edge.id}: missing toNode`)
    if (edge.fromNode && !nodeIds.has(edge.fromNode)) {
      errors.push(`Edge ${edge.id}: fromNode "${edge.fromNode}" not found`)
    }
    if (edge.toNode && !nodeIds.has(edge.toNode)) {
      errors.push(`Edge ${edge.id}: toNode "${edge.toNode}" not found`)
    }
  }

  return errors
}
