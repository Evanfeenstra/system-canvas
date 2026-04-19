# Plan: Fully Editable Canvas (Add / Edit / Move / Delete Nodes)

Status: IMPLEMENTED

## Goal

Make `system-canvas` fully editable from the consumer side:

1. Add nodes of any type (text / file / link / group) or theme category via a "+" button.
2. Inline-edit node text/label/path/url.
3. Drag nodes to move them.
4. Delete selected nodes.

The library stays stateless (read-only `canvas` prop). All mutations are emitted as callbacks; the consumer owns `CanvasData` in their own state.

The FAB is rendered by default but fully replaceable via a render prop.

---

## Architectural decisions (confirmed)

- **Mutation API:** emit granular callbacks (`onNodeAdd`, `onNodeUpdate`, `onNodeDelete`). The library does not keep node state. Consumer merges into their `CanvasData` and passes it back as the `canvas` prop.
- **FAB customization:** render prop with defaults.
- **Menu contents:** categories first (with icon + color swatch), divider, then base JSON Canvas types.
- **Edit flow:** double-click a node → inline edit via SVG `<foreignObject>`. `<textarea>` for `type='text'`, `<input>` for `file` / `link` / `group`.
- **Delete flow:** click to select → Delete/Backspace key removes it + its edges.
- **Drag flow:** pointer events on node `<g>`; no d3-drag dependency.
- **Demo:** converted to hold canvases in `useState` + a `canvasMap` kept in state so mutations to sub-canvases persist across navigation.

### Preconditions

**`editable: true` requires the `canvases` prop** (synchronous ref → CanvasData map). The async-only `onResolveCanvas` path cannot observe consumer-side mutations, so we won't support edits without `canvases`. Document this; throw a dev-mode warning if `editable && !canvases`.

---

## `canvasRef` semantics

`canvasRef` (passed to `onNodeAdd/Update/Delete`) is the **ref string used to navigate into the currently-viewed canvas** — i.e., the `ref` of the last breadcrumb. On the root canvas it is `undefined`. The consumer uses this to know which entry in their canvases map to mutate. The library has no intrinsic "canvas id" concept; refs are opaque URIs.

---

## Click / double-click behavior

| State                        | Navigable (has `ref`)             | Non-navigable                        |
| ---------------------------- | --------------------------------- | ------------------------------------ |
| editable=false, single click | navigate                          | fire `onNodeClick`                   |
| editable=false, double click | fire `onNodeDoubleClick`          | fire `onNodeDoubleClick`             |
| editable=true, single click  | select + `onNodeClick`            | select + `onNodeClick`               |
| editable=true, double click  | `onNodeDoubleClick` then navigate | `onNodeDoubleClick` then open editor |

In editable mode, single click never navigates. This is a deliberate behavior change. Consumers who want navigation without editing should leave `editable` off.

---

## Problem: stale canvas cache in `useNavigation`

`packages/react/src/hooks/useNavigation.ts:59` keeps a `canvasStack: CanvasData[]` inside the hook. When the consumer updates the root canvas prop, already-navigated sub-canvases in the stack become stale.

### Fix

Refactor `useNavigation` to:

- Track a breadcrumb stack of `{ label, ref?: string }` only.
- Compute `currentCanvas` each render:
  - depth 0 → `rootCanvas` prop
  - depth N → `canvases[lastBreadcrumb.ref]` if present, else the most recently fetched async result for that ref.
- Keep an async result cache for `onResolveCanvas` fallback, but **prefer `canvases[ref]`** when present.
- Expose `currentCanvasRef: string | undefined`.

This makes updates to `canvases` propagate immediately, with no remount needed.

---

## Core types change: `CategoryDefinition.type`

A category currently does not specify a JSON Canvas node type. Add an optional field:

```ts
interface CategoryDefinition {
  // ... existing fields ...
  /** The JSON Canvas node type to create when this category is chosen. Default: 'text'. */
  type?: NodeType;
}
```

When the user picks category "service" from the menu, the new node gets `type: category.type ?? 'text'` and `category: 'service'`.

---

## Changes by file

### `packages/core/src/types.ts`

- Add `type?: NodeType` to `CategoryDefinition`.
- Add:

```ts
/** A partial update to an existing node (x/y/text/label/etc.). */
export type NodeUpdate = Partial<Omit<CanvasNode, "id" | "type">>;

/** An entry in the add-node menu. */
export interface NodeMenuOption {
  kind: "category" | "type";
  /** For kind='category': the category key. For kind='type': the NodeType. */
  value: string;
  label: string;
  icon?: string | null;
  fill?: string;
  stroke?: string;
  /** The resolved NodeType for this option (matches category.type or the base type). */
  nodeType: NodeType;
}
```

### `packages/core/src/canvas.ts`

Add helpers (all pure):

