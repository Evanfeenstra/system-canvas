# AGENTS.md

## Project overview

This is **system-canvas** — a library for rendering interactive, zoomable SVG diagrams from JSON Canvas spec documents. It is the high-level UI for an LLM code generation platform, providing a spatial canvas where users can visualize an entire organization, zoom into areas, and kick off code generation or research agents.

The library is **domain-agnostic**. It knows about canvases, nodes, edges, colors, themes, and categories. It does not know about teams, repositories, agents, or any application-specific concept. The consuming application maps its domain onto generic canvas primitives.

## Architecture

This is an npm workspaces monorepo with two publishable packages and a demo app:

```
packages/core/   → system-canvas        (pure TypeScript, zero dependencies)
packages/react/  → system-canvas-react  (React components, depends on system-canvas + d3-zoom)
demo/            → system-canvas-demo   (Vite + React demo app, not published)
```

### system-canvas (core)

Pure TypeScript. No React, no DOM, no dependencies. Any framework adapter imports from here.

- `src/types.ts` — All TypeScript interfaces. This is the source of truth for the data model.
- `src/canvas.ts` — Canvas data helpers: resolve nodes, build lookup maps, validate, get labels, find group children, and editing helpers (`addNode`, `updateNode`, `removeNode`, `generateNodeId`, `getNodeMenuOptions`, `createNodeFromOption`).
- `src/themes/` — Five pre-made themes (dark, midnight, light, blueprint, warm) plus the resolver that merges partial themes and resolves colors/categories.
- `src/rendering/` — Pure math: anchor point computation, edge path routing (bezier/straight/orthogonal), viewport transforms, bounding box calculation.

### system-canvas-react

React bindings. Depends on `system-canvas` for all types and math.

- `src/components/SystemCanvas.tsx` — Main orchestrator component. This is what consumers import.
- `src/components/Viewport.tsx` — SVG container with d3-zoom pan/zoom and grid background.
- `src/components/NodeRenderer.tsx` — Dispatches to type-specific node components. Accepts `only?: 'groups' | 'non-groups'` so the caller can interleave edges between group and non-group layers.
- `src/components/TextNode.tsx`, `FileNode.tsx`, `LinkNode.tsx`, `GroupNode.tsx` — One component per JSON Canvas node type.
- `src/components/EdgeRenderer.tsx` — Renders all edges with arrowhead markers, labels, and click targets.
- `src/components/ConnectionHandles.tsx` — Four small circular handles (one per side) shown on the hovered node in editable mode; pressing one begins an edge-creation drag.
- `src/components/PendingEdgeRenderer.tsx` — Ghost edge drawn during an edge-creation drag. Uses `computeEdgePath` with a synthetic zero-sized target at the cursor when no drop target is hovered.
- `src/components/RefIndicator.tsx` — Clickable "enter sub-canvas" corner drawn on navigable nodes.
- `src/components/NodeEditor.tsx` — Inline editor rendered via `<foreignObject>` for text/file/link/group fields.
- `src/components/EdgeLabelEditor.tsx` — Inline edge label editor rendered via `<foreignObject>` centered on the edge midpoint.
- `src/components/AddNodeButton.tsx` — Default floating "+" FAB and add-node popover menu.
- `src/components/Breadcrumbs.tsx` — Navigation breadcrumb trail overlay.
- `src/hooks/useViewport.ts` — d3-zoom integration, fit-to-content. Rejects pan gestures originating inside `.system-canvas-node` so node drags don't also pan.
- `src/hooks/useNavigation.ts` — Ref-stack breadcrumb state; prefers the synchronous `canvases` map when present, falls back to `onResolveCanvas` with an internal async cache.
- `src/hooks/useCanvasInteraction.ts` — Click, double-click, navigate, and context menu handler wiring.
- `src/hooks/useNodeDrag.ts` — Pointer-event drag with group-children-follow; drag overrides are cleared on pointerup.

## Key concepts

### JSON Canvas spec extensions

