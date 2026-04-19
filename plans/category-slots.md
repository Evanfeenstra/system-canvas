# Plan: Category Slots — Unified Composition for Node Visuals, Overlays, Toolbars, and Editing

Status: DRAFT — supersedes `custom-renderers.md` and `derived-overlays.md`. Review before implementing.

## Goal

Make **category** the single unit of composition for a node's identity. A category already controls default width, height, fill, stroke, corner radius, icon, and the base JSON Canvas type. This plan extends it with three orthogonal slots:

- `slots` — declarative visual add-ons (accent strip, kicker, badge, bottom bar, status dot) rendered by the library in library-owned regions.
- `toolbar` — per-category override of the node toolbar actions.
- `editableFields` — per-category form schema for the inline editor.

All three are optional. All three are additive. None change existing behavior when absent.

The declarative slot system covers the overwhelming majority of rich-node use cases (progress bars from sub-canvas rollups, status badges, count pips, kicker labels, accent strips) with one-line category entries. An escape hatch (`kind: 'custom'`) lets a consumer draw arbitrary SVG inside one slot when the declarative kinds aren't enough — the library still owns positioning, text reflow, paint order, and ref-indicator collision.

This replaces two earlier plans:

- `custom-renderers.md` — full node renderer replacement with a primitives library. Too big a surface area; overlaps with toolbar and editor work; makes category less central.
- `derived-overlays.md` — `renderNodeOverlay` render prop. Correct idea, wrong shape — pulls logic out of category into a global prop.

---

## Architectural decisions (confirmed)

- **Category is the extension point.** `category.slots`, `category.toolbar`, `category.editableFields` live alongside the existing visual defaults. One place to answer "what kind of thing is this node."
- **Slots are declarative by default.** Each slot has a `kind` (`'progress' | 'count' | 'text' | 'dot' | 'custom'`). Library ships the rendering for each kind. No bounds math for consumers.
- **Accessors let slot values be static or derived.** `value: number | ((ctx) => number)`. The function form receives `{ node, theme, getSubCanvas, canvases, rollup }` — enough to express "fraction of children with `customData.status === 'done'`" in one line.
- **Regions are library-owned.** `accentStrip` (top edge), `kicker` (above title), `badge` (top-right 20×20), `bottomBar` (bottom edge strip), `statusDot` (corner). Library auto-reflows node text when `bottomBar` or `kicker` is occupied, auto-moves group-node ref indicators when `badge` is occupied.
- **Primitives are an internal detail, re-exported for `kind: 'custom'`.** The library renders declarative slots using `<NodeProgressBar>`, `<NodeCountBadge>`, `<NodeAccentStrip>`, `<NodeKicker>`, `<NodeDot>` internally. These are also exported from `system-canvas-react/primitives` so custom-slot render functions can reuse them.
- **No `nodeRenderers` prop. No `renderNodeOverlay` prop.** Both are removed from the roadmap. Everything flows through category slots. If a consumer truly needs to replace a whole node shape, they wrap the canvas or use a `kind: 'custom'` slot that fills the `full` region.
- **`toolbar` at category level falls through to `theme.nodeActions` when absent.** Same resolution pattern as visual defaults.
- **`editableFields` at category level falls through to the single-field editor** (text for text nodes, file for file nodes, etc.).
- **Data lives in `customData`.** Already exists on `CanvasNode`. No new blessed `data` field. Accessors can read from anywhere on the node.
- **Rollups are first-class.** `ctx.rollup(ref, predicate)` is exposed inside slot accessors as a convenience wrapper over `rollupNodes(getSubCanvas(ref), predicate)`.
- **No caching in the library.** Accessors run at render. Consumers wrap expensive predicates in `useMemo` if they care.
- **No breaking changes.** All new fields are optional. Existing consumers see zero behavioral change until they add `slots` / `toolbar` / `editableFields` to a category.

---

## Data model

### `CanvasNode`

Unchanged. `customData?: Record<string, any>` and `ref?: string` remain the primitives slot accessors compose over.

### `CategoryDefinition`

Additive:

```ts
// packages/core/src/types.ts
export interface CategoryDefinition {
  // ...existing fields (defaultWidth, defaultHeight, fill, stroke, icon, type, etc.)

  /** Declarative visual add-ons rendered in library-owned regions. */
  slots?: CategorySlots

  /** Per-category toolbar override. Falls through to theme.nodeActions when absent. */
  toolbar?: NodeActionGroup[]

  /** Per-category inline editor schema. Falls through to single-field editor when absent. */
  editableFields?: EditableField[]

  /** Seed customData for new nodes created from this category via the add-node menu. */
  defaultCustomData?: Record<string, unknown>
}

export interface CategorySlots {
  accentStrip?: SlotSpec
  kicker?: SlotSpec
  badge?: SlotSpec
  bottomBar?: SlotSpec
  statusDot?: SlotSpec
}

export type SlotSpec =
  | ProgressSlot
  | CountSlot
  | TextSlot
  | DotSlot
  | CustomSlot

export interface ProgressSlot {
  kind: 'progress'
  /** 0..1. Clamped by the renderer. */
  value: NodeAccessor<number>
  color?: NodeAccessor<string>
  bgColor?: NodeAccessor<string>
}

export interface CountSlot {
  kind: 'count'
  value: NodeAccessor<number | string>
  color?: NodeAccessor<string>
  textColor?: NodeAccessor<string>
  /** When value resolves to 0/empty, hide the badge. Default true. */
  hideWhenEmpty?: boolean
}

export interface TextSlot {
  kind: 'text'
  value: NodeAccessor<string>
  color?: NodeAccessor<string>
}

export interface DotSlot {
  kind: 'dot'
  color: NodeAccessor<string>
}

export interface CustomSlot {
  kind: 'custom'
  render: (ctx: SlotContext) => React.ReactNode
}

export type NodeAccessor<T> = T | ((ctx: SlotContext) => T)

export interface SlotContext {
  node: ResolvedNode
  theme: CanvasTheme
  /** The region rect this slot is rendering into (canvas-space). */
  region: Rect
  /** Resolve a sub-canvas by ref; combines synchronous canvases map + async cache. */
  getSubCanvas: (ref: string) => CanvasData | undefined
  canvases?: Record<string, CanvasData>
  /** Shorthand: rollupNodes(getSubCanvas(ref), predicate). Returns RollupResult. */
  rollup: (ref: string | undefined, predicate: (n: CanvasNode) => boolean) => RollupResult
}
```

### `EditableField` (from `custom-renderers.md`)

Kept as specified there:

```ts
export type EditableFieldKind = 'text' | 'textarea' | 'number' | 'select' | 'boolean'

export interface EditableField {
  /** Dot-path. 'text' / 'label' / 'file' / 'url' / 'customData.status'. */
  path: string
  kind: EditableFieldKind
  label?: string
  options?: Array<{ value: string; label?: string }>
  min?: number
  max?: number
  step?: number
  placeholder?: string
}
```

### `RollupResult` + rollup helpers (from `derived-overlays.md`)

Kept as specified there: new file `packages/core/src/rollup.ts` with `rollupNodes`, `rollupNodesDeep`, `RollupResult`. Unchanged from the earlier plan.

---

## Regions

Library pre-computes these in canvas-space per node. Consumer slot code never does bounds math.

| Region        | Position                                          | Size                                          |
|---------------|---------------------------------------------------|-----------------------------------------------|
| `full`        | `{ node.x, node.y }`                              | `{ node.width, node.height }`                 |
| `accentStrip` | `{ node.x, node.y }`                              | `{ node.width, accentHeight }` (default 2px)  |
| `kicker`      | Above title, inset 12px                           | `{ node.width − 24, kickerHeight }` (~14px)   |
| `badge`       | Top-right, 6px inset from edges                   | `{ 20, 20 }`                                  |
| `bottomBar`   | `{ node.x, node.y + node.height − barHeight }`    | `{ node.width, max(6, height * 0.08) }`       |
| `statusDot`   | Inside node, 10px inset top-left                  | `{ 8, 8 }`                                    |

Computed by a pure function `computeCategorySlotRegions(node, theme)` in core, used by both the renderer and (optionally) consumer `custom` slot code.

---

## Rendering flow

In `NodeRenderer.tsx`:

1. Resolve the node; look up the category.
2. Compute regions.
3. For each defined slot, resolve accessors against `SlotContext` and render the appropriate primitive (or call `render` for `custom`).
4. Determine reflow flags from which slots are occupied:
   - `kicker` present → shift title/body text down by kicker height.
   - `bottomBar` present → shrink text vertical center by bottom bar height.
   - `badge` present on a group node → move ref indicator to bottom-right.
5. Render node body, text, slots, ref indicator, resize handles in this paint order:

```
groups → edges → non-group nodes → kicker → accentStrip → bottomBar → badge/statusDot → refIndicator → resizeHandles
```

