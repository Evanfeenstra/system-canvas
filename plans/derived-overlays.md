# Plan: Derived Node Overlays (Rollups from Sub-Canvas State)

Status: DRAFT — review before implementing.

## Goal

Let a parent node on one canvas reflect aggregated state from the nodes inside its referenced sub-canvas. The canonical example: a "Phase 1" node whose `ref` points to a sub-canvas containing five initiatives. When three of those initiatives have `customData.status === 'done'`, the parent node renders a **60% progress bar** along its bottom edge plus a **"3/5" badge** in its top-right corner.

This is a strong pattern for any hierarchical canvas — roadmaps (phase → initiatives), org diagrams (service → endpoints), OKRs (objective → key results), process diagrams (stage → tasks).

The library stays domain-agnostic. The consumer decides what "progress" means; the library provides the math primitives and the render slots.

---

## Architectural decisions (confirmed)

- **Aggregation is the consumer's responsibility.** Core ships `rollupNodes` / `rollupNodesDeep` as pure, domain-free helpers — they walk nodes and apply a consumer-supplied predicate. Core has no notion of "status" or "done".
- **Overlays are rendered via a single render prop** on `SystemCanvas`: `renderNodeOverlay`. Same pattern as `renderNodeToolbar` and `renderAddNodeButton`.
- **Placement is constrained by library-provided regions**, not free-form. The library pre-computes `{ full, bottomStrip, badge }` rects per node so consumers don't have to do bounds math and don't accidentally cover the label.
- **Text auto-reflows when an overlay occupies the bottom strip.** When `renderNodeOverlay` is present and returns non-null for a node, the node's text rendering shrinks its effective height to leave the bottom strip clear.
- **Convenience components are optional.** Library ships `<NodeProgressBar>` and `<NodeCountBadge>` as small, domain-free SVG helpers. Consumers can skip them and draw their own SVG.
- **No caching in the library.** Rollups run at render time. If a consumer has many deep rollups, they wrap them in their own `useMemo` keyed on the sub-canvas reference.
- **No edge rollups.** Edges do not get an equivalent overlay hook. The need is specific to node-with-ref → sub-canvas-contents, and edges don't have refs.

---

## Data model changes

**None.** This entire feature is additive:

- Core gets new pure helpers (`rollupNodes`, `rollupNodesDeep`) in a new file.
- `CanvasTheme`, `CanvasNode`, `CanvasData` are unchanged.
- No new fields on anything.
- No breaking changes.

The existing `CanvasNode.customData?: Record<string, any>` and `CanvasNode.ref?: string` are the two primitives this feature composes over. Both already exist.

---

## Core: rollup helpers

New file: `packages/core/src/rollup.ts`.

```ts
import type { CanvasData, CanvasNode } from './types.js'

export interface RollupResult {
  /** Total number of nodes considered. */
  total: number
  /** Number of nodes for which the predicate returned true. */
  matched: number
  /**
   * `matched / total`, or `0` when `total === 0`. Always in [0, 1].
   * Provided as a convenience so callers can feed it straight to
   * `<NodeProgressBar fraction={...} />`.
   */
  fraction: number
}

/**
 * Walk the nodes of a single canvas, count how many satisfy the predicate.
 * Sub-canvases (nodes with `ref`) are NOT followed — use `rollupNodesDeep`
 * for recursive walks.
 *
 * Returns zeros for an undefined or empty canvas, so the caller can write
 * `const { fraction } = rollupNodes(getSubCanvas(node.ref), isDone)`
 * without null-checking the canvas.
 */
export function rollupNodes(
  canvas: CanvasData | undefined,
  predicate: (node: CanvasNode) => boolean
): RollupResult {
  const nodes = canvas?.nodes ?? []
  const total = nodes.length
  let matched = 0
  for (const n of nodes) if (predicate(n)) matched++
  return {
    total,
    matched,
    fraction: total === 0 ? 0 : matched / total,
  }
}

/**
 * Recursive variant. Walks the nodes of the starting canvas, and for any
 * node with a `ref`, resolves that ref via `resolve` and descends into it.
 *
 * Cycle-safe: a canvas that refs itself (or an ancestor) is visited at
 * most once per traversal.
 *
 * Returns counts aggregated across the entire tree. Nodes that have a
 * ref are themselves counted at their own level (predicate runs on them
 * before descending), unless the caller chooses to exclude ref-bearing
 * nodes via the predicate.
 */
export function rollupNodesDeep(
  canvas: CanvasData | undefined,
  predicate: (node: CanvasNode) => boolean,
  resolve: (ref: string) => CanvasData | undefined
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
        walk(resolve(n.ref))
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
```

Exports from `packages/core/src/index.ts`:

