# Plan: Zoom Reveal — Continuous In-Place Sub-Canvas Rendering

Status: DRAFT — review before implementing.

## Goal

Today, every navigable node has one behavior: clicking the carved corner (or, with `zoomNavigation` enabled, zooming until the node fills the viewport) **commits** to the sub-canvas — the parent disappears, a breadcrumb is pushed, the child becomes the whole canvas.

This plan adds a second behavior: **reveal**. A reveal-mode node's sub-canvas renders **inside the parent node's rect**, recursively, as the parent grows on screen. No commit, no breadcrumb push, no canvas swap. The user sees one continuous zoom from "single box" to "log line text" through arbitrary depth. Sub-canvases are still fetched lazily via the existing `onResolveCanvas` API — only what's about to be visible is loaded.

The two modes are **per-node, opt-in via category**, and they coexist freely in the same hierarchy. The canonical hive use case: the org canvas's `workspace` nodes stay `commit` (clicking enters the workspace, breadcrumb pushes); the workspace canvas's `service` / `pool` / `pod` nodes are `reveal` (one continuous zoom through the infrastructure with logs streaming inside individual pods at extreme zoom).

This is **not** a replacement for `zoomNavigation`. `zoomNavigation` is the cinematic-handoff version of `commit`-mode — auto-commit when the parent fills the viewport. Reveal is orthogonal: there is no commit, ever, for a reveal-mode node — its contents simply become legible in place.

## Scope and non-goals

### In scope (v1)

- Per-node opt-in via `CategoryDefinition.navigationMode: 'commit' | 'reveal'` (default `'commit'`, preserves all existing behavior).
- Reveal-mode rendering: the resolved sub-canvas of a reveal node renders inside the node's rect via composed nested transforms.
- Recursive nesting: a reveal child can itself contain reveal grandchildren, ad infinitum.
- Two thresholds per reveal node: **prefetch** (fillFraction → fire `onResolveCanvas`) and **render** (screen-pixel size of the node → mount sub-canvas inside).
- Optional fade range on the render threshold for smooth transitions.
- Per-slot screen-pixel thresholds (`showWhenNodeAtLeast?: number`) — orthogonal additive primitive for finer richness inside a single node (e.g. log streams that only mount when the pod node is large enough on screen).
- Reveal nodes do **not** render the carved-corner `RefIndicator` (no discrete entry; the affordance is "zoom").
- Edges within a sub-canvas render only within that sub-canvas's clipped region.
- Read-only at depth: nodes inside revealed children do not receive interaction events. Drag, edit, click, hover-to-show-handles, toolbar — all gated to the top-level canvas. Reveal is a visualization mode in v1.

### Explicitly out of scope (v1)

- **No interaction with revealed children.** Click/drag/edit/hover/toolbar on revealed nodes is not supported. Adding it later is non-trivial (composed event handlers, hit-testing through nested transforms, routing `onNodeUpdate` to the right `canvasRef`). Punted.
- **No cross-level edges.** An edge from a deep pod to a shallow database that lives in the parent canvas does not render across the nesting. If a consumer wants the visual, the projector mirrors the edge into both canvases. Library does not compose edges across canvas boundaries.
- **No mixing reveal-with-commit children.** A reveal-mode node's sub-canvas may contain other reveal-mode nodes (nested reveal — supported), but not commit-mode nodes (a discrete drill-in inside a reveal would break the gesture model). If a consumer authors this, the library treats the inner commit-mode node as if it were reveal-mode (with a console warning in dev) — falls back gracefully rather than crashing.
- **No `showAtZoom` on peer nodes.** The original sketch of "pools appear next to Pod Manager as zoom-gated peers on the parent canvas" is not part of this plan. The agreed model is that the four pools always exist as children inside the Pod Manager's sub-canvas; they become legible as the Pod Manager grows on screen. Structural honesty, not visual gating.
- **No new data model concepts.** `ref` + `onResolveCanvas` are the API. Categories declare reveal vs commit. No new fields on `CanvasData`.
- **No author-facing zoom level numbers.** Thresholds use `fillFraction` (viewport-relative) for prefetch and screen pixels for render — both monitor- and viewport-agnostic. No "show at zoom 2.5" anywhere in the API.