Slots live inside a `pointerEvents="none"` wrapper so they never intercept clicks meant for the node body. `custom` slots can re-enable `pointerEvents: 'auto'` on inner elements if they want interactivity.

---

## Toolbar resolution

Today `NodeToolbar.tsx` calls `getNodeActions(theme)`. Extend to a per-node resolver:

```ts
// packages/core/src/actions.ts
export function getNodeActionsForNode(
  node: CanvasNode,
  theme: CanvasTheme
): NodeActionGroup[] {
  const category = node.category ? theme.categories?.[node.category] : undefined
  if (category?.toolbar && category.toolbar.length > 0) return category.toolbar
  return getNodeActions(theme)
}
```

`NodeToolbar` swaps the call site. No other changes.

Because `NodeAction.patch` already supports `(node) => NodeUpdate`, a category can define a toolbar that switches the node to a different category — e.g. a `buttons`-kind group whose actions return `{ category: 'milestone' }` / `{ category: 'blocker' }`. This is the "change category from the toolbar" pattern; it needs zero new machinery.

---

## Editor resolution

`NodeEditor` grows a branch:

1. If `node.category` resolves to a category with `editableFields`, render the form editor.
2. Otherwise, render the current single-field editor (text for text nodes, file for file, etc.).

The form editor uses `getAtPath` / `setAtPath` utilities (new in core, <20 lines, dependency-free) to read and write nested fields like `customData.status`. On commit it builds a single patch that includes a fully-formed `customData` object (merged from the current node) so consumers can shallow-merge without losing sibling keys.

---

## `createNodeFromOption` + `defaultCustomData`

When the add-node FAB creates a node for a category that has `defaultCustomData`, the helper copies it onto the new node's `customData`. Pairs with `editableFields` so a newly-created categorized node opens an editor with sensible defaults already populated.

---

## Worked example: roadmap phase with progress

A phase node whose sub-canvas contains initiatives, each with `customData.status`:

```ts
const isDone = (n: CanvasNode) => n.customData?.status === 'done'

const roadmapTheme: CanvasTheme = {
  // ...
  categories: {
    phase: {
      type: 'group',
      defaultWidth: 320, defaultHeight: 180,
      fill: '...', stroke: '...',
      slots: {
        kicker: { kind: 'text', value: 'PHASE' },
        badge: {
          kind: 'count',
          value: ({ node, rollup }) => {
            const r = rollup(node.ref, isDone)
            return r.total === 0 ? '' : `${r.matched}/${r.total}`
          },
          color: '#4ade80',
        },
        bottomBar: {
          kind: 'progress',
          value: ({ node, rollup }) => rollup(node.ref, isDone).fraction,
          color: '#4ade80',
          bgColor: 'rgba(255,255,255,0.08)',
        },
      },
      toolbar: [
        { id: 'color', kind: 'swatches', actions: [/* ... */] },
      ],
      editableFields: [
        { path: 'label', kind: 'text', label: 'Phase' },
      ],
    },

    initiative: {
      type: 'text',
      defaultWidth: 220, defaultHeight: 64,
      fill: '...', stroke: '...',
      slots: {
        accentStrip: {
          kind: 'custom',
          render: ({ node, region }) => {
            const status = node.customData?.status
            const color = status === 'done' ? '#4ade80' : status === 'risk' ? '#ef4444' : '#f59e0b'
            return <rect x={region.x} y={region.y} width={region.width} height={region.height} fill={color} />
          },
        },
        statusDot: {
          kind: 'dot',
          color: ({ node }) => ({
            done: '#4ade80', risk: '#ef4444', attn: '#f59e0b',
          }[node.customData?.status as string] ?? '#6b7280'),
        },
      },
      toolbar: [{
        id: 'status',
        kind: 'buttons',
        actions: [
          { id: 'set-ok',   label: 'OK',   icon: '...', patch: { customData: { status: 'done' } } },
          { id: 'set-attn', label: 'Attn', icon: '...', patch: { customData: { status: 'attn' } } },
          { id: 'set-risk', label: 'Risk', icon: '...', patch: { customData: { status: 'risk' } } },
        ],
      }],
      editableFields: [
        { path: 'text', kind: 'text', label: 'Title' },
        { path: 'customData.status', kind: 'select', options: [
          { value: 'done', label: 'Done' },
          { value: 'attn', label: 'Attention' },
          { value: 'risk', label: 'Risk' },
        ]},
      ],
      defaultCustomData: { status: 'attn' },
    },
  },
}
```