```ts
export { rollupNodes, rollupNodesDeep } from './rollup.js'
export type { RollupResult } from './rollup.js'
```

---

## React: the overlay render prop

New prop on `SystemCanvas`:

```ts
export interface SystemCanvasProps {
  // ...existing props
  /**
   * Render additional SVG on top of each node. Invoked once per visible
   * node during render; return `null` to draw nothing for that node.
   *
   * The consumer receives the resolved node plus a `regions` object with
   * pre-computed rects for common placement slots. Drawing inside
   * `regions.bottomStrip` automatically reflows the node's text upward.
   *
   * The returned SVG is rendered inside the transformable group above the
   * node body but below the ref indicator and resize handles.
   */
  renderNodeOverlay?: (props: NodeOverlayRenderProps) => React.ReactNode
}
```

New type in `packages/react/src/components/NodeOverlay.tsx`:

```ts
import type { CanvasData, CanvasTheme, ResolvedNode, Rect } from 'system-canvas'

export interface NodeOverlayRenderProps {
  node: ResolvedNode
  theme: CanvasTheme
  /** Look up a sub-canvas by ref. Combines the synchronous `canvases`
   * prop with the async cache from `useNavigation`. Returns `undefined`
   * when the ref is unresolved. */
  getSubCanvas: (ref: string) => CanvasData | undefined
  /** Full canvases map (when `canvases` prop is provided). Useful for
   * deep rollups that need to traverse multiple levels. */
  canvases?: Record<string, CanvasData>
  /** Pre-computed placement rects. All in canvas-space. */
  regions: NodeOverlayRegions
}

export interface NodeOverlayRegions {
  /** The full node rect. Drawing here may overlap text. */
  full: Rect
  /**
   * Reserved bottom strip along the node's lower edge, `max(6, node.height * 0.08)`
   * tall. Library auto-reflows the node's text when the overlay returns
   * non-null for this node. Good for progress bars.
   */
  bottomStrip: Rect
  /**
   * Top-right corner badge slot, 20×20, inset 6px from the node's edges.
   * Collision-free on non-group nodes. For group nodes (which put their
   * ref indicator top-right), the library moves the ref indicator when
   * a badge is rendered.
   */
  badge: Rect
}
```

### Where the overlay renders

Overlay SVG is rendered inside the transformable group, **above** the node body but **below** the ref indicator and resize handles. Paint order becomes:

```
groups → edges → non-group nodes → overlays → ref indicators → resize handles
```

This keeps progress bars / badges visible over the node fill, but the ref indicator (carved corner) and resize handles still sit on top where they remain clickable.

Implementation lives in `NodeRenderer.tsx`:

```tsx
// In NodeRenderer, after rendering node body/text but before RefIndicator:
{renderNodeOverlay && (
  <g className="system-canvas-node-overlay" pointerEvents="none">
    {renderNodeOverlay({ node, theme, getSubCanvas, canvases, regions })}
  </g>
)}
```

`pointerEvents="none"` on the wrapper so overlays never eat clicks meant for the node itself. Consumers who want interactive overlays can re-enable pointer events on their own inner elements.

### How `getSubCanvas` is built

A new internal helper inside `SystemCanvas.tsx`:

```ts
const getSubCanvas = useCallback(
  (ref: string): CanvasData | undefined => {
    if (canvases && canvases[ref]) return canvases[ref]
    // Fall back to useNavigation's async cache (same path useNavigation
    // uses today). Expose that cache via a getter on the hook.
    return navigationAsyncCache.current?.get(ref)
  },
  [canvases]
)
```

This requires a small refactor in `useNavigation` to expose its internal ref-to-canvas cache via a ref/getter. Alternative: skip the async cache entirely and only resolve from `canvases`. For editable mode (which requires `canvases` anyway), this is sufficient; for read-only mode with async refs, overlays simply don't render until the ref is resolved. Ship the simpler version first.

---

## Text reflow

When `renderNodeOverlay` is present and returns non-null for a node, the node's text area shrinks to leave `regions.bottomStrip` clear.

### Current state

`TextNode.tsx` renders text centered in the full node rect. Implementation vertically centers each line in `{ y: node.y, height: node.height }`.

### Change

`NodeRenderer` calls `renderNodeOverlay` before rendering the node component, captures the returned element, and decides whether to pass a `reservedBottom` prop to the node component.

Pseudo-flow:

```tsx
const overlay = renderNodeOverlay?.({ node, ... })
const reservedBottom = overlay ? regions.bottomStrip.height : 0

<TextNode node={node} reservedBottom={reservedBottom} .../>
...
{overlay}
```