## Architectural decisions (confirmed in discussion)

- **Per-node mode, declared on category.** `CategoryDefinition.navigationMode: 'commit' | 'reveal'` (default `'commit'`). Optional per-node override on `CanvasNode.navigationMode` for advanced cases.
- **Mode is a property of the *parent's category***, not the child's canvas. The Pod Manager category says `'reveal'`; whatever sub-canvas its `ref` resolves to is rendered in reveal mode. The sub-canvas itself doesn't know or care.
- **Coexistence is structural, not modal.** A canvas can contain a mix of commit and reveal nodes. The Org canvas typically has commit-mode workspace nodes; the workspace's sub-canvas has reveal-mode service nodes. No global mode switch on `<SystemCanvas>`. The user has no confusion because all nodes on a given canvas are typically authored consistently — but the library does not enforce this.
- **Reveal nodes have no carved corner.** `RefIndicator` is gated on `node.navigationMode !== 'reveal'`. Visual cue: corner = drillable (commit), no corner = continuous (reveal).
- **Lazy fetch via existing `onResolveCanvas`.** Reveal mode reuses the same fetch primitive as commit mode. The library calls `onResolveCanvas(ref)` when the parent's `fillFraction` crosses `prefetchThreshold` (same threshold as `useZoomNavigation`'s prefetch). Result is cached. Cache is shared — a ref prefetched in reveal mode is hot for commit mode and vice versa.
- **Render threshold is in screen pixels, not zoom.** "Render the sub-canvas inside this node when the node's rect is at least N pixels wide on screen." Monitor-agnostic, viewport-agnostic, intuitive. Default `200` (configurable per category and per node).
- **Screen pixels, not fillFraction, for the render threshold** because fillFraction conflates "how big is this node" with "how big is the viewport." A 200px node on a 4K monitor and a 200px node on a laptop both look the same to the user; that's the right invariant. fillFraction stays as the prefetch trigger because prefetch is about "is the user heading toward this node" — fraction-of-viewport is the right shape there.
- **Fade range on render threshold.** Default fade band is 50px below the threshold. A node with `renderChildrenAt: 200` cross-fades its children in linearly between 150px and 200px of node screen-width. Avoids hard pop-in. Configurable via `renderChildrenFade` (default `50`).
- **Recursion is uniform.** Reveal-mode rendering is the same code path at every depth. The Pod Manager at 400px on screen renders its 4 pool children inside; each pool, occupying 80px on screen, renders its summary slot ("9 pods") instead of its own children; as the user keeps zooming and a pool reaches 200px on screen, that pool's pods render inside it; etc. Each level independently makes the prefetch/render decision based on its own current screen size.
- **Per-slot screen-pixel thresholds extend the existing slot system.** Add `showWhenNodeAtLeast?: number` to `SlotSpec`. Library mounts the slot only when its node's screen-width crosses the threshold. Performance-gates expensive slots (log streams, mini-charts) at every depth automatically.
- **Read-only at depth.** Inside a reveal node, child nodes get no interaction wiring — no click handler, no drag handler, no hover handles, no editor, no toolbar. Pointer events on revealed children fall through to the parent commit-mode canvas (which selects the parent reveal node, the same way clicking anywhere on the parent's rect does today).
- **Edges clip to their own canvas.** When a sub-canvas renders inside its parent's rect, edges within it use a clipPath matching the parent's rounded rect. Edges in the parent canvas render at the top level, above everything (including revealed children). The sub-canvas's own edges render at the sub-canvas's depth, below the parent canvas's nodes.
- **Reveal does not push breadcrumb.** Breadcrumbs only update on commits. A user can be visually 4 levels deep in reveal-mode and the breadcrumb still says `Org > Workspace`. The Back button takes them out of the workspace (the most recent commit), not out of the deepest pod.
- **No new auto-fit behavior.** `autoFit` semantics are unchanged. Reveal does not trigger a fit; the user drives zoom manually (or via the existing `zoomNavigation` on commit-mode parents). Fit-to-content for the deepest revealed node is not a concept — there's nothing to fit to.
- **No new data model concepts.** `CanvasNode.ref` and `onResolveCanvas` are the API. The only data-model addition is the optional `navigationMode` field on `CategoryDefinition` and `CanvasNode`.
- **No breaking changes.** All new fields are optional. Existing canvases behave identically until a category opts into `'reveal'`.

---

## Data model

### `CategoryDefinition`

Additive:

```ts
// packages/core/src/types.ts
export interface CategoryDefinition {
  // ...existing fields

  /**
   * How this node's `ref` is presented to the user.
   * - `'commit'` (default): clicking the carved corner navigates to the sub-canvas;
   *   breadcrumb pushes; sub-canvas becomes the whole view. Today's behavior.
   * - `'reveal'`: the sub-canvas renders inside this node's rect when the node is
   *   large enough on screen. No carved corner. No breadcrumb push.
   */
  navigationMode?: 'commit' | 'reveal'

  /**
   * For `navigationMode: 'reveal'` only. Screen pixels of the node's smaller dimension
   * at which the resolved sub-canvas begins rendering inside. Below this, a summary slot
   * (whatever the category declares for the relevant region) renders. Default: 200.
   */
  renderChildrenAt?: number

  /**
   * For `navigationMode: 'reveal'` only. Screen-pixel range over which the sub-canvas
   * cross-fades in. Default: 50. The sub-canvas is 0% opacity at
   * `renderChildrenAt - renderChildrenFade` and 100% at `renderChildrenAt`.
   */
  renderChildrenFade?: number

  /**
   * For `navigationMode: 'reveal'` only. fillFraction (0..1) at which to fire
   * `onResolveCanvas(ref)` to prefetch the sub-canvas. Default: 0.3.
   * Mirrors the existing zoomNavigation prefetchThreshold default.
   */
  prefetchAt?: number
}
```

### `CanvasNode`

Additive (per-node override):

```ts
// packages/core/src/types.ts
export interface CanvasNode {
  // ...existing fields

  /**
   * Per-node override of the category's `navigationMode`.
   * Rare — most consumers set this on the category instead.
   */
  navigationMode?: 'commit' | 'reveal'

  /** Per-node override of category.renderChildrenAt. */
  renderChildrenAt?: number

  /** Per-node override of category.renderChildrenFade. */
  renderChildrenFade?: number

  /** Per-node override of category.prefetchAt. */
  prefetchAt?: number
}
```

### `SlotSpec`

Additive (orthogonal primitive for per-slot richness gating):

```ts
// packages/core/src/types.ts
export interface SlotSpecBase {
  // ...existing fields

  /**
   * Screen-pixel threshold for this slot. The slot is rendered only when its
   * node's screen-width is at least this many pixels. Useful for performance-
   * gating expensive slots (log streams, mini-charts) so they only mount when
   * the user has zoomed enough to actually see them.
   *
   * Independent of `navigationMode` — works on commit-mode and reveal-mode nodes alike.
   */
  showWhenNodeAtLeast?: number
}
```

### `ResolvedNode`

A small extension so renderers can read the resolved navigation mode without re-walking category lookups:

```ts
// packages/core/src/types.ts
export interface ResolvedNode {
  // ...existing fields

  /** Resolved from node → category → default `'commit'`. */
  navigationMode: 'commit' | 'reveal'

  /** Resolved render threshold in screen pixels. Only meaningful when navigationMode === 'reveal'. */
  renderChildrenAt: number
  renderChildrenFade: number
  prefetchAt: number
}
```

`isNavigable` (existing) stays as `node.ref !== undefined` for both modes — both are "this node has a sub-canvas." Renderers gate on `navigationMode` to decide which UI to show.

---

## Rendering model

### The big picture

`Viewport.tsx` today renders the current canvas as a single `<g>` group with the d3-zoom transform applied. Inside that group:

```
<g transform="translate(x,y) scale(k)">
  <LanesBackground />     {/* if columns/rows */}
  <NodeRenderer only="groups" />
  <EdgeRenderer />
  <NodeRenderer only="non-groups" />
</g>
```

In reveal mode, `NodeRenderer` (when rendering a reveal-mode node) **also** renders the resolved sub-canvas inside that node's rect, with a composed transform that maps the sub-canvas's intrinsic coordinates into the parent's local coordinate space.

```
<g transform="translate(x,y) scale(k)">                        {/* root canvas transform */}
  <NodeRenderer for parent reveal node>
    <rect ... />                                                {/* parent's body */}
    <CategorySlotsLayer />                                      {/* parent's slots */}
    <g transform="translate(localX, localY) scale(localK)" clipPath="...">
      {/* child sub-canvas, rendered with the same NodeRenderer/EdgeRenderer pipeline */}
      <LanesBackground />
      <NodeRenderer only="groups" />
      <EdgeRenderer />
      <NodeRenderer only="non-groups" />
        {/* — and recursively, any reveal-mode child renders ITS sub-canvas inside it */}
    </g>
  </NodeRenderer>
</g>
```

The recursion bottoms out when a node's screen-width is below its `renderChildrenAt` threshold — at that depth, the sub-canvas isn't mounted at all, and the node's category-defined summary slot renders instead.

### Transform composition

When rendering a reveal child inside a parent, the child's coordinate space must map into the parent's. Given:

- Parent's local rect (in its own canvas's coordinate space): `{ x, y, width, height }`
- Child sub-canvas's intrinsic bounds (computed via `boundingBox(childCanvas.nodes)` + small padding): `{ x, y, width, height }`

