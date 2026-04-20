# Plan: Category Slots — Unified Composition for Node Visuals, Overlays, Toolbars, and Editing

Status: DRAFT — supersedes `custom-renderers.md` and `derived-overlays.md`. Review before implementing.

## Goal

Make **category** the single unit of composition for a node's identity. A category already controls default width, height, fill, stroke, corner radius, icon, and the base JSON Canvas type. This plan extends it with three orthogonal slots:

- `slots` — declarative visual add-ons (color fills, progress bars, count badges, dots, text labels) rendered by the library in library-owned positional regions.
- `toolbar` — per-category override of the node toolbar actions.
- `editableFields` — per-category form schema for the inline editor.

All three are optional. All three are additive. None change existing behavior when absent.

The declarative slot system covers the overwhelming majority of rich-node use cases (progress bars from sub-canvas rollups, status badges, count pips, accent strips, status dots) with one-line category entries. An escape hatch (`kind: 'custom'`) lets a consumer draw arbitrary SVG inside one slot when the declarative kinds aren't enough — the library still owns positioning, text reflow, paint order, and ref-indicator collision.

This replaces two earlier plans:

- `custom-renderers.md` — full node renderer replacement with a primitives library. Too big a surface area; overlaps with toolbar and editor work; makes category less central.
- `derived-overlays.md` — `renderNodeOverlay` render prop. Correct idea, wrong shape — pulls logic out of category into a global prop.

---

## Architectural decisions (confirmed)

- **Category is the extension point.** `category.slots`, `category.toolbar`, `category.editableFields` live alongside the existing visual defaults. One place to answer "what kind of thing is this node."
- **Slots are positional, not semantic.** 10 library-owned regions (4 edges, 4 corners, 2 header strips) can each hold one slot. Positional names are self-documenting — `topRight` needs no explanation; "kicker" does.
- **Kind and position are orthogonal.** Every region accepts every kind. The library renders the kind into the region's rect. No semantic coupling between a region and what it can hold.
- **Slots are declarative by default.** Each slot has a `kind` (`'color' | 'progress' | 'count' | 'text' | 'dot' | 'custom'`). Library ships the rendering for each kind. No bounds math for consumers.
- **Accessors let slot values be static or derived.** `value: number | ((ctx) => number)`. The function form receives `{ node, theme, getSubCanvas, canvases, rollup, region }` — enough to express "fraction of children with `customData.status === 'done'`" in one line.
- **`ctx.rollup(predicate)` operates on `node.ref` implicitly.** The common case is zero-arg; no null-checking boilerplate. If a consumer needs a different ref they can drop down to `rollupNodes(getSubCanvas(ref), predicate)`.
- **Regions are library-owned.** `topEdge`, `bottomEdge`, `leftEdge`, `rightEdge` (thin strips), `topLeft`, `topRight`, `bottomLeft`, `bottomRight` (corner badges), `header`, `footer` (full-width inset strips that reflow text). Library auto-reflows node text when `header`/`footer`/`leftEdge`/`rightEdge` are occupied, auto-moves ref indicators when their default corner is occupied.
- **Primitives are an internal detail, re-exported for `kind: 'custom'`.** The library renders declarative slots using `<NodeColorFill>`, `<NodeProgressBar>`, `<NodeCountBadge>`, `<NodeDot>`, `<NodeText>` internally. These are also exported from `system-canvas-react/primitives` so custom-slot render functions can reuse them.
- **`kind: 'custom'` is the escape hatch, not the common path.** No declarative example in this plan falls through to `custom`. If a real case does, that's a signal the declarative kinds need extending.
- **No `nodeRenderers` prop. No `renderNodeOverlay` prop.** Both are removed from the roadmap. Everything flows through category slots. If a consumer truly needs to replace a whole node shape, they wrap the canvas or use a `kind: 'custom'` slot that fills the `topEdge`+`bottomEdge` regions.
- **`toolbar` at category level falls through to `theme.nodeActions` when absent.** Same resolution pattern as visual defaults. A helper `buildDefaultToolbar(theme)` is exported so categories can spread the default into their own array without boilerplate.
- **`editableFields` at category level falls through to the single-field editor** (text for text nodes, file for file nodes, etc.).
- **Data lives in `customData`.** Already exists on `CanvasNode`. No new blessed `data` field. Accessors can read from anywhere on the node.
- **Rollups are first-class.** `ctx.rollup(predicate)` is exposed inside slot accessors as a convenience wrapper over `rollupNodes(getSubCanvas(node.ref), predicate)`.
- **No caching in the library.** Accessors run at render. Consumers wrap expensive predicates in `useMemo` if they care.
- **One slot per position for v1.** Each of the 10 regions holds at most one slot. If a consumer wants two things in the same corner, they use `kind: 'custom'`. Upgrade to array-valued slots later only if a concrete need appears.
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

  /** Declarative visual add-ons rendered in library-owned positional regions. */
  slots?: CategorySlots

  /** Per-category toolbar override. Falls through to theme.nodeActions when absent. */
  toolbar?: NodeActionGroup[]

  /** Per-category inline editor schema. Falls through to single-field editor when absent. */
  editableFields?: EditableField[]

  /** Seed customData for new nodes created from this category via the add-node menu. Deep-cloned per instance. */
  defaultCustomData?: Record<string, unknown>
}