`TextNode`, `FileNode`, `LinkNode`, `GroupNode` each accept an optional `reservedBottom?: number` prop and subtract it from their inner layout height when centering content.

### Why not just always reserve the strip?

That would shift text upward on every node, even ones with no overlay — a silent, global visual change. Conditional reflow avoids surprising anyone who doesn't use overlays.

### Edge case: very short nodes

When the reserved strip would leave less than `theme.node.fontSize` vertical space for text, we skip the reflow for that node (overlay still renders; text stays centered; they visually overlap slightly). A 40px tall progress-bar-bearing node would be a pathological case — the consumer can filter their overlay logic by node height if they care.

---

## Convenience components

New file: `packages/react/src/components/NodeProgressBar.tsx`.

```tsx
import type { Rect, CanvasTheme } from 'system-canvas'

interface NodeProgressBarProps {
  region: Rect
  /** 0..1. Values outside this range are clamped. */
  fraction: number
  /** Fill color for the filled portion. Defaults to theme.node.labelColor. */
  color?: string
  /** Fill color for the unfilled portion. Defaults to transparent. */
  bgColor?: string
  /** Border radius for the bar. Defaults to region.height / 2. */
  radius?: number
}

export function NodeProgressBar({ region, fraction, color, bgColor, radius }: NodeProgressBarProps) {
  const f = Math.max(0, Math.min(1, fraction))
  const r = radius ?? region.height / 2
  const filledWidth = region.width * f
  return (
    <g>
      {bgColor && (
        <rect x={region.x} y={region.y} width={region.width} height={region.height} rx={r} fill={bgColor} />
      )}
      {filledWidth > 0 && (
        <rect x={region.x} y={region.y} width={filledWidth} height={region.height} rx={r} fill={color} />
      )}
    </g>
  )
}
```

New file: `packages/react/src/components/NodeCountBadge.tsx`.

```tsx
interface NodeCountBadgeProps {
  region: Rect
  label: string | number
  color?: string
  textColor?: string
  fontFamily?: string
}

export function NodeCountBadge({ region, label, color, textColor, fontFamily }: NodeCountBadgeProps) {
  const cx = region.x + region.width / 2
  const cy = region.y + region.height / 2
  return (
    <g>
      <circle cx={cx} cy={cy} r={region.width / 2} fill={color} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={region.height * 0.5}
        fill={textColor}
        fontFamily={fontFamily}
      >
        {label}
      </text>
    </g>
  )
}
```

Both are pure SVG, ~20 lines each, ship in react package alongside the other node components. Consumers who want different visuals skip them and render their own SVG.

---

## Ref indicator collision handling

Group nodes currently put the ref indicator in the top-right. Non-group (text/file/link) nodes put it in the bottom-right. The badge slot is always top-right.

### Resolution

`RefIndicator` already supports `corner?: 'bottom-right' | 'top-right'`. When a group node has both a ref and an overlay that renders a badge, we render the ref indicator in **bottom-right** instead of top-right to give the badge its space.

Implementation: `NodeRenderer` detects whether `regions.badge` is occupied (overlay returned non-null AND contains SVG inside the badge region — detectable via a sentinel, or simpler: via a `hasBadge` boolean returned alongside the overlay element). Simplest approach:

Change `NodeOverlayRenderProps` to let consumers opt into corner use via a return-shape hint:

```ts
// Overlay can return either a React node, or an object with explicit region usage:
type NodeOverlayResult =
  | React.ReactNode
  | {
      element: React.ReactNode
      usesBadge?: boolean
      usesBottomStrip?: boolean
    }
```

When `usesBadge` is true on a group node with a ref, the ref indicator moves to bottom-right. Similarly, `usesBottomStrip` triggers the text reflow.

Alternative, simpler: always assume both slots are used when the overlay returns non-null. Forces any consumer to accept both reflows even if they only use one slot. Acceptable for v1 — most overlays will use both anyway.

Ship the simple version; upgrade to `NodeOverlayResult` if the constraint becomes annoying.

---

## Usage example (roadmap demo)

```tsx
import {
  rollupNodes,
  NodeProgressBar,
  NodeCountBadge,
  SystemCanvas,
} from 'system-canvas-react'

const isDone = (n: CanvasNode) => n.customData?.status === 'done'

<SystemCanvas
  canvas={roadmapRoot}
  canvases={roadmapCanvases}
  theme={roadmapTheme}
  editable
  renderNodeOverlay={({ node, regions, getSubCanvas, theme }) => {
    if (!node.ref) return null
    const rollup = rollupNodes(getSubCanvas(node.ref), isDone)
    if (rollup.total === 0) return null
    return (
      <>
        <NodeProgressBar
          region={regions.bottomStrip}
          fraction={rollup.fraction}
          color="#4ade80"
          bgColor="rgba(255,255,255,0.08)"
        />
        <NodeCountBadge
          region={regions.badge}
          label={`${rollup.matched}/${rollup.total}`}
          color="#4ade80"
          textColor={theme.background}
          fontFamily={theme.node.fontFamily}
        />
      </>
    )
  }}
/>
```