The child's transform inside the parent is the standard fit-bounds-into-rect:

```ts
const scale = Math.min(
  parentRect.width / childBounds.width,
  parentRect.height / childBounds.height,
)
const tx = parentRect.x + (parentRect.width - childBounds.width * scale) / 2 - childBounds.x * scale
const ty = parentRect.y + (parentRect.height - childBounds.height * scale) / 2 - childBounds.y * scale
const childTransform = `translate(${tx}, ${ty}) scale(${scale})`
```

This math already exists in the library — `fitBoundsIntoRect` in `packages/core/src/rendering/viewport-math.ts` (used by `useZoomNavigation` for landing-frame computation). Reuse it.

The child's nodes are then rendered inside `<g transform={childTransform}>` using the **exact same `NodeRenderer` / `EdgeRenderer` pipeline** as the root canvas. No special "embedded" code path. The renderer gets a `parentRevealContext` prop (or similar) telling it "you're rendering inside a reveal parent; gate interaction off; track depth for screen-pixel calculations."

### Computing screen-pixel size at depth

The render-threshold decision (`renderChildrenAt`) needs to know "how many screen pixels does this node's rect occupy?"

For the root canvas: `node.width * viewport.zoom`.

For a reveal child: `node.width * viewport.zoom * parent_local_scale * grandparent_local_scale * ...`.