Result: the phase node shows `"3/5"` in the top-right and a 60% progress bar along the bottom. The initiative nodes show a colored accent strip at the top and a status dot, have a three-button status toolbar, and a two-field form editor. All from declarative category config. Zero render props on `SystemCanvas`.

---

## Changes by file

### `packages/core/src/types.ts`

- Extend `CategoryDefinition` with `slots?`, `toolbar?`, `editableFields?`, `defaultCustomData?`.
- Add `CategorySlots`, `SlotSpec`, `ProgressSlot`, `CountSlot`, `TextSlot`, `DotSlot`, `CustomSlot`, `NodeAccessor<T>`, `SlotContext`, `EditableField`, `EditableFieldKind`.
- Add `Rect` if not already exported (for `SlotContext.region`).

### `packages/core/src/rollup.ts` (new)

- `rollupNodes`, `rollupNodesDeep`, `RollupResult`. As specified in `derived-overlays.md` §Core.

### `packages/core/src/slots.ts` (new)

- `computeCategorySlotRegions(node, theme): Record<SlotName, Rect>` — pure geometry.
- `resolveAccessor<T>(accessor, ctx): T` — helper to call or return the accessor.
- `getCategorySlots(node, theme): CategorySlots | undefined` — lookup.

### `packages/core/src/actions.ts`

- Add `getNodeActionsForNode(node, theme)` that checks `category.toolbar` first, falls back to `getNodeActions(theme)`.

### `packages/core/src/canvas.ts`

- `createNodeFromOption` copies `category.defaultCustomData` onto `customData` of the new node.
- Add `getAtPath(obj, path)` / `setAtPath(obj, path, v)` utilities.

### `packages/core/src/index.ts`

- Export new helpers, types, and rollup.

### `packages/react/src/components/NodeRenderer.tsx`

- After rendering node body/text, resolve category slots and render them.
- Pass `reservedTop` (for `kicker`) and `reservedBottom` (for `bottomBar`) to the node component.
- Move ref indicator to bottom-right for groups when `badge` slot is present.

### `packages/react/src/components/TextNode.tsx`, `FileNode.tsx`, `LinkNode.tsx`, `GroupNode.tsx`

- Accept optional `reservedTop?: number` / `reservedBottom?: number`. Subtract from inner layout when centering text.

### `packages/react/src/components/NodeToolbar.tsx`

- Swap `getNodeActions(theme)` for `getNodeActionsForNode(node, theme)`.

### `packages/react/src/components/NodeEditor.tsx`

- Detect `category.editableFields`; render form editor when present, single-field editor otherwise.
- Use core's `getAtPath` / `setAtPath` to read/write field values; build a merged `customData` on commit.

### `packages/react/src/primitives/` (new)

- `NodeProgressBar.tsx`, `NodeCountBadge.tsx`, `NodeAccentStrip.tsx`, `NodeKicker.tsx`, `NodeDot.tsx`.
- Used internally by the slot renderer. Re-exported from a secondary entry point for `kind: 'custom'` slot implementations.

### `packages/react/src/index.ts` + `package.json`

- Add `./primitives` secondary export.

### `demo/`

- Roadmap demo canvas uses `category.slots` to show the worked example above.
- Remove any prior scaffolding for `renderNodeOverlay` / `nodeRenderers` if those crept in.

---

## Interaction with existing features

- **Lanes**: independent. A node can be in a lane and also have slots.
- **Drag / resize**: slots are `pointerEvents="none"`, so drags still originate from the node body. Resize handles paint above slots.
- **Selection outline**: drawn on the node body; slots render on top but don't affect selection visuals.
- **Ref indicator**: moves out of `badge`'s way on groups when badge is occupied. Non-group ref indicators (bottom-right) never collide.
- **Toolbar**: per-category toolbar fully replaces theme default when present. No merging — keeps the mental model simple. A category that wants the default color swatches plus its own actions can import them from `theme.nodeActions` and spread.
- **Editor**: form editor is strictly additive; single-field editor unchanged for categories that don't set `editableFields` and for base types with no category.

---

## Edge cases & design notes

1. **Slot value throws or returns garbage.** Library wraps each slot render in a try/catch (dev mode only) and falls back to rendering nothing for that slot. Production skips the try/catch for speed.

2. **Accessor re-runs every render.** Intentional — React's normal reactivity. Consumer wraps expensive rollups in `useMemo` keyed on the sub-canvas reference if needed.

3. **`custom` slot escape hatch.** Receives the same region rect as the declarative kinds. Can return arbitrary SVG. If it needs to draw outside its region, it can — the library doesn't clip — but reflow flags are based on which slot is used, not on where the SVG ends up.