Result: the "Onboarding v2" node (which refs `roadmap:onboarding`) shows a live progress bar and count badge derived from the three child tasks' statuses. Toggle a child's status via the toolbar and the parent's bar/badge update instantly.

---

## Demo changes

Two small additions to `demo/src/main.tsx`:

1. Wire a `renderNodeOverlay` prop when `mode === 'roadmap'` using the snippet above.
2. Ensure the onboarding sub-canvas children have `customData.status` set to varied values out of the gate so the progress bar shows something interesting on initial load.

No new data files needed. The roadmap example already has the right shape.

---

## What this plan deliberately does NOT include

- **No `status` field on `CanvasNode`.** Stays in `customData`. Same reasoning as the toolbar plan: kanban/roadmap/OKR apps all want different vocabularies.
- **No library-side status aggregation helper.** `rollupNodes(canvas, n => n.customData?.status === 'done')` is already one line. A `statusRollup` helper would force a specific vocabulary into core.
- **No theme-driven overlays.** Overlays are consumer code via a render prop, not data in the theme. Reason: overlays often want arbitrary logic (conditional rendering, multi-level rollups, date math) that doesn't compress into a declarative theme entry. If a common pattern emerges, a `theme.nodeOverlays?: NodeOverlayDefinition[]` could be layered on later, same way `nodeActions` was layered onto the toolbar.
- **No automatic re-rendering on child-canvas changes.** Overlays re-render with the normal React flow. When a child's status changes → `onNodeUpdate` → consumer updates canvases map → SystemCanvas re-renders → overlay re-runs. No pubsub, no observers. The existing flow is already reactive.
- **No progress bar animations.** `<NodeProgressBar>` is a dumb renderer. Consumers who want animated transitions wrap it with their own logic or use a different progress-bar component.
- **No edge overlays.** Not a need we've seen; edges don't have refs.
- **No built-in memoization.** Rollups run at render. A consumer worried about perf wraps the rollup in `useMemo(() => rollupNodes(sub, pred), [sub])`. Library doesn't try to be smart.

---

## Implementation order

1. **Core: `rollup.ts`** — `rollupNodes`, `rollupNodesDeep`, `RollupResult`. Pure functions, no React. Unit-test with a small canvas tree.
2. **Core: exports** — add to `packages/core/src/index.ts`.
3. **React: `NodeOverlayRenderProps` type** — declared in a new `NodeOverlay.tsx` or inlined in `SystemCanvas.tsx`.
4. **React: `getSubCanvas` helper** — small util inside `SystemCanvas` that reads `canvases` first, then falls back to `useNavigation` cache.
5. **React: `regions` computation** — pure function `computeNodeOverlayRegions(node)` returning `{ full, bottomStrip, badge }`. Lives in core (it's pure math) or in react (it's tied to rendering) — either works; prefer core for reusability.
6. **React: NodeRenderer wiring** — call `renderNodeOverlay`, render returned SVG inside the transformable group in the correct paint order.
7. **React: text reflow** — `reservedBottom` prop on TextNode/FileNode/LinkNode/GroupNode, applied when overlay is non-null.
8. **React: `<NodeProgressBar>` + `<NodeCountBadge>`** — convenience components.
9. **React: ref indicator bump** — move group node's ref indicator to bottom-right when an overlay is rendered.
10. **Demo: wire the overlay** in roadmap mode with status-based rollup.
11. **AGENTS.md** — document the new render prop and rollup helpers under Key Concepts.

Each step is independently testable against `npm run typecheck`.

---

## Open questions to resolve during implementation

- **`computeNodeOverlayRegions` — core or react?** Leaning core, since it's pure geometry. Goes alongside `rollup.ts`.
- **Async `getSubCanvas`?** If the consumer uses `onResolveCanvas` (async-only), overlays silently don't render for unresolved refs. Acceptable trade-off; doc it.
- **Should `regions.bottomStrip.height` be configurable via theme?** Probably yes — add `theme.node.overlayBottomStripHeight` or similar. Defaults to `max(6, node.height * 0.08)`. Punt to v2 if we don't have a concrete need.
- **Should `NodeProgressBar` pull defaults from the theme?** Currently it accepts explicit colors. Could fall back to `theme.node.labelColor` / `theme.node.fill` when unset — decide based on what feels least surprising in the demo.