The product of all enclosing transform scales × the root viewport zoom = the final screen-to-canvas-unit ratio at this depth. We track this product as we descend (`screenScale` accumulator passed down via `parentRevealContext`):

```ts
// At root
screenScale = viewport.zoom

// Entering a reveal child
screenScale = parentScreenScale * childTransform.scale

// At any depth
const nodeScreenWidth = node.width * screenScale
```

Same product is used for slot `showWhenNodeAtLeast` checks.

### Hit-testing and clipping

- Reveal children render inside a `<clipPath>` matching the parent node's rounded rect (same path as the parent's body), so they never paint outside the parent.
- Pointer events on the clip region fall through to the parent. The parent's existing click handler fires; the parent reveal node is selected. Children below are visually present but pointer-transparent. (Implementation: revealed `<g>` gets `pointer-events: none` on every element — the existing slot primitive convention extended to all renderable children at depth.)
- The `parentRevealContext` carries `interactive: false`, which `NodeRenderer` checks before wiring `onClick` / drag / hover handles. When false, those handlers are no-ops.

### Edge handling

- Edges within the child sub-canvas render at the child's depth, inside the same clipped `<g>`. They route normally using existing `computeEdgePath`.
- Cross-level edges are explicitly unsupported (see non-goals). If an edge in `childCanvas.edges` references a node that doesn't exist in `childCanvas.nodes`, it's dropped from rendering with a console warning in dev (same convention as the existing edge-validation path).