```ts
export function generateNodeId(): string;

export function getNodeMenuOptions(
  canvas: CanvasData,
  theme: CanvasTheme,
): NodeMenuOption[];

export function createNodeFromOption(
  option: NodeMenuOption,
  x: number,
  y: number,
  id?: string,
): CanvasNode;

export function addNode(canvas: CanvasData, node: CanvasNode): CanvasData;

export function updateNode(
  canvas: CanvasData,
  nodeId: string,
  patch: NodeUpdate,
): CanvasData;

/** Remove a node AND any edges that reference it. */
export function removeNode(canvas: CanvasData, nodeId: string): CanvasData;
```

`generateNodeId` uses `crypto.randomUUID()` when available, else a random base36 string.

Consumers: `onNodeDelete` gives you just the id — call `removeNode(canvas, id)` (or do your own edge cleanup).

### `packages/react/src/components/SystemCanvas.tsx`

New props:

```ts
// --- Editing ---
editable?: boolean
canvases?: Record<string, CanvasData>

onNodeAdd?: (node: CanvasNode, canvasRef: string | undefined) => void
onNodeUpdate?: (nodeId: string, patch: NodeUpdate, canvasRef: string | undefined) => void
onNodeDelete?: (nodeId: string, canvasRef: string | undefined) => void

/** Fully replace the default FAB. */
renderAddNodeButton?: (props: AddNodeButtonRenderProps) => React.ReactNode
```

Selection state lives here: `const [selectedId, setSelectedId] = useState<string | null>(null)`. Passed down to `Viewport` → `NodeRenderer` → node components. Cleared on background click and on Escape.

The outer `<div>` gets `tabIndex={0}` + `style={{ outline: 'none' }}` + `onKeyDown` handler for Delete/Backspace/Escape. (We do **not** attach to window — that would hijack keys from other page inputs.)

### `packages/react/src/hooks/useNavigation.ts`

See refactor above. Consumers of the hook directly (if any) get `currentCanvasRef` added to the return type.

### `packages/react/src/components/AddNodeButton.tsx` (new)

Default FAB (bottom-right), styled like breadcrumbs. Click opens a popover:

- "Categories" section: one item per merged category (theme + canvas-level), with color swatch and icon. Uses `getNodeMenuOptions`.
- Divider.
- "Basic" section: text, file, link, group.

Clicking an option calls `addNode(option)` which:

1. Computes viewport center in canvas-space (uses `svgRef.getBoundingClientRect()` + current `ViewportState` via `screenToCanvas`).
2. Applies a small cascade offset for rapid successive adds within ~1.5s (+20, +20 each).
3. Calls `createNodeFromOption(option, x, y)`.
4. Fires `onNodeAdd(node, currentCanvasRef)`.

Render-prop API:

```ts
interface AddNodeButtonRenderProps {
  options: NodeMenuOption[];
  addNode: (
    option: NodeMenuOption,
    position?: { x: number; y: number },
  ) => void;
  theme: CanvasTheme;
}
```

### `packages/react/src/hooks/useNodeDrag.ts` (new)

Pointer-event drag.

- `onPointerDown(node, event)`: captures pointer, stores start pos + original x/y.
- `onPointerMove`: computes canvas-space delta (`dx / viewport.zoom`), updates a local override map `{ [nodeId]: { x, y } }` via state. If the node is a group, also moves its contained children (computed once at drag-start via `getGroupChildren`).
- `onPointerUp`: fires `onNodeUpdate(id, {x, y}, canvasRef)` for the dragged node and each moved child. Clears the override map.

Override-cleanup strategy: clear on pointerup. If the consumer re-renders slowly, a single-frame flicker is possible but acceptable. Do not try to reconcile override vs. prop — simpler is better.

Returns: `{ dragOverrides: Map<string, {x, y}>, onPointerDown: (node, event) => void, isDragging: boolean }`.

Nodes currently being edited (see editor below) do not receive drag pointerdown — the editor's `foreignObject` captures the event.

### `packages/react/src/components/NodeEditor.tsx` (new)

Inline editor in a `<foreignObject>` positioned over the node.

- `type='text'` → `<textarea>` editing `node.text` (multi-line preserved).
- `type='file'` → `<input>` editing `node.file`.
- `type='link'` → `<input>` editing `node.url`.
- `type='group'` → `<input>` editing `node.label`.

Behavior:

- Opens on double-click when `editable`.
- Commits on blur or `Enter` (Shift+Enter inserts newline in textarea).
- Cancels on `Escape`.
- Fires `onNodeUpdate(id, patch, canvasRef)` on commit; no-op on cancel.
- Stops propagation of pointer events so drag doesn't trigger.

### `packages/react/src/components/Viewport.tsx`

- Accept `editable`, `selectedId`, `editingId`, drag overrides, and the edit/select/drag callback set.
- Apply drag overrides when mapping nodes to components (`node.x, node.y` replaced by override if present).
- Render `NodeEditor` on top for `editingId`.

### `packages/react/src/components/{Text,File,Link,Group}Node.tsx`

Each accepts:

- `isSelected?: boolean` — when true, render a thin outline using `theme.node.labelColor` at low opacity outside the existing stroke.
- `isEditing?: boolean` — when true, hide the label text(s); editor covers it.
- `onPointerDown?: (node, event) => void` — for drag.

