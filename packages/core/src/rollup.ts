import type { CanvasData, CanvasNode, RollupResult } from './types.js'

/**
 * Count how many direct children of `canvas` match `predicate`, and return
 * a `RollupResult` with `total`, `matched`, and `fraction`.
 *
 * Safe on `undefined` / empty canvases: returns `{ total: 0, matched: 0,
 * fraction: 0 }`. This is the ergonomic fallback used by slot accessors
 * when a node's sub-canvas hasn't resolved yet.
 *
 * Only counts direct children. For recursive counts through nested
 * sub-canvases, use `rollupNodesDeep`.
 */
export function rollupNodes(
  canvas: CanvasData | undefined,
  predicate: (node: CanvasNode) => boolean
): RollupResult {
  const nodes = canvas?.nodes ?? []
  const total = nodes.length
  if (total === 0) return { total: 0, matched: 0, fraction: 0 }
  let matched = 0
  for (const n of nodes) {
    if (predicate(n)) matched++
  }
  return { total, matched, fraction: matched / total }
}

/**
 * Recursive version of `rollupNodes`. For each node that has a `ref`,
 * looks up its sub-canvas via `getSubCanvas` and counts its descendants as
 * well. Nodes with refs but unresolved sub-canvases still count as a single
 * node (themselves) in `total`.
 *
 * Cycle-safe: each canvas ref is visited at most once per rollup.
 */
export function rollupNodesDeep(
  canvas: CanvasData | undefined,
  predicate: (node: CanvasNode) => boolean,
  getSubCanvas: (ref: string) => CanvasData | undefined
): RollupResult {
  const visited = new Set<string>()
  let total = 0
  let matched = 0

  const walk = (c: CanvasData | undefined) => {
    if (!c) return
    for (const n of c.nodes ?? []) {
      total++
      if (predicate(n)) matched++
      if (n.ref && !visited.has(n.ref)) {
        visited.add(n.ref)
        walk(getSubCanvas(n.ref))
      }
    }
  }

  walk(canvas)
  return {
    total,
    matched,
    fraction: total === 0 ? 0 : matched / total,
  }
}