### Z-order at depth

Painter's-model order, inside the parent reveal node's group:

1. Parent's `<rect>` body (filled, stroked).
2. Revealed sub-canvas `<g>` (lanes → groups → edges → non-groups, recursively).
3. Parent's `<CategorySlotsLayer>` (paints over the revealed children — header / footer / corner slots are visible at every zoom).
4. Parent's resize handles, ref indicator (gated off in reveal mode), etc.

This means the parent's category slots (header label, footer count, corner badges) are **always visible** even when the children are revealed inside. That's the right behavior: the user always knows which container they're inside.

---

## Prefetch and render orchestration

### State

A new hook `useRevealCanvases` (sibling to `useNavigation`) owns:

- A `Map<ref, CanvasData>` of reveal-mode resolved sub-canvases, populated via `onResolveCanvas`.
- A per-node fillFraction tracker: every viewport change, walk visible reveal nodes and compute their fillFraction. If a node's fillFraction crosses its `prefetchAt` and its ref isn't in the cache, fire `onResolveCanvas(ref)` and store the result.
- The fillFraction calculation is the same one `useZoomNavigation` already does; factor the helper out into `packages/core/src/rendering/fill-fraction.ts` so both hooks share it without duplicating the math.
- The cache is shared with `useNavigation`'s async cache (both feed from `onResolveCanvas`) — promote the cache to a single `useResolvedCanvases` hook that both `useNavigation` and `useRevealCanvases` consume. Avoids double-fetches when a node is hovered between modes.

### Recursion

Prefetch is recursive: when a child sub-canvas is rendered (i.e. parent has crossed `renderChildrenAt`), we walk *its* reveal-mode nodes and check *their* fillFraction against *their* `prefetchAt`. Same fillFraction math, computed against the screen, regardless of nesting depth. This is the key property — the library doesn't care whether a node is at the root or 4 levels deep; the calculation is "what fraction of the viewport does its screen rect occupy."

### Render gating

Each reveal node, on every render, checks:

```ts
const screenWidth = node.width * screenScale
const opacity = clamp01((screenWidth - (renderChildrenAt - renderChildrenFade)) / renderChildrenFade)
const childrenVisible = opacity > 0
```

- If `childrenVisible` is false: don't mount the sub-canvas group at all (saves render work entirely below threshold).
- If true: mount the sub-canvas group with `style={{ opacity }}`.

Crossing the threshold is a React mount / unmount, not a CSS-only show / hide. Below the threshold, none of the child node components exist in the tree — their custom slot renderers, log-stream subscribers, fetchers, etc., never run. Above the threshold (even partially during fade-in), they're fully mounted and consuming their normal lifecycle. This is the performance contract: zoom out far enough and the deep tree is genuinely gone.

### Re-render driver

Today, viewport changes don't trigger React re-renders (d3 mutates the SVG transform attribute directly via `group.setAttribute`). This works because today no React component depends on zoom.

In reveal mode, both render-threshold gating and slot-threshold gating depend on the current screen scale. Two options:

**(a) rAF-poll inside a wrapper component.** Mirror the `LaneHeaders` / `NodeToolbar` pattern: a thin wrapper around `NodeRenderer` (call it `RevealNodeRenderer`) reads `viewportRef.current` on every animation frame and re-renders when the screen scale changes by more than ~1%. Same proven pattern, same performance profile.

