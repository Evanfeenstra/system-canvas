# Plan: Custom Node Renderers & Rich Content

Status: DRAFT — companion to `editable-canvas.md`. Review before implementing.

## Goal

Let consumers render nodes with arbitrary rich content — kicker labels, status badges, accent strips, progress bars, notification pips, big numbers — while keeping the library's layout, zoom, edge routing, and interaction model intact.

Reference: `/Users/evanfeenstra/Desktop/Screenshot-graphy.png`. That screenshot has ~6 distinct category layouts (vision, team, initiative, note, decision, customer, revenue), all sharing common visual primitives.

---

## Architectural decisions (confirmed)

- **Arbitrary data:** add `data?: Record<string, unknown>` to `CanvasNode`. Opaque to the library; typed by consumer.
- **Renderer plug-in:** `nodeRenderers` prop mapping category/type → React component. Built-ins used as fallback.
- **Output format:** SVG by default. Library exports a `<NodeHtml>` helper (wraps `<foreignObject>`) for consumers who want HTML/CSS layouts.
- **Primitives:** library ships reusable SVG primitives (`<NodeCard>`, `<NodeKicker>`, `<NodeBadge>`, `<NodeAccentStrip>`, `<NodeDot>`, `<NodeNotificationPip>`, `<NodeProgressBar>`).
- **Rich-content editing:** category declares an `editableFields` schema; library renders a generic form editor over the node on double-click.
- **Standalone from `editable-canvas.md`:** two plans, ship in either order, no blocking dependency.

---

## Data model change: `CanvasNode.data`

```ts
// packages/core/src/types.ts
export interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  // ... existing optional fields ...

  /** Opaque, consumer-defined data. Preserves JSON Canvas compatibility (unknown fields). */
  data?: Record<string, unknown>
}
```

For type safety on the consumer side, we'll export a generic helper:

```ts
// packages/core/src/types.ts
export type TypedCanvasNode<D extends Record<string, unknown> = Record<string, unknown>> =
  Omit<CanvasNode, 'data'> & { data?: D }
```

Consumers can define their own typed node:

```ts
type InitiativeData = {
  kicker?: string
  status: 'ok' | 'attn' | 'risk'
  percent: number
  blockers: number
  notifications?: number
}

type InitiativeNode = TypedCanvasNode<InitiativeData>
```

No changes required to `ResolvedNode` — it already extends `CanvasNode` and inherits `data`.

### Why `data` and not top-level fields

- JSON Canvas spec tolerates unknown fields; namespacing under `data` keeps our additions tidy.
- Keeps node rendering logic from ballooning the `CanvasNode` interface with every consumer's custom fields.
- Editor schema can address sub-fields with a `data.` prefix.

---

## Renderer plug-in API

### `NodeRenderer` component contract

```ts
// packages/react/src/types.ts (new file, or added to core if types-only)
export interface NodeRendererProps {
  node: ResolvedNode
  theme: CanvasTheme
  /** True if this node is currently selected (editable mode). */
  isSelected?: boolean
  /** True if the inline editor is open on this node. */
  isEditing?: boolean
  /** True if the node is currently being dragged. */
  isDragging?: boolean
  onClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onDoubleClick: (node: ResolvedNode, event: React.MouseEvent) => void
  onContextMenu: (node: ResolvedNode, event: React.MouseEvent) => void
  /** Only present in editable mode. */
  onPointerDown?: (node: ResolvedNode, event: React.PointerEvent) => void
}

export type NodeRendererComponent = React.ComponentType<NodeRendererProps>
```

### `nodeRenderers` prop on `SystemCanvas`

```ts
interface SystemCanvasProps {
  // ...
  /**
   * Override node rendering per category or per base type.
   * Keys can be category names (e.g. 'initiative', 'customer') or one of the
   * four base types ('text', 'file', 'link', 'group'). Category matches take
   * priority over type matches.
   */
  nodeRenderers?: Record<string, NodeRendererComponent>
}
```

### Resolution order (per node)

1. `nodeRenderers[node.category]` if `node.category` is set
2. `nodeRenderers[node.type]`
3. built-in component for `node.type` (current `TextNode` / `FileNode` / `LinkNode` / `GroupNode`)

`NodeRenderer.tsx` (library internal) does this dispatch. Groups still render first in z-order regardless of renderer.

### Fallback behavior