We extend the [JSON Canvas spec](https://jsoncanvas.org) with two optional fields on nodes:

- **`ref`** (string) — A URI pointing to a sub-canvas. Any node type can have a ref. Nodes with refs are "navigable" — the carved corner indicator on the node navigates via the `onResolveCanvas` callback or a synchronous `canvases` map.
- **`category`** (string) — Maps to a `CategoryDefinition` in the theme. Provides default width, height, fill, stroke, corner radius, icon, and an optional `type` (the JSON Canvas node type a category creates from the add-node menu; defaults to `text`). When `category` is set, `width` and `height` become optional.

### Navigation model

Navigation is discrete, not continuous zoom. Navigable nodes render a clickable **carved corner** (bottom-right for text/file/link, top-right for groups) that continues the node's own stroke to form a small square containing an arrow/chevron. Clicking that corner pushes a new canvas onto a breadcrumb stack.

Clicking the node body itself never navigates — it fires `onNodeClick` and (in editable mode) selects the node. Double-clicking a node always opens the inline editor in editable mode.

Two resolution paths for sub-canvas data (in priority order):
1. **`canvases` prop** — a synchronous `Record<string, CanvasData>`. Always preferred when a ref is present in the map. Required for `editable` mode so consumer-side edits to sub-canvases are observable by the library.
2. **`onResolveCanvas(ref)`** — async callback. Results are cached internally by ref. Used as a fallback when `canvases` lacks the ref.

Breadcrumbs allow navigating back up. The library exposes `currentCanvasRef` (the ref of the currently-viewed canvas, `undefined` at root) so editing callbacks can identify which entry in the consumer's canvases map to mutate.

### Editing model

The library is stateless with respect to canvas data. When `editable` is true, it emits granular mutation callbacks; the consumer owns `CanvasData` and passes the updated object back as the `canvas` prop (or via the `canvases` map for sub-canvases).

Callbacks (all receive `canvasRef: string | undefined` — the ref of the canvas the node/edge lives on, or `undefined` for the root):
- `onNodeAdd(node, canvasRef)` — fired when the user picks an option from the add-node menu.
- `onNodeUpdate(nodeId, patch, canvasRef)` — fired after drags and editor commits. `patch: NodeUpdate` is `Partial<Omit<CanvasNode, 'id' | 'type'>>`.
- `onNodeDelete(nodeId, canvasRef)` — fired when the user presses Delete/Backspace with a selected node.
- `onEdgeAdd(edge, canvasRef)` — fired when the user completes an edge-creation drag (connection handle → another node).
- `onEdgeUpdate(edgeId, patch, canvasRef)` — fired after edge label editor commits. `patch: EdgeUpdate` is `Partial<Omit<CanvasEdge, 'id'>>`.
- `onEdgeDelete(edgeId, canvasRef)` — fired when the user presses Delete/Backspace with a selected edge.

Consumers typically implement these by calling the core helpers `addNode / updateNode / removeNode / addEdge / updateEdge / removeEdge` on their own `Record<string, CanvasData>` map.

Editing UI:
- **Add**: a floating "+" button opens a popover listing categories (with color swatch + icon) above base JSON Canvas types. Fully replaceable via the `renderAddNodeButton` render prop.
- **Drag**: pointer-event drag on any node. Dragging a group moves its spatially-contained children (computed once at drag-start via `getGroupChildren`). Drag overrides are local to the library and cleared on pointerup; the committed position flows through `onNodeUpdate`.
- **Edit**: double-click any node opens an inline editor in a `<foreignObject>` — `<textarea>` for `text`, `<input>` for `file` / `link` / `group`. Enter commits, Escape cancels.
- **Edges**: single-click selects an edge (thicker, high-contrast stroke). Double-click opens an inline label editor (`<foreignObject>` centered on the edge midpoint). Selecting an edge clears any node selection and vice versa. `onEdgeClick` always fires — in editable mode, selection happens alongside.
- **Connect**: hovering a node in editable mode reveals four connection handles (one per side). Dragging from a handle to another node creates a new edge, firing `onEdgeAdd(edge, canvasRef)`. The new edge's `fromSide` is set to the handle that was grabbed; `toSide` is left undefined so the renderer auto-routes. Releasing over empty space cancels silently. A ghost edge (`PendingEdgeRenderer`) tracks the cursor during the drag; the hovered drop target gets a highlight halo.
- **Delete**: single-click selects (dashed outline for nodes, highlighted stroke for edges). The outer `<div>` has `tabIndex={0}` so Delete/Backspace fires `onNodeDelete` or `onEdgeDelete` depending on what's selected. Keys are scoped to the canvas — no window listener.
- **Pan vs. drag**: d3-zoom's `.filter()` rejects any gesture whose target is inside `.system-canvas-node`, so node drags never double as canvas pans. Background drags still pan normally.

### Theme system

Themes are plain objects implementing `CanvasTheme`. They control every visual aspect: background, grid, node styles, edge styles, group styles, breadcrumb styles, preset color mappings ("1"-"6"), and category definitions.

Resolution order for node visuals:
1. Explicit node properties (`color`, `width`, `height`) — highest priority
2. Category defaults from theme — fallback when node properties are absent
3. Base theme defaults — final fallback

### Rendering technique

Nodes use the **double-rect technique**: an opaque backer rectangle (matching the background color) is drawn first, then a semi-transparent styled rectangle on top. This prevents edges from bleeding through transparent node fills.

SVG paint order (painter's model, later = on top): **groups → edges → non-group nodes → resize handles**. Groups sit behind so edges can pass over their translucent fills and remain clickable; regular nodes sit above edges so arrow tips tuck cleanly under node borders at endpoints.

## Commands

```bash
npm run build          # Build both packages (core first, then react)
npm run build:core     # Build system-canvas only
npm run build:react    # Build system-canvas-react only
npm run dev            # Start the Vite demo app at localhost:5173
npm run typecheck      # Type-check all workspaces
```

## Code conventions

- **No CSS files.** All styling is inline via SVG attributes and React `style` props, driven by the theme object.
- **No emojis in code or comments.**
- **`.js` extensions in imports** — Required for ESM compatibility. All internal imports use `.js` even though source is `.ts` (e.g., `from './types.js'`).
- **Core must have zero React imports.** The boundary between packages is strict: core does math and data, react does DOM and events.
- **Types live in core.** Even types used primarily by React components (like `ContextMenuEvent`) are defined in `system-canvas` so framework adapters can use them.
- **Nodes are resolved before rendering.** Raw `CanvasNode` goes through `resolveNode()` to produce `ResolvedNode` with all dimensions and colors computed. Renderers only work with `ResolvedNode`.

## Adding a new theme

1. Create `packages/core/src/themes/yourtheme.ts` implementing `CanvasTheme`
2. Export it from `packages/core/src/themes/index.ts`
3. Add it to the `themes` object in `packages/core/src/index.ts`

## Adding a new node type

The JSON Canvas spec has 4 types: text, file, link, group. If you add a new type:

1. Add the type string to `NodeType` in `types.ts`
2. Add any type-specific fields to `CanvasNode` in `types.ts`
3. Create a new component in `packages/react/src/components/`
4. Register it in `NodeRenderer.tsx`'s `getNodeComponent()` switch

## Adding a new edge routing style

1. Add the style string to `EdgeStyle` in `types.ts`
2. Implement the path computation function in `rendering/edge-routing.ts`
3. Add the case to the switch in `computeEdgePath()`