**(b) Push from the d3 zoom handler.** Add a state setter wired into the existing `'zoom'` handler that bumps a counter; subscribe to it via context. More React-idiomatic but couples the zoom handler to React state and forces a re-render of the whole tree on every zoom event (~60/sec).

Choose **(a)** — it's the established pattern, scoped to the components that need it, and has a clean opt-out (commit-mode canvases pay zero cost).

### Prefetch debouncing

`onResolveCanvas` is presumably the slow path (DB hit). Debounce on entry: a node has to stay above `prefetchAt` for at least 100ms before we fire the fetch. Avoids thrashing during rapid zoom-in / zoom-out gestures. Cache hits stay synchronous and immediate.

---

## API surface (consumer-facing)

### Authoring a reveal-mode category

In hive's `canvas-theme.ts`, the `pod-manager` category becomes:

```ts
{
  id: 'pod-manager',
  defaultWidth: 200,
  defaultHeight: 120,
  fill: '...',
  navigationMode: 'reveal',           // <-- new
  renderChildrenAt: 220,              // <-- optional override (default 200)
  slots: {
    header: { kind: 'text', value: ctx => ctx.node.text },
    footer: { kind: 'count', value: ctx => ctx.rollup(() => true).total + ' pools' },
  },
}
```

The `slots.footer` count badge is the **summary view** when below the render threshold. When above, it stays visible in the footer strip (slots paint above revealed children) and the four pool nodes become legible inside the rect.

### Authoring a deep slot (logs streaming inside a pod)

```ts
{
  id: 'pod',
  defaultWidth: 80,
  defaultHeight: 50,
  fill: '...',
  // No navigationMode — defaults to 'commit', but the pod has no `ref`, so it never drills.
  // Just a leaf node visually, with a zoom-gated rich slot.
  slots: {
    body: {
      kind: 'custom',
      showWhenNodeAtLeast: 240,        // <-- new: only mount when pod is 240px+ wide on screen
      render: (ctx) => <PodLogStream podId={ctx.node.customData?.podId} />,
    },
  },
}
```

The `<PodLogStream>` component subscribes to a server-sent event stream when mounted, unsubscribes when unmounted. The library guarantees it's only mounted when the pod is large enough on screen to actually be readable. The user zooms back out → the pod shrinks below 240px → React unmounts the component → the SSE subscription closes. No bookkeeping in user code.

### Lazy hierarchy in `onResolveCanvas`

```ts
async function onResolveCanvas(ref: string): Promise<CanvasData> {
  if (ref.startsWith('pod-manager:')) {
    const id = ref.slice('pod-manager:'.length)
    const pools = await fetch(`/api/pod-managers/${id}/pools`).then(r => r.json())
    return {
      nodes: pools.map(p => ({
        id: p.id,
        type: 'text',
        category: 'pool',
        ref: `pool:${p.id}`,             // <-- pool's own ref; library prefetches recursively
        x: p.x, y: p.y, width: 100, height: 80,
        text: p.name,
      })),
      edges: [],
    }
  }
  if (ref.startsWith('pool:')) { /* fetches pods */ }
  if (ref.startsWith('pod:')) { /* fetches log subscription metadata, or returns empty */ }
  // ...
}
```

The projector decides what each level looks like. The library handles the rest. Each level's data is fetched only when the parent crosses its `prefetchAt` threshold, so a user who never zooms past Pod Manager never triggers the pool fetch at all.

### `<SystemCanvas>` props — no changes

No new top-level props. `navigationMode` is per-category. The library auto-detects whether reveal-mode wiring is needed based on whether any rendered node has `navigationMode: 'reveal'`. Consumers who don't use reveal pay zero cost — `useRevealCanvases` short-circuits on an empty reveal-node set.

---

## Implementation plan

Phase order is roughly:

### Phase 1 — Type plumbing (no behavior changes)