If a custom renderer throws or returns nothing, we do **not** silently drop the node. Fall back to the built-in. (Wrap in a try/catch only in dev mode; production catches nothing to keep the hot path fast.)

---

## SVG primitives (`packages/react/src/primitives/`)

Small presentational components consumers compose to build node renderers. All accept positioning + theme-driven styling. All are pure SVG.

### `<NodeCard>` — chrome wrapper

The opaque-backer + styled-rect + selection-outline pattern. Every node renderer that wants the standard card look starts with this.

```ts
interface NodeCardProps {
  node: ResolvedNode
  theme: CanvasTheme
  isSelected?: boolean
  /** Color of the accent strip along the top (optional). */
  accentColor?: string
  /** Accent strip thickness in px. Default 2. */
  accentHeight?: number
  /** Override fill (default: node.resolvedFill). */
  fill?: string
  /** Override stroke (default: node.resolvedStroke). */
  stroke?: string
  children?: React.ReactNode
}
```

Handles the double-rect (backer + overlay) and the selection outline. Consumer renders kicker/title/badges as children.

### `<NodeKicker>` — small caps label

```ts
interface NodeKickerProps {
  x: number
  y: number
  text: string
  color?: string
  /** Default: 9 */
  fontSize?: number
}
```

Renders uppercase, letter-spaced, muted-color text. Matches the "12-MONTH VISION" / "NOTE" / "CUSTOMER" labels in the screenshot.

### `<NodeBadge>` — status pill

```ts
interface NodeBadgeProps {
  x: number
  y: number
  text: string
  /** Background color; text color derived from it. */
  color: string
  /** 'right' aligns the badge's right edge to x. Default 'left'. */
  align?: 'left' | 'right'
}
```

Rounded pill with uppercase text. "OK" / "ATTN" / "RISK" style.

### `<NodeAccentStrip>` — top color bar

```ts
interface NodeAccentStripProps {
  node: ResolvedNode
  color: string
  height?: number // default 2
}
```

Renders a thin colored rect along the top of the node (matching `resolvedCornerRadius`). Technically just a helper over `<NodeCard accentColor>`; still useful when consumer skips NodeCard.

### `<NodeDot>` — status dot

```ts
interface NodeDotProps {
  cx: number
  cy: number
  color: string
  /** Default 4 */
  radius?: number
}
```

The small colored circle in "hive" / "bounty-platform" team nodes.

### `<NodeNotificationPip>` — count badge

```ts
interface NodeNotificationPipProps {
  cx: number
  cy: number
  count: number
  color?: string
  textColor?: string
}
```

The red circle with "4" in the top-right of "V2 Platform Migration". Auto-sizes to fit 1-2 digit counts; shows "9+" for larger.

### `<NodeProgressBar>` — inline progress

```ts
interface NodeProgressBarProps {
  x: number
  y: number
  width: number
  percent: number // 0-100
  color?: string
  trackColor?: string
  height?: number // default 3
}
```

Thin bar for initiative-style nodes.

### `<NodeHtml>` — escape hatch to HTML

```ts
interface NodeHtmlProps {
  node: ResolvedNode
  /** Content padding in px. Default 12. */
  padding?: number
  children: React.ReactNode
}
```

Wraps children in a `<foreignObject>` sized to the node. Sets `xmlns="http://www.w3.org/1999/xhtml"`. Consumer writes normal JSX / CSS / Tailwind inside.

**Caveats documented:**
- Blurriness at zoom > ~3x in some browsers.
- Safari needs explicit `width`/`height` attrs (already handled).
- Event bubbling works; drag and click handlers on the parent `<g>` still fire unless children `stopPropagation`.
- `pointerEvents` on the root `<foreignObject>` defaults to `none`; children opt-in with `pointerEvents: 'auto'`. This mirrors how the built-in nodes use `pointerEvents="none"` on `<text>`.

### Primitive theme

Primitives read from a new `theme.primitives` slot so consumers can restyle them globally:

```ts
// packages/core/src/types.ts
export interface PrimitivesTheme {
  kicker: {
    color: string
    fontSize: number
    letterSpacing: number
    fontWeight: number
  }
  badge: {
    fontSize: number
    paddingX: number
    paddingY: number
    borderRadius: number
  }
  dot: {
    defaultRadius: number
  }
  notificationPip: {
    background: string
    textColor: string
    fontSize: number
  }
  progressBar: {
    trackColor: string
    height: number
  }
}

interface CanvasTheme {
  // ...
  primitives: PrimitivesTheme
}
```