export type SlotPosition =
  | 'topEdge' | 'bottomEdge' | 'leftEdge' | 'rightEdge'
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  | 'header' | 'footer'

export type CategorySlots = Partial<Record<SlotPosition, SlotSpec>>

export type SlotSpec =
  | ColorSlot
  | ProgressSlot
  | CountSlot
  | TextSlot
  | DotSlot
  | CustomSlot

export interface ColorSlot {
  kind: 'color'
  color: NodeAccessor<string>
}

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
  /**
   * Rollup helper scoped to this node's sub-canvas. Equivalent to
   * `rollupNodes(getSubCanvas(node.ref), predicate)`. Returns zeros when
   * the node has no ref or the sub-canvas is unresolved.
   */
  rollup: (predicate: (n: CanvasNode) => boolean) => RollupResult
}
```

### `EditableField`

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

### `RollupResult` + rollup helpers

Kept as specified in `derived-overlays.md`: new file `packages/core/src/rollup.ts` with `rollupNodes`, `rollupNodesDeep`, `RollupResult`. Unchanged from the earlier plan.

---

## Regions

Library pre-computes these in canvas-space per node. Consumer slot code never does bounds math.

Sizes use `em` units relative to `theme.node.fontSize` so they scale with the theme font. Edge thicknesses are in `px` because they're visual detail not type-driven.

| Region        | Shape                              | Default size                                    | Reflows text? |
|---------------|------------------------------------|-------------------------------------------------|---------------|
| `topEdge`     | thin horizontal strip (top)        | `node.width` × 2px                              | no            |
| `bottomEdge`  | thin horizontal strip (bottom)     | `node.width` × `max(6, height * 0.08)` px       | no            |
| `leftEdge`    | thin vertical strip (left)         | 3px × `node.height`                             | yes (inset)   |
| `rightEdge`   | thin vertical strip (right)        | 3px × `node.height`                             | yes (inset)   |
| `topLeft`     | square corner badge                | `1.25em × 1.25em`, 6px inset                    | no            |
| `topRight`    | square corner badge                | `1.25em × 1.25em`, 6px inset                    | no            |
| `bottomLeft`  | square corner badge                | `1.25em × 1.25em`, 6px inset                    | no            |
| `bottomRight` | square corner badge                | `1.25em × 1.25em`, 6px inset                    | no            |
| `header`      | full-width strip inside top        | `node.width - 24` × `~1.15em`, 8px top inset    | yes (down)    |
| `footer`      | full-width strip inside bottom     | `node.width - 24` × `~1em`, 8px bottom inset    | yes (up)      |

Computed by a pure function `computeCategorySlotRegions(node, theme): Record<SlotPosition, Rect>` in core, used by both the renderer and (optionally) consumer `kind: 'custom'` code.

**Kind `'dot'` shrinks its corner region** to `0.5em × 0.5em` centered inside the 1.25em corner slot so dots read as dots, not filled squares. Other kinds use the full region.

---

## Rendering flow

In `NodeRenderer.tsx`:

1. Resolve the node; look up the category.
2. Compute regions.
3. For each defined slot, resolve accessors against `SlotContext` and render the appropriate primitive (or call `render` for `custom`).
4. Determine reflow flags from which regions are occupied:
   - `header` present → shift title/body text down by header height + inset.
   - `footer` present → shrink text vertical center by footer height + inset.
   - `leftEdge` present → inset text by leftEdge width.
   - `rightEdge` present → inset text by rightEdge width.
   - Corner on the top row (`topLeft` or `topRight`) present → reserve corner width in the title row so long titles don't run under badges.
   - Ref indicator's default corner is occupied → move to the diagonally-opposite free corner (see §Ref indicator collision).
5. Render node body, text, slots, ref indicator, resize handles in this paint order:

```
groups → edges → non-group nodes → header/footer → edge strips → corner slots → refIndicator → resizeHandles
```

Slots live inside a `pointerEvents="none"` wrapper so they never intercept clicks meant for the node body. `custom` slots can re-enable `pointerEvents: 'auto'` on inner elements if they want interactivity.

---

## Ref indicator collision

Current behavior:
- Non-group nodes: ref indicator at `bottomRight`.
- Group nodes: ref indicator at `topRight`.

New rule: if the ref indicator's default corner is occupied by a slot, move it to the diagonally-opposite corner (`topRight ↔ bottomLeft`, `bottomRight ↔ topLeft`). If that corner is also occupied, try the remaining two corners in clockwise order. If all four corners are occupied, keep the default position and log a dev-mode warning — the consumer has asked for a collision.

Implementation-wise, `RefIndicator` already supports `corner?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'`. `NodeRenderer` picks the corner based on occupancy and passes it through.

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