4. **Text reflow for very short nodes.** If kicker + bottomBar reservations would leave less than `theme.node.fontSize` vertical space for text, skip reflow entirely for that node (text stays centered; slots still render; visual overlap is the consumer's problem for choosing a tiny node).

5. **Async sub-canvas resolution.** `getSubCanvas` returns `undefined` for unresolved refs. `ctx.rollup(undefined, pred)` returns `{ total: 0, matched: 0, fraction: 0 }`. `count` slot with `hideWhenEmpty: true` (default) hides on 0/''. `progress` renders 0% — the consumer can gate on `rollup.total > 0` in the accessor if they want to hide the bar.

6. **Category that changes the node's `type`.** Unaffected. Paint-order (groups behind, non-groups in front) still follows the node's resolved type. Slots render on top of whichever body shape the type dictates.

7. **Toolbar-driven category switching.** Because actions can patch `{ category: 'other' }`, and visuals / toolbar / editor all read from the category, a single toolbar click can transform the node's entire presentation. This is the "change category from the toolbar" feature — emerges for free, no special support needed.

8. **Backwards compat.** Existing themes + canvases behave identically. `slots`, `toolbar`, `editableFields`, `defaultCustomData` are all optional. `NodeRenderer` short-circuits when the category has no slots.

---

## What this plan does NOT include

- **No `nodeRenderers` prop.** Category slots cover the use cases we care about. Full renderer replacement is a much bigger commitment we can revisit only if a concrete blocker appears.
- **No `renderNodeOverlay` prop.** Folded into `category.slots`.
- **No `data` field on `CanvasNode`.** `customData` is the existing extension point; keep it.
- **No theme-level primitives theme slot (`theme.primitives`) for v1.** Primitives take explicit props. If a universal "all progress bars should be green" knob becomes useful, add it later.
- **No per-node slot overrides** (keyed on `node.id`). Categories are the extension point. If a consumer needs per-node differences, they express it through accessors that read from `node.customData`.
- **No resize handles rework.** Out of scope.
- **No edge-level equivalent.** Edges don't have refs; the need hasn't materialized.
- **No automatic memoization.** Render-time by design.

---

## Implementation order

1. **Data model** — add all new types to `packages/core/src/types.ts`. Typecheck passes with no behavior change.
2. **Rollup** — `packages/core/src/rollup.ts` with `rollupNodes`, `rollupNodesDeep`, `RollupResult`. Unit-tested with a small canvas tree. Exported.
3. **Region math** — `packages/core/src/slots.ts` with `computeCategorySlotRegions`, `resolveAccessor`, `getCategorySlots`. Pure, testable.
4. **Primitives** — `NodeProgressBar`, `NodeCountBadge`, `NodeAccentStrip`, `NodeKicker`, `NodeDot` in `packages/react/src/primitives/`. Secondary export added.
5. **Slot renderer wiring in `NodeRenderer`** — resolve slots, render primitives, compute reflow flags, move group ref indicator when badge is present. Verify existing demo unchanged.
6. **Text reflow props** on `TextNode` / `FileNode` / `LinkNode` / `GroupNode`.
7. **Toolbar resolver** — `getNodeActionsForNode`; swap in `NodeToolbar`.
8. **Editor form variant** — detect `editableFields`, render form editor; `getAtPath` / `setAtPath` in core.
9. **`defaultCustomData`** — wire in `createNodeFromOption`.
10. **Demo** — roadmap example with `phase` + `initiative` categories using slots, toolbar, editableFields, defaultCustomData.
11. **AGENTS.md** — document category slots, rollup helpers, toolbar/editor resolution under Key Concepts.

Each step is independently testable against `npm run typecheck` and `npm run build`.

---

## Verification

- `npm run typecheck` passes.
- `npm run build` succeeds.
- `npm run dev` manual smoke test:
  - Roadmap demo: phase node shows count badge + progress bar derived from sub-canvas rollup. Toggling an initiative's status via its toolbar updates the phase's overlay instantly.
  - Initiative node: accent strip color follows status; status dot color follows status; toolbar has three status buttons; double-click opens a form editor with title + status select.
  - Creating a new initiative via the FAB seeds `customData.status: 'attn'` from `defaultCustomData`.
  - Category switching from the toolbar works — a button whose patch is `{ category: 'milestone' }` transforms the node's visuals, toolbar, and editor in one click.
  - Existing non-categorized nodes in the basic demo render and behave identically to before.