1. Add `navigationMode`, `renderChildrenAt`, `renderChildrenFade`, `prefetchAt` to `CategoryDefinition` and `CanvasNode` in `packages/core/src/types.ts`.
2. Add `showWhenNodeAtLeast` to `SlotSpecBase`.
3. Extend `ResolvedNode` with the resolved fields.
4. Update `resolveNode()` (`packages/core/src/canvas.ts`) to populate them with the cascade: node → category → default.
5. Verify `npm run typecheck` clean across all packages.

### Phase 2 — Refactor the fillFraction / fetch cache helpers

1. Extract fillFraction math from `useZoomNavigation` into `packages/core/src/rendering/fill-fraction.ts`.
2. Extract async-canvas-resolution cache from `useNavigation` into a new shared hook `useResolvedCanvases` in `packages/react/src/hooks/`. Both `useNavigation` and the new `useRevealCanvases` (Phase 4) consume it.
3. Smoke-test that today's commit-mode + zoomNavigation still works identically — this is a pure refactor.

### Phase 3 — Reveal-mode rendering: single level, no recursion

1. Gate `RefIndicator` rendering on `node.navigationMode !== 'reveal'`. Reveal nodes get no carved corner.
2. New component `RevealedSubCanvas` in `packages/react/src/components/`:
   - Props: `parentNode: ResolvedNode`, `subCanvasData: CanvasData`, `screenScale: number`, `parentRect: Rect`.
   - Computes child transform via `fitBoundsIntoRect`.
   - Computes child screen-scale and opacity.
   - Renders a clipped `<g>` containing the sub-canvas's nodes and edges via the existing `NodeRenderer` and `EdgeRenderer`, with `parentRevealContext: { interactive: false, screenScale: childScreenScale, depth: 1 }` passed down.
3. New wrapper component `RevealNodeRenderer` (or extend `NodeRenderer` directly): for nodes with `navigationMode: 'reveal'` whose ref is in the resolved-canvases cache, renders `<RevealedSubCanvas>` inside the node's body. Otherwise renders normally.
4. New hook `useRevealCanvases`: walks visible reveal nodes every viewport change (rAF-polled), computes fillFraction, fires `onResolveCanvas` on threshold crossings (debounced 100ms), exposes the cache.
5. `Viewport.tsx` mounts `useRevealCanvases`, threads the cache to `NodeRenderer` via prop / context.
6. `NodeRenderer` accepts `parentRevealContext?` prop. When set with `interactive: false`, gates off click/drag/hover wiring on its rendered children.
7. Test: a hand-rolled demo canvas with one reveal-mode node containing 4 children. Zoom in → children appear and fade in over the parent's rect. Zoom out → children unmount. Verify lazy fetch fires on threshold crossing, not before.

### Phase 4 — Recursion