All built-in themes get reasonable defaults. `resolveTheme` merges `primitives` like the other slots.

---

## Worked example: the screenshot

Consumer code to reproduce the "initiative" node style from the screenshot:

```tsx
// consumer app
import {
  NodeCard, NodeKicker, NodeBadge, NodeNotificationPip,
  NodeProgressBar,
} from 'system-canvas-react/primitives'
import type { NodeRendererComponent } from 'system-canvas-react'

const statusColors = { ok: '#10b981', attn: '#f59e0b', risk: '#ef4444' }

const InitiativeNode: NodeRendererComponent = ({ node, theme, isSelected, onClick, onDoubleClick, onContextMenu, onPointerDown }) => {
  const data = node.data as {
    title: string
    status: 'ok' | 'attn' | 'risk'
    percent: number
    blockers: number
    notifications?: number
  }
  const accent = statusColors[data.status]

  return (
    <g
      onClick={e => onClick(node, e)}
      onDoubleClick={e => onDoubleClick(node, e)}
      onContextMenu={e => onContextMenu(node, e)}
      onPointerDown={onPointerDown && (e => onPointerDown(node, e))}
      style={{ cursor: 'pointer' }}
    >
      <NodeCard node={node} theme={theme} isSelected={isSelected} accentColor={accent}>
        <text x={node.x + 14} y={node.y + 28} fill={theme.node.labelColor} fontSize={13} fontWeight={600} fontFamily={theme.node.fontFamily}>
          {data.title}
        </text>
        <NodeBadge x={node.x + node.width - 10} y={node.y + 18} text={data.status.toUpperCase()} color={accent} align="right" />
        <text x={node.x + 14} y={node.y + node.height - 14} fill={theme.node.sublabelColor} fontSize={11} fontFamily={theme.node.fontFamily}>
          {data.percent}%  <tspan fill={accent}>{data.blockers} blockers</tspan>
        </text>
      </NodeCard>
      {data.notifications && <NodeNotificationPip cx={node.x + node.width} cy={node.y} count={data.notifications} />}
    </g>
  )
}

// ...later
<SystemCanvas
  canvas={canvas}
  nodeRenderers={{ initiative: InitiativeNode, team: TeamNode, /* ... */ }}
/>
```

About 30 lines per custom renderer, most of which is the layout math the consumer controls. The library handles zoom, edges, selection, drag, edit.

---

## Rich-content editing: `editableFields` schema

For custom nodes with arbitrary `data` fields, the built-in inline editor (from `editable-canvas.md`) only knows about `text` / `file` / `url` / `label`. To edit `data.status`, `data.percent`, etc., we let categories declare an editing schema.

### Schema definition

Added to `CategoryDefinition`:

```ts
// packages/core/src/types.ts
export type EditableFieldKind = 'text' | 'textarea' | 'number' | 'select' | 'boolean'

export interface EditableField {
  /** Dot-path to the value. 'title' edits node.title; 'data.status' edits node.data.status. */
  path: string
  kind: EditableFieldKind
  label?: string
  /** For kind='select' */
  options?: Array<{ value: string; label?: string }>
  /** For kind='number' */
  min?: number
  max?: number
  step?: number
  /** Placeholder text for text/textarea. */
  placeholder?: string
}

interface CategoryDefinition {
  // ... existing ...
  /**
   * Fields the built-in editor can edit for nodes of this category.
   * If absent, the editor falls back to editing the base text field for
   * the node's type (node.text / node.file / node.url / node.label).
   */
  editableFields?: EditableField[]
}
```

Example for the initiative category:

```ts
{
  defaultWidth: 220,
  defaultHeight: 70,
  fill: '...',
  stroke: '...',
  editableFields: [
    { path: 'data.title', kind: 'text', label: 'Title' },
    { path: 'data.status', kind: 'select', options: [
      { value: 'ok', label: 'OK' },
      { value: 'attn', label: 'Attention' },
      { value: 'risk', label: 'Risk' },
    ]},
    { path: 'data.percent', kind: 'number', min: 0, max: 100, step: 1 },
    { path: 'data.blockers', kind: 'number', min: 0 },
  ],
}
```

### Editor UI

The `NodeEditor` component (from `editable-canvas.md`) upgrades:

- If the node's category has `editableFields`, render a small form panel (HTML via `foreignObject`) with one row per field. Rows use native `<input>` / `<textarea>` / `<select>`. First field autofocuses.
- If no `editableFields`, fall back to the single-field editor described in `editable-canvas.md`.
- Commit on blur of the whole panel (i.e. focus leaves all fields) or on `Cmd/Ctrl+Enter`. `Escape` cancels. `Enter` moves to next field.
- On commit, produce a patch by setting each changed path and fire a single `onNodeUpdate(id, patch, canvasRef)`. For `data.foo`, the patch contains `{ data: { ...node.data, foo: newValue } }` so the consumer's shallow merge works.

### Patch shape note

`onNodeUpdate` patches are already `Partial<CanvasNode>`, which includes `data?: Record<string, unknown>`. The editor takes care to produce a *fully formed* `data` object when any `data.*` path changes, so consumers can do the trivial `{...node, ...patch}` merge without losing other `data` fields.

---

## Add-node menu + `data` initialization

The FAB (`editable-canvas.md`) creates new nodes via `createNodeFromOption`. That helper needs to produce a sensible default `data` object for categories that use it.

### Extension

`CategoryDefinition` gains:

```ts
{
  /** Default data object for new nodes created in this category. */
  defaultData?: Record<string, unknown>
}
```

`createNodeFromOption` copies `defaultData` onto the new node. The editor (with its schema) can then fill in real values.

---

## Interactions with `editable-canvas.md`

These two plans overlap at:

- `NodeEditor` — the rich-editing variant supersedes the single-field variant; implement in this order:
  1. Ship single-field editor first (from `editable-canvas.md`).
  2. Later, detect `editableFields` on category and switch to form editor.
- `nodeRenderers` — the built-in `NodeRenderer.tsx` dispatch grows a lookup step before falling back to built-ins.
- Drag + selection + ref indicators — custom renderers have to render their own ref indicator and handle their own `onPointerDown` wiring; `<NodeCard>` handles selection outline automatically. Ref indicator is a consumer concern (or we ship `<NodeRefIndicator>` as another primitive).

Add `<NodeRefIndicator>` to the primitives list.

---

## Changes by file

### `packages/core/src/types.ts`

- Add `data?: Record<string, unknown>` to `CanvasNode`.
- Add `TypedCanvasNode<D>` generic.
- Add `PrimitivesTheme`; add `primitives: PrimitivesTheme` to `CanvasTheme`.
- Add `EditableFieldKind`, `EditableField`, extend `CategoryDefinition` with `editableFields?` and `defaultData?`.

### `packages/core/src/themes/*.ts`

- Add `primitives` slot to all 5 built-in themes with sane defaults.

### `packages/core/src/themes/resolve.ts`

- Merge `primitives` in `resolveTheme` like other slots.

### `packages/core/src/canvas.ts`

- `createNodeFromOption` copies `category.defaultData` when creating a categorized node.
- Export a small utility `getAtPath(obj, 'data.status')` / `setAtPath(obj, 'data.status', v)` for the editor and consumer convenience. (Dependency-free; <20 lines.)

### `packages/react/src/primitives/` (new directory)

- `NodeCard.tsx`
- `NodeKicker.tsx`
- `NodeBadge.tsx`
- `NodeAccentStrip.tsx`
- `NodeDot.tsx`
- `NodeNotificationPip.tsx`
- `NodeProgressBar.tsx`
- `NodeRefIndicator.tsx`
- `NodeHtml.tsx`
- `index.ts` — barrel export.

### `packages/react/src/components/NodeRenderer.tsx`

- Add `nodeRenderers?: Record<string, NodeRendererComponent>` prop, thread from `SystemCanvas`.
- Lookup order: `nodeRenderers[node.category]` → `nodeRenderers[node.type]` → built-in.

### `packages/react/src/components/SystemCanvas.tsx`

- Add `nodeRenderers` prop; pass through.

### `packages/react/src/components/NodeEditor.tsx` (from `editable-canvas.md`)

- Upgraded to read `editableFields` from category, render a form when present.
- `getAtPath`/`setAtPath` imported from core.

### `packages/react/src/index.ts`

- Export `NodeRendererComponent`, `NodeRendererProps`.
- Export all primitives (with a secondary entry point `system-canvas-react/primitives` for tree-shaking).

### `packages/react/package.json`