/**
 * Returns the same default toolbar `getNodeActions` would return when the
 * theme has no `nodeActions`. Exposed so categories can spread the default
 * into their own toolbar array without duplicating it.
 */
export function buildDefaultToolbar(theme: CanvasTheme): NodeActionGroup[] {
  return theme.nodeActions ?? [buildDefaultColorActions(theme)]
}
```

`NodeToolbar` swaps the call site to `getNodeActionsForNode`. No other changes.

Because `NodeAction.patch` already supports `(node) => NodeUpdate`, a category can define a toolbar that switches the node to a different category — e.g. a `buttons`-kind group whose actions return `{ category: 'milestone' }` / `{ category: 'blocker' }`. This is the "change category from the toolbar" pattern; it needs zero new machinery.

Categories that want "default color swatches plus my own actions" can do:

```ts
toolbar: [
  ...buildDefaultToolbar(theme),
  { id: 'status', kind: 'buttons', actions: [...] },
]
```

---

## Editor resolution

`NodeEditor` grows a branch:

1. If `node.category` resolves to a category with `editableFields`, render the form editor.
2. Otherwise, render the current single-field editor (text for text nodes, file for file, etc.).

The form editor uses `getAtPath` / `setAtPath` utilities (new in core, <20 lines, dependency-free) to read and write nested fields like `customData.status`. On commit it builds a single patch that includes a fully-formed `customData` object (merged from the current node) so consumers can shallow-merge without losing sibling keys.

### Commit semantics

- **Commit** fires on: blur of the whole panel (focus leaves all fields in the form), or `Cmd/Ctrl+Enter`.
- **Cancel** fires on: `Escape`. All field edits since the editor opened are discarded.
- **`Enter`** inside a single-line field (text/number/select) advances focus to the next field. `Enter` on the last field commits.
- **`Tab`** and `Shift+Tab` navigate between fields normally (browser default).
- **`Enter`** inside a `textarea` inserts a newline. `Cmd+Enter` commits from inside a textarea.
- Clicking outside the editor panel (on canvas background or another node) commits. Clicking a different node then commits the current edit before opening that node's editor.

---

## `createNodeFromOption` + `defaultCustomData`

When the add-node FAB creates a node for a category that has `defaultCustomData`, the helper deep-clones it (via `structuredClone`) onto the new node's `customData`. Per-instance cloning prevents two nodes from sharing a nested object/array reference. Pairs with `editableFields` so a newly-created categorized node opens an editor with sensible defaults already populated.

---

## Worked example: roadmap phase with progress

A phase node whose sub-canvas contains initiatives, each with `customData.status`:

```ts
const isDone = (n: CanvasNode) => n.customData?.status === 'done'
const statusColor = (status: unknown) =>
  ({ done: '#4ade80', risk: '#ef4444', attn: '#f59e0b' }[status as string] ?? '#6b7280')