1. `RevealedSubCanvas`'s inner `NodeRenderer` itself can render reveal-mode children. Verify the recursion works: depth-2 reveal renders inside depth-1 renders inside root.
2. The `parentRevealContext.screenScale` accumulator multiplies through each level. Verify a deep node's `node.width * screenScale` correctly equals its true screen pixel width at any depth.
3. `useRevealCanvases` walks the *whole* visible tree — root, plus every revealed sub-canvas, recursively — to find prefetch candidates. Implementation: after applying root viewport, recurse into mounted reveal sub-canvases and check their nodes. Care: don't walk sub-canvases whose render-threshold isn't met (those nodes aren't "near enough to matter"). The recursion bottoms out naturally.
4. Test: a 3-level demo (Pod Manager → 4 pools → 9 pods each). Zoom continuously through all levels. Verify each level's fetches fire only when the relevant parent crosses its prefetch threshold. Verify the deepest pods' contents are torn down on zoom out.

### Phase 5 — Per-slot screen-pixel thresholds

1. `CategorySlotsLayer` accepts `screenScale` (from the same `parentRevealContext`).
2. For each slot, compute `nodeScreenWidth = node.width * screenScale`. Skip the slot entirely (no React mount) if `nodeScreenWidth < spec.showWhenNodeAtLeast`.
3. This works at every depth — slots inside revealed children get the deep `screenScale`, so a log-stream slot inside a pod inside a pool gets the right gating.
4. Test: a pod node with a `kind: 'custom'` log-stream slot (`showWhenNodeAtLeast: 240`). Zoom in until the pod is 240px wide on screen. Verify the SSE subscription opens. Zoom out. Verify it closes.

### Phase 6 — Showcase + docs

1. Add a reveal-mode example to `demo/src/showcase.ts`. A 3-level hierarchy with a few summary slots and one zoom-gated rich slot. Real working example consumers can copy.
2. Update `AGENTS.md` with the new section under "Key concepts."
3. Update `packages/standalone/examples/cdn.html` with a reveal-mode toggle so casual users can see the effect from a single HTML file.
4. Move `plans/zoom-reveal.md` to `plans/done/`.

### Phase 7 — Hive integration (separate PR, not this lib's plan)

The hive side wires reveal-mode `service` / `pool` / `pod` categories on the workspace canvas, extends the projector to lazy-emit sub-canvases for each level, and adds the `<PodLogStream>` slot. Out of scope for this plan; covered separately under hive's `docs/plans/`.

---

## Open questions (to discuss before Phase 3)

1. **Summary slot strategy below render threshold.** When a reveal node is below `renderChildrenAt`, the children don't render but the category's slots do (header, footer, corner badges). Is that the entire summary surface, or does the library also auto-render a "summary placeholder" when the sub-canvas is loaded but not rendered? Current plan: no auto-summary. The category author is responsible for defining a footer / count slot if they want a summary. Simpler, more explicit.

2. **What if `onResolveCanvas` returns null / errors?** Today, `useNavigation` falls back to "empty canvas" silently. For reveal mode, an errored fetch should probably surface visibly (a red strip in the footer? a console error? both?). Punt the exact UX; v1 falls back to "no children rendered, console warning in dev."

3. **Initial screen-scale before first viewport event.** The viewport ref is initialized at `{ x: 0, y: 0, zoom: 1 }`. A reveal node rendered before the first auto-fit might briefly compute its screen-pixel size against the wrong scale, causing a one-frame flash where children are visible. Mitigation: gate reveal-mode rendering on a "viewport-initialized" flag set after the first fit. Same pattern `useZoomNavigation` already uses for its parentFrames stack.

4. **Group nodes as reveal parents.** Today, `GroupNode` is a special node type with translucent fill and contained-children semantics. Can a group be `navigationMode: 'reveal'`? The plan above implicitly says "yes — same renderer, reveal works on any node type." Need to verify the clip-path and slot-paint-order interactions. May want to defer group-as-reveal-parent to v2 if it surfaces complications.

5. **Resize handles on parents with revealed children.** Resizing a reveal-mode parent should reflow the inner sub-canvas's `fitBoundsIntoRect`. That's automatic — the child transform is recomputed every render. But during the resize gesture itself, the screen-scale changes mid-drag and children may flash in/out of the render threshold. Cosmetic but jarring. Mitigation: during a resize, pin the children's render state to whatever it was at drag-start. Add to the implementation plan or punt to v1.5.

---

## What this gives the consumer (and what it doesn't)

It gives:

- A continuous, cinematic zoom from container to deepest detail, with arbitrary depth.
- Lazy data loading at every level via the existing `onResolveCanvas` API.
- Performance gating for expensive deep slots, automatically scoped to what's visible.
- A clear visual distinction between drillable contexts (carved corner, breadcrumb push) and continuous infrastructure (no corner, in-place reveal).
- Zero migration cost: existing canvases behave identically until a category opts in.

It does not give (in v1):

- Editing or interacting with revealed children. Reveal is for visualization. Modifications happen at the top-level commit-mode canvas, or by the user zooming back out.
- Cross-canvas edges. Each canvas's edges live in that canvas's clip region. Mirror via the projector if a peer-to-peer visual is needed.
- Mixed reveal-and-commit children inside a single reveal parent. Reveal is uniform once you've committed into a reveal-mode subtree.
- A new data model. Same `ref` + `onResolveCanvas` as today.
