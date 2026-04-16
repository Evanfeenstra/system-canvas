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
- `src/canvas.ts` — Canvas data helpers: resolve nodes, build lookup maps, validate, get labels, find group children.
- `src/themes/` — Five pre-made themes (dark, midnight, light, blueprint, warm) plus the resolver that merges partial themes and resolves colors/categories.
- `src/rendering/` — Pure math: anchor point computation, edge path routing (bezier/straight/orthogonal), viewport transforms, bounding box calculation.

### system-canvas-react

React bindings. Depends on `system-canvas` for all types and math.

- `src/components/SystemCanvas.tsx` — Main orchestrator component. This is what consumers import.
- `src/components/Viewport.tsx` — SVG container with d3-zoom pan/zoom and grid background.
- `src/components/NodeRenderer.tsx` — Dispatches to type-specific node components. Groups render first (lower z-index).
- `src/components/TextNode.tsx`, `FileNode.tsx`, `LinkNode.tsx`, `GroupNode.tsx` — One component per JSON Canvas node type.
- `src/components/EdgeRenderer.tsx` — Renders all edges with arrowhead markers, labels, and click targets.
- `src/components/Breadcrumbs.tsx` — Navigation breadcrumb trail overlay.
- `src/hooks/useViewport.ts` — d3-zoom integration, fit-to-content.
- `src/hooks/useNavigation.ts` — Canvas stack, ref resolution, breadcrumb state management.
- `src/hooks/useCanvasInteraction.ts` — Click, double-click, and context menu handler wiring.

## Key concepts

### JSON Canvas spec extensions

We extend the [JSON Canvas spec](https://jsoncanvas.org) with two optional fields on nodes:

- **`ref`** (string) — A URI pointing to a sub-canvas. Any node type can have a ref. Nodes with refs are "navigable" — clicking them loads the referenced canvas via the `onResolveCanvas` callback.
- **`category`** (string) — Maps to a `CategoryDefinition` in the theme. Provides default width, height, fill, stroke, corner radius, and icon. When `category` is set, `width` and `height` become optional.

### Navigation model

Navigation is discrete, not continuous zoom. Clicking a navigable node pushes a new canvas onto a breadcrumb stack. The library calls `onResolveCanvas(ref)` to fetch the sub-canvas data. Breadcrumbs allow navigating back up.

### Theme system

Themes are plain objects implementing `CanvasTheme`. They control every visual aspect: background, grid, node styles, edge styles, group styles, breadcrumb styles, preset color mappings ("1"-"6"), and category definitions.

Resolution order for node visuals:
1. Explicit node properties (`color`, `width`, `height`) — highest priority
2. Category defaults from theme — fallback when node properties are absent
3. Base theme defaults — final fallback

### Rendering technique

Nodes use the **double-rect technique**: an opaque backer rectangle (matching the background color) is drawn first, then a semi-transparent styled rectangle on top. This prevents edges from bleeding through transparent node fills. Edges are rendered before nodes in SVG order (painter's model) so they appear behind.

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