const roadmapTheme: CanvasTheme = {
  // ...
  categories: {
    phase: {
      type: 'group',
      defaultWidth: 320, defaultHeight: 180,
      fill: '...', stroke: '...',
      slots: {
        header: { kind: 'text', value: 'PHASE' },
        topRight: {
          kind: 'count',
          value: ({ node, rollup }) => {
            const r = rollup(isDone)
            return r.total === 0 ? '' : `${r.matched}/${r.total}`
          },
          color: '#4ade80',
        },
        bottomEdge: {
          kind: 'progress',
          value: ({ rollup }) => rollup(isDone).fraction,
          color: '#4ade80',
          bgColor: 'rgba(255,255,255,0.08)',
        },
      },
      toolbar: (theme) => buildDefaultToolbar(theme),  // inherits default swatches
      editableFields: [
        { path: 'label', kind: 'text', label: 'Phase' },
      ],
    },

    initiative: {
      type: 'text',
      defaultWidth: 220, defaultHeight: 64,
      fill: '...', stroke: '...',
      slots: {
        topEdge: {
          kind: 'color',
          color: ({ node }) => statusColor(node.customData?.status),
        },
        topLeft: {
          kind: 'dot',
          color: ({ node }) => statusColor(node.customData?.status),
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

Result: the phase node shows `"3/5"` in a circle in the top-right, the word `PHASE` above the title, and a 60% progress bar along the bottom. The initiative nodes show a colored accent strip across the top plus a status dot in the top-left, have a three-button status toolbar, and a two-field form editor. All declarative. No `kind: 'custom'`. No render props.

---

## Changes by file

### `packages/core/src/types.ts`

- Extend `CategoryDefinition` with `slots?`, `toolbar?`, `editableFields?`, `defaultCustomData?`.
- Add `SlotPosition`, `CategorySlots`, `SlotSpec`, `ColorSlot`, `ProgressSlot`, `CountSlot`, `TextSlot`, `DotSlot`, `CustomSlot`, `NodeAccessor<T>`, `SlotContext`, `EditableField`, `EditableFieldKind`.
- Add `Rect` if not already exported (for `SlotContext.region`).

### `packages/core/src/rollup.ts` (new)

- `rollupNodes`, `rollupNodesDeep`, `RollupResult`. As specified in `derived-overlays.md` §Core.

### `packages/core/src/slots.ts` (new)

- `computeCategorySlotRegions(node, theme): Record<SlotPosition, Rect>` — pure geometry.
- `resolveAccessor<T>(accessor, ctx): T` — helper to call or return the accessor.
- `getCategorySlots(node, theme): CategorySlots | undefined` — lookup.
- `pickRefIndicatorCorner(defaultCorner, slots): SlotPosition` — collision resolver.

### `packages/core/src/actions.ts`

- Add `getNodeActionsForNode(node, theme)` that checks `category.toolbar` first, falls back to `getNodeActions(theme)`.
- Add `buildDefaultToolbar(theme)` so categories can spread the default into their toolbar arrays.

### `packages/core/src/canvas.ts`

- `createNodeFromOption` deep-clones `category.defaultCustomData` (via `structuredClone`) onto the new node.
- Add `getAtPath(obj, path)` / `setAtPath(obj, path, v)` utilities.

### `packages/core/src/index.ts`

- Export new helpers, types, and rollup.

### `packages/react/src/components/NodeRenderer.tsx`

- After rendering node body/text, resolve category slots and render them.
- Pass `reservedTop` (for `header`) and `reservedBottom` (for `footer`) plus `reservedLeft` / `reservedRight` (for edge strips) to the node component.
- Determine ref indicator corner via `pickRefIndicatorCorner`.

### `packages/react/src/components/TextNode.tsx`, `FileNode.tsx`, `LinkNode.tsx`, `GroupNode.tsx`

- Accept optional `reservedTop?`, `reservedBottom?`, `reservedLeft?`, `reservedRight?: number`. Subtract from inner layout when centering text.

### `packages/react/src/components/NodeToolbar.tsx`

- Swap `getNodeActions(theme)` for `getNodeActionsForNode(node, theme)`.

### `packages/react/src/components/NodeEditor.tsx`

- Detect `category.editableFields`; render form editor when present, single-field editor otherwise.
- Use core's `getAtPath` / `setAtPath` to read/write field values; build a merged `customData` on commit.
- Wire commit/cancel semantics per §Editor resolution.

### `packages/react/src/primitives/` (new)

- `NodeColorFill.tsx`, `NodeProgressBar.tsx`, `NodeCountBadge.tsx`, `NodeDot.tsx`, `NodeText.tsx`.
- Used internally by the slot renderer. Re-exported from a secondary entry point for `kind: 'custom'` slot implementations.

### `packages/react/src/index.ts` + `package.json`

- Add `./primitives` secondary export.

### `demo/`

- Roadmap demo canvas uses `category.slots` to show the worked example above.
- **New `showcase` demo mode** — see §Showcase demo below.
- Remove any prior scaffolding for `renderNodeOverlay` / `nodeRenderers` if those crept in.

---

## Showcase demo

A new demo mode whose sole purpose is to visually exercise every slot kind in every useful position. Not a realistic canvas — a grid of disconnected "cool nodes," each demonstrating a different combination. Serves double duty as (a) a vibes check that the feature works, and (b) a reference sheet consumers can screenshot when deciding which kind goes in which position.

### Files

- `demo/src/showcase.ts` (new) — exports `showcaseRoot: CanvasData`, `showcaseCanvasMap: Record<string, CanvasData>` (can be empty — no sub-canvases needed), and `showcaseTheme: CanvasTheme` with a rich `categories` map that defines one category per showcase node.
- `demo/src/main.tsx` — add `'showcase'` to the `Mode` union, the `DEFAULT_THEME_FOR_MODE` / `MODE_HAS_LANES` / `MODE_ROOT_LABEL` / `MODE_USES_PER_CANVAS_THEME` maps, the `canvasesByMode` record, the switch in the `onNodeAdd`/etc. dispatcher, and a `<option value="showcase">showcase</option>` entry in the mode `<select>`.

### Theme

`showcaseTheme` extends the existing `dark` theme with ~12 categories, one per showcase node. Dark base so the accents pop. No `nodeActions` override at theme level — categories that want a custom toolbar set their own.

### Layout

A 4×3 grid of text-type nodes, ~220×96 each, spaced on 260×140 centers. Each node's `text` field is its category name ("count badge" / "progress bar" / "status dot" / etc.) so the demo is self-labeling. The grid is laid out once in `showcase.ts` at import time; no dynamic positioning logic.

### Categories to include

Each demonstrates one or two slots; together they cover every kind × every distinct position worth showing:

1. **`count-pip`** — `topRight: { kind: 'count', value: 3, color: '#ef4444' }`. The classic red notification badge.
2. **`count-large`** — `topRight: { kind: 'count', value: '12+', color: '#3b82f6' }`. Verifies multi-character fits.
3. **`progress-bottom`** — `bottomEdge: { kind: 'progress', value: 0.72, color: '#4ade80', bgColor: 'rgba(255,255,255,0.08)' }`. The archetypal progress node.
4. **`progress-top`** — `topEdge: { kind: 'progress', value: 0.4, color: '#f59e0b' }`. Shows top-edge placement.
5. **`status-done`** — `topEdge: { kind: 'color', color: '#4ade80' } + topLeft: { kind: 'dot', color: '#4ade80' }`. Dual-slot pattern from the roadmap.
6. **`status-risk`** — same shape as #5 with `#ef4444`. Shows the pattern scales.
7. **`left-accent`** — `leftEdge: { kind: 'color', color: '#8b5cf6' }`. Kanban-style priority stripe. Text reflows right.
8. **`header-kicker`** — `header: { kind: 'text', value: 'CUSTOMER' }`. Publishing-style label above the title.
9. **`footer-meta`** — `footer: { kind: 'text', value: 'Updated 2h ago', color: 'rgba(255,255,255,0.5)' }`. Small muted metadata strip.
10. **`full-dressed`** — one node with the whole kitchen sink: `header: 'INITIATIVE' + topRight: count 4 + leftEdge: color purple + bottomEdge: progress 60%`. Proves four slots coexist without colliding and that the ref indicator finds a free corner. This node has a `ref` to itself (or a dummy sub-canvas) so the ref indicator actually appears and demonstrates the collision-resolution behavior.
11. **`custom-sparkline`** — demonstrates `kind: 'custom'`. A `bottomEdge` slot that renders a tiny 20-point SVG sparkline from `node.customData.series`. One of each showcase node carries sample series data in its `customData`. Exists to prove the escape hatch works and to show consumers what custom-slot code looks like.
12. **`group-with-badge`** — the only `type: 'group'` category. `topRight: { kind: 'count', value: 5, color: '#4ade80' }`. Has a `ref` so the ref indicator appears — verifies it moves to `bottomLeft` (diagonal opposite) because `topRight` is occupied.

### Behavior flags

- `MODE_HAS_LANES['showcase'] = false` — pure demo, no snapping.
- `MODE_USES_PER_CANVAS_THEME['showcase'] = false` — uses the `showcase` theme from the dropdown.
- `DEFAULT_THEME_FOR_MODE['showcase'] = 'showcase'` — flips the theme dropdown to `showcase` on mode switch.
- `MODE_ROOT_LABEL['showcase'] = 'Showcase'`.
- Editable toggle still works — user can add/edit/delete nodes on the grid, and `defaultCustomData` gets seeded on new nodes from the add-node FAB. A couple of categories declare `editableFields` so the form editor variant is also exercisable here.

### Why this pays for itself

- Catches rendering regressions in every slot kind on every switch of a code path — one visual check, not twelve.
- Doubles as a living documentation page. A screenshot of this canvas _is_ the slot API reference.
- Exercises `kind: 'custom'` inside the demo so we know the escape hatch actually renders what consumers would write.
- Forces the `full-dressed` collision case to work visually before anyone hits it in the wild.

---

## Interaction with existing features

- **Lanes**: independent. A node can be in a lane and also have slots.
- **Drag / resize**: slots are `pointerEvents="none"`, so drags still originate from the node body. Resize handles paint above slots.
- **Selection outline**: drawn on the node body; slots render on top but don't affect selection visuals.
- **Ref indicator**: moved to a free corner when the default corner is occupied by a slot (see §Ref indicator collision).
- **Toolbar**: per-category toolbar fully replaces theme default when present. No merging — keeps the mental model simple. Use `buildDefaultToolbar(theme)` to spread the default explicitly.
- **Editor**: form editor is strictly additive; single-field editor unchanged for categories that don't set `editableFields` and for base types with no category.

---

## Edge cases & design notes

1. **Slot value throws or returns garbage.** Library wraps each slot render in a try/catch (dev mode only) and falls back to rendering nothing for that slot. Production skips the try/catch for speed.

2. **Accessor re-runs every render.** Intentional — React's normal reactivity. Consumer wraps expensive rollups in `useMemo` keyed on the sub-canvas reference if needed. The practical pattern for accessors that compute once per render is: pre-compute at the consumer's component level, stash on the node's `customData`, read back in the accessor.

3. **`custom` slot escape hatch.** Receives the same region rect as the declarative kinds via `ctx.region`. Can return arbitrary SVG. If it needs to draw outside its region, it can — the library doesn't clip — but reflow flags are based on which position is used, not on where the SVG ends up.

4. **Text reflow for very short nodes.** If header + footer + edge reservations would leave less than `theme.node.fontSize` vertical space for text, skip reflow entirely for that node (text stays centered; slots still render; visual overlap is the consumer's problem for choosing a tiny node).

5. **Async sub-canvas resolution.** `getSubCanvas` returns `undefined` for unresolved refs. `ctx.rollup(pred)` returns `{ total: 0, matched: 0, fraction: 0 }` when the node has no ref OR the sub-canvas isn't resolved. `count` slot with `hideWhenEmpty: true` (default) hides on 0/''. `progress` renders 0% — the consumer can gate on `rollup(pred).total > 0` in the accessor if they want to hide the bar.

6. **Category that changes the node's `type`.** Unaffected. Paint-order (groups behind, non-groups in front) still follows the node's resolved type. Slots render on top of whichever body shape the type dictates.

7. **Toolbar-driven category switching.** Because actions can patch `{ category: 'other' }`, and visuals / toolbar / editor all read from the category, a single toolbar click can transform the node's entire presentation. This is the "change category from the toolbar" feature — emerges for free, no special support needed.

8. **Adding slots to an existing group category.** If a consumer adds a `topRight` slot to a group category that already has ref'd nodes, those nodes' ref indicators will move from `topRight` to `bottomLeft` (diagonal opposite rule). This is a visual change — document it, don't try to avoid it.

9. **Two slots in the same position.** Not supported in v1. The type forbids it (`Partial<Record<SlotPosition, SlotSpec>>`). Use `kind: 'custom'` for a corner that needs both a dot and a count. Upgrade to array-valued slots later only if a concrete need appears.

10. **Backwards compat.** Existing themes + canvases behave identically. `slots`, `toolbar`, `editableFields`, `defaultCustomData` are all optional. `NodeRenderer` short-circuits when the category has no slots.

---

## What this plan does NOT include

- **No `nodeRenderers` prop.** Category slots cover the use cases we care about. Full renderer replacement is a much bigger commitment we can revisit only if a concrete blocker appears.
- **No `renderNodeOverlay` prop.** Folded into `category.slots`.
- **No `data` field on `CanvasNode`.** `customData` is the existing extension point; keep it.
- **No theme-level primitives theme slot (`theme.primitives`) for v1.** Primitives take explicit props. If a universal "all progress bars should be green" knob becomes useful, add it later.
- **No per-node slot overrides** (keyed on `node.id`). Categories are the extension point. If a consumer needs per-node differences, they express it through accessors that read from `node.customData`.
- **No multi-slot-per-position** for v1. See edge case #9.
- **No resize handles rework.** Out of scope.
- **No edge-level equivalent.** Edges don't have refs; the need hasn't materialized.
- **No automatic memoization.** Render-time by design.

---

## Implementation order

1. **Data model** — add all new types to `packages/core/src/types.ts`. Typecheck passes with no behavior change.
2. **Rollup** — `packages/core/src/rollup.ts` with `rollupNodes`, `rollupNodesDeep`, `RollupResult`. Unit-tested with a small canvas tree. Exported.
3. **Region math** — `packages/core/src/slots.ts` with `computeCategorySlotRegions`, `resolveAccessor`, `getCategorySlots`, `pickRefIndicatorCorner`. Pure, testable.
4. **Primitives** — `NodeColorFill`, `NodeProgressBar`, `NodeCountBadge`, `NodeDot`, `NodeText` in `packages/react/src/primitives/`. Secondary export added.
5. **Slot renderer wiring in `NodeRenderer`** — resolve slots, render primitives, compute reflow flags, pick ref indicator corner. Verify existing demo unchanged.
6. **Text reflow props** on `TextNode` / `FileNode` / `LinkNode` / `GroupNode`.
7. **Toolbar resolver** — `getNodeActionsForNode`, `buildDefaultToolbar`; swap in `NodeToolbar`.
8. **Editor form variant** — detect `editableFields`, render form editor; `getAtPath` / `setAtPath` in core; wire commit semantics.
9. **`defaultCustomData`** — wire `structuredClone` in `createNodeFromOption`.
10. **Demo (roadmap)** — roadmap example with `phase` + `initiative` categories using slots, toolbar, editableFields, defaultCustomData.
11. **Demo (showcase)** — new `showcase` mode per §Showcase demo. Adds `demo/src/showcase.ts` and wires the mode into `main.tsx`.
12. **AGENTS.md** — document category slots, positional regions, rollup helpers, toolbar/editor resolution under Key Concepts. Mention the showcase mode as the visual reference for slot kinds.

Each step is independently testable against `npm run typecheck` and `npm run build`.

---

## Verification

- `npm run typecheck` passes.
- `npm run build` succeeds.
- `npm run dev` manual smoke test:
  - Roadmap demo: phase node shows count badge in `topRight` + progress bar on `bottomEdge` + `PHASE` text in `header`, all derived from sub-canvas rollup. Toggling an initiative's status via its toolbar updates the phase's slots instantly.
  - Initiative node: `topEdge` color follows status; `topLeft` dot follows status; toolbar has three status buttons; double-click opens a form editor with title + status select.
  - Creating a new initiative via the FAB seeds `customData.status: 'attn'` from `defaultCustomData` (deep-cloned).
  - Category switching from the toolbar works — a button whose patch is `{ category: 'milestone' }` transforms the node's visuals, toolbar, and editor in one click.
  - Ref indicator on a group node with a `topRight` slot moves to `bottomLeft`.
  - Existing non-categorized nodes in the basic demo render and behave identically to before.
  - Showcase demo: all 12 category nodes render their slots correctly in a 4×3 grid. `full-dressed` shows four coexisting slots with the ref indicator in `topLeft` (the only free corner given `topRight` + `leftEdge` + top row occupancy). `group-with-badge` shows the ref indicator in `bottomLeft`. `custom-sparkline` renders a real sparkline from `customData.series`.