Z-order for new nodes: appended at end of `canvas.nodes`. Groups are filtered first in `NodeRenderer` regardless of array order, so adding a non-group puts it on top; adding a group puts it behind other groups added later but always behind non-groups.

### `packages/react/src/hooks/useCanvasInteraction.ts`

No new state (selection lives in `SystemCanvas`). Changes:

- Accept `editable`, `selectedId`, `setSelectedId`, `editingId`, `setEditingId`, `onNavigableNodeClick`.
- `handleNodeClick` in editable mode: `setSelectedId(node.id)`, fire `onNodeClick`. Skip navigation.
- `handleNodeClick` in non-editable mode: unchanged (navigate if `isNavigable`).
- `handleNodeDoubleClick` in editable mode: fire `onNodeDoubleClick`. Then if `isNavigable`, call `onNavigableNodeClick`; else `setEditingId(node.id)`.
- `handleCanvasClick` (new): `setSelectedId(null)` + `setEditingId(null)`.

### `packages/react/src/index.ts`

Export:

- `AddNodeButton` component.
- `useNodeDrag` hook.
- New types: `NodeMenuOption`, `NodeUpdate`, `AddNodeButtonRenderProps` (re-exported from core where applicable).

### `demo/src/main.tsx`

- Hold `canvases: Record<string, CanvasData>` in `useState`. The root is stored under a sentinel key (e.g. `"__root__"`) or as a separate `rootCanvas` state.
- `onResolveCanvas(ref)` reads from state (still async to preserve the loading indicator demo, or switch to sync via `canvases` prop — use `canvases` prop and drop the async path).
- `onNodeAdd/Update/Delete` handlers: use `addNode / updateNode / removeNode` core helpers keyed on `canvasRef` (or root).
- Pass `editable` and `canvases`.

---

## Edge cases & open questions (resolved unless noted)

1. **New node IDs.** `generateNodeId()` in core.
2. **Dropping a node on a group.** No special handling — group membership is spatial via `getGroupChildren`.
3. **Group drag moves children.** Move set = `getGroupChildren(group, nodesAtDragStart)` computed once. Includes nested groups (and their children, transitively, because they're spatially contained). Emits one `onNodeUpdate` per moved node. No batched `onNodesUpdate` in v1.
4. **Edit on link/file nodes.** Free-form text; no validation in library.
5. **Subpath on file nodes.** Not exposed in default editor; consumers can add via their own UI.
6. **Deleting a navigated-into node.** Consumer's responsibility to pop the breadcrumb if desired. Library does not auto-pop.
7. **Zoom during drag.** Deltas computed as `dx / viewport.zoom` in canvas-space.
8. **Touch / pen.** Pointer events handle it.
9. **Keyboard scope.** `tabIndex={0}` on outer div; no window listener.
10. **Editor vs. drag interaction.** Editor's `foreignObject` stops propagation; drag handler on nodes ignores events when that node is being edited.
11. **Drag override flicker.** Clear override on pointerup; accept a possible single-frame flicker if consumer re-render is slow.
12. **Text node multi-line.** `<textarea>` preserves multi-line content (mainLabel + sublabel + any further lines).

### Known issues shipped with v1

- **Breadcrumb labels don't live-update after edit.** If a node in the breadcrumb trail has its label/text edited, the trail still shows the old label (captured at navigation time). Fix later by re-resolving labels from `canvases` each render.
- **Rapid-add overlap.** Cascade offset helps but nodes can still stack if the user adds many. Acceptable.
- **No undo/redo** (consumer's concern).

---

## Verification

No unit tests in this repo. Verification via:

- `npm run typecheck` — must pass.
- `npm run build` — must succeed.
- `npm run dev` — manual smoke test in the demo:
  - Add node (category + each base type) on root and on a sub-canvas.
  - Drag a node; drag a group (children move).
  - Double-click each node type to edit; Enter commits, Escape cancels.
  - Select + Delete removes the node and its edges.
  - Navigation still works non-editably after disabling `editable`.

---

## Implementation order

1. Core: `NodeType` untouched; add `type?` to `CategoryDefinition`; add `NodeUpdate`, `NodeMenuOption`; add `generateNodeId`, `getNodeMenuOptions`, `createNodeFromOption`, `addNode`, `updateNode`, `removeNode`; export from `index.ts`.
2. `useNavigation` refactor: ref-stack + `canvases` map preference. Verify existing demo still works (still non-editable).
3. `SystemCanvas` new props + selection state + `tabIndex` + key handler (wired to no-op if `!editable`).
4. FAB + `onNodeAdd`. Verify add from demo (after demo converts).
5. `useNodeDrag` + node component integration. Verify drag.
6. `NodeEditor` + double-click routing. Verify edit.
7. Selected outline + Delete. Verify.
8. Demo conversion to `useState` + helpers.
9. Typecheck, build, smoke test.

---

## Out of scope for this pass

- Creating edges by dragging between nodes.
- Editing edge label / style / endpoints.
- Undo/redo.
- Multi-select, marquee select.
- Copy/paste.
- Resizing nodes with handles.
- Editing a node's category/color via the UI.
- Live breadcrumb label updates after edit.