- Add a secondary export entry:

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./primitives": { "types": "./dist/primitives/index.d.ts", "import": "./dist/primitives/index.js" }
}
```

### `demo/src/main.tsx` + `demo/src/data.ts`

- Add a third "rich" demo canvas mirroring the screenshot, with 6 categories and custom renderers. Keep the existing demo canvases for the basic case.

---

## Edge cases & open questions

1. **Primitives read theme; theme primitives are optional initially.** Built-in themes gain defaults. Consumer-provided partial themes get merged, so missing slots fall back. `resolveTheme` update is mandatory.

2. **Custom renderer + drag.** Consumer's `<g>` must wire `onPointerDown` manually. Document this; `<NodeCard>` cannot do it because the drag handler lives on the node group. If we wanted to hide it, we'd need `<NodeCard>` to render its own `<g>` and receive all the handlers — doable but opinionated. **Proposal: `<NodeCard>` accepts and forwards all interaction handlers (`onClick`, `onDoubleClick`, `onContextMenu`, `onPointerDown`), wrapping in its own `<g>`. Consumer skips the outer `<g>` when using `<NodeCard>`.** Simpler ergonomics.

3. **Custom renderer + editing.** On double-click, library opens editor; custom renderer stays mounted behind. Selection outline appears through `<NodeCard isSelected>`. If consumer doesn't use `<NodeCard>`, they render their own selection state from `isSelected` prop.

4. **Ref indicator.** Existing built-ins render a chevron in the corner for `isNavigable`. Custom renderers must render it themselves. Ship `<NodeRefIndicator>` primitive to make this trivial.

5. **Resizing.** Out of scope; both plans.

6. **Typed `data`.** Consumer's problem. We expose `TypedCanvasNode<D>` and examples; don't try to thread generics through the library itself.

7. **Editing a `data.*` field vs replacing `data`.** Editor builds patches that include a full `data` object (merged from current node plus changed keys) to avoid consumer-side shallow-merge bugs.

8. **HTML escape hatch and zoom blur.** Known tradeoff. Document; don't solve.

9. **Category type mismatch.** If `category.type` says 'group' but the consumer puts a renderer under that category that returns a text-like shape, visuals will work but spatial group semantics (rendered-behind-others) won't. Document: category type still controls z-order via `NodeRenderer.tsx`'s filter.

10. **Backwards compat.** Existing consumers: their canvases render unchanged because `nodeRenderers` defaults to empty, `data` is optional, `editableFields` is optional, `primitives` theme gets defaults. No breaking changes.

---

## Verification

- `npm run typecheck` — must pass.
- `npm run build` — must succeed.
- `npm run dev` — manual smoke test of the rich demo canvas:
  - All 6 categories render with their custom layouts.
  - Pan/zoom works; edges route to the visually correct anchors.
  - Selecting a node shows outline.
  - Double-clicking opens the form editor for categories with `editableFields`, single-field editor otherwise.
  - Drag works on custom-rendered nodes.
  - Add-node FAB creates a node of the right category with `defaultData` seeded.
  - Existing basic demo (non-rich) still works.

---

## Implementation order

1. **Data model**: add `data` field, `TypedCanvasNode`, `PrimitivesTheme`, `editableFields` / `defaultData` on `CategoryDefinition`. Typecheck passes with no behavior change.
2. **Primitives package**: `NodeCard` + `NodeKicker` + `NodeBadge` + `NodeAccentStrip` + `NodeDot` + `NodeNotificationPip` + `NodeProgressBar` + `NodeRefIndicator` + `NodeHtml`. Secondary export. All built-in themes get `primitives` defaults.
3. **`nodeRenderers` prop + dispatch**: thread through `SystemCanvas` → `NodeRenderer`. Verify existing demo unchanged with no renderers passed.
4. **Rich demo canvas**: add to `demo/`, implement the 6 category renderers using primitives. Verify visuals match screenshot direction.
5. **Form editor (depends on `editable-canvas.md` shipping the single-field editor first)**: extend `NodeEditor` to read `editableFields` and render a form. Wire `getAtPath`/`setAtPath`.
6. **`createNodeFromOption` uses `defaultData`**: verify the FAB seeds sensible state for rich categories.
7. Typecheck + build + smoke test.

---

## Out of scope

- Resizing nodes (handles).
- Drag-to-reorder category list in the FAB.
- Schema-driven node validation.
- Rich-text editing inside node body (markdown, etc.).
- Styling consumer forms (editor uses native form controls; consumers can ship CSS).
- Custom edge renderers (different plan).
- Per-node render overrides keyed on `node.id` (only per category/type for v1).
