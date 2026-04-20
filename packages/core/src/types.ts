// ---------------------------------------------------------------------------
// JSON Canvas spec types (with system-canvas extensions)
// ---------------------------------------------------------------------------

/** Preset color "1"-"6" or a hex string like "#FF0000" */
export type CanvasColor = string

export type NodeType = 'text' | 'file' | 'link' | 'group'
export type Side = 'top' | 'right' | 'bottom' | 'left'
export type EndShape = 'none' | 'arrow'
export type EdgeStyle = 'bezier' | 'straight' | 'orthogonal'
export type BackgroundStyle = 'cover' | 'ratio' | 'repeat'

/**
 * A node on the canvas.
 *
 * `width` and `height` are optional when a `category` is set — the category's
 * default dimensions (defined in the theme) will be used as fallback.
 */
export interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  width?: number
  height?: number
  color?: CanvasColor

  // --- Extension: category (maps to theme category definitions) ---
  category?: string

  // --- Extension: sub-canvas reference ---
  ref?: string

  // --- Type-specific fields ---
  /** type: 'text' — markdown content */
  text?: string
  /** type: 'file' — path to a file */
  file?: string
  /** type: 'file' — subpath (heading/block), starts with # */
  subpath?: string
  /** type: 'link' — URL */
  url?: string
  /** type: 'group' — label text */
  label?: string
  /** type: 'group' — background image path */
  background?: string
  /** type: 'group' — background rendering style */
  backgroundStyle?: BackgroundStyle

  /**
   * Free-form pass-through data for consumer-specific fields that the
   * library does not need to understand (e.g. `status`, `owner`, `progress`,
   * `dueDate`). Survives round-trips through the library's mutation helpers
   * and is emitted back to the consumer via the update callbacks.
   */
  customData?: Record<string, any>
}

/** An edge connecting two nodes. */
export interface CanvasEdge {
  id: string
  fromNode: string
  fromSide?: Side
  fromEnd?: EndShape
  toNode: string
  toSide?: Side
  /** Defaults to 'arrow' */
  toEnd?: EndShape
  color?: CanvasColor
  label?: string
  /** Per-edge routing style override */
  style?: EdgeStyle
}

/**
 * Canvas-level theme hint. Allows a canvas document to declare
 * a base theme and inline category definitions so that LLM-generated
 * canvases are fully self-describing.
 */
export interface CanvasThemeHint {
  /** Name of a built-in base theme: "dark", "midnight", "light", "blueprint", "warm" */
  base?: string
  /** Inline category definitions, merged into the active theme's categories */
  categories?: Record<string, CategoryDefinition>
}

/**
 * A named band on the canvas. Columns are vertical bands (positioned along x);
 * rows are horizontal bands (positioned along y).
 *
 * Lanes are a pure rendering/snapping primitive — the library has no opinion
 * on what they represent. Consumers use them for roadmap columns
 * (Now/Next/Later, Q1/Q2/Q3, phase names, date ranges), swim-lane teams,
 * kanban groupings, or any other ordinal or positional labeling.
 */
export interface CanvasLane {
  id: string
  label: string
  /**
   * Position along the lane axis, in canvas-space. For a column this is its
   * left edge (x); for a row it is its top edge (y).
   */
  start: number
  /** Extent along the lane axis (width for columns, height for rows). */
  size: number
  /** Optional preset "1"-"6" or hex color override for the band fill. */
  color?: CanvasColor
}

/** A JSON Canvas document (with system-canvas extensions). */
export interface CanvasData {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  /** Optional theme hint — lets the document declare categories and a preferred base theme */
  theme?: CanvasThemeHint
  /** Vertical bands rendered behind nodes. Consumer defines what they mean. */
  columns?: CanvasLane[]
  /** Horizontal bands rendered behind nodes. Consumer defines what they mean. */
  rows?: CanvasLane[]
}

// ---------------------------------------------------------------------------
// Theme types
// ---------------------------------------------------------------------------

export interface CategoryDefinition {
  defaultWidth: number
  defaultHeight: number
  fill: string
  stroke: string
  cornerRadius?: number
  /** Icon identifier — rendered inside the node */
  icon?: string | null
  /**
   * The JSON Canvas node type to create when this category is chosen from
   * the add-node menu. Defaults to 'text'.
   */
  type?: NodeType

  /**
   * Declarative visual add-ons rendered in library-owned positional regions
   * on nodes of this category. See `SlotPosition` and `SlotSpec`.
   */
  slots?: CategorySlots

  /**
   * Per-category toolbar override. When present, fully replaces the theme's
   * default `nodeActions` for nodes of this category (no merge). Use
   * `buildDefaultToolbar(theme)` to spread the theme default explicitly.
   */
  toolbar?: NodeActionGroup[]

  /**
   * Per-category inline editor schema. When present, the node editor renders
   * a multi-field form instead of the single-field text/input. Falls through
   * to the single-field editor when absent.
   */
  editableFields?: EditableField[]

  /**
   * Seed `customData` for new nodes created from this category via the
   * add-node menu. Deep-cloned per instance (via `structuredClone`) so two
   * new nodes never share nested object/array references.
   */
  defaultCustomData?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Category slots — declarative visual add-ons rendered in library-owned
// positional regions. Kind and position are orthogonal: every region accepts
// every kind.
// ---------------------------------------------------------------------------

/**
 * A library-owned positional region on a node. Each category slot maps to
 * exactly one of these positions; each position holds at most one slot.
 *
 *   - `topEdge`, `bottomEdge`, `leftEdge`, `rightEdge` — thin strips along
 *     the node's perimeter.
 *   - `topLeft`, `topRight`, `bottomLeft`, `bottomRight` — small square
 *     corner badges, inset from the corner.
 *   - `header`, `footer` — full-width inset strips inside the top / bottom
 *     of the node. Cause text to reflow.
 */
export type SlotPosition =
  | 'topEdge'
  | 'bottomEdge'
  | 'leftEdge'
  | 'rightEdge'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'header'
  | 'footer'
  /**
   * A horizontal band sitting just below the header (or just below the
   * top of the content box when no header is present). Sized like a
   * single-line row — intended for inline progress bars under a title,
   * divider strips, sparklines, etc. Does not reflow text.
   */
  | 'bodyTop'
  /**
   * Hangs off the top-right corner of the node, partially outside its
   * bounding box. Designed for notification-style tab badges (e.g. a
   * count that clips into the node's stroke). Lets a node carry both a
   * `topRight` status pill AND a tab badge without collision.
   */
  | 'topRightOuter'

export type CategorySlots = Partial<Record<SlotPosition, SlotSpec>>

export type SlotSpec =
  | ColorSlot
  | ProgressSlot
  | CountSlot
  | TextSlot
  | DotSlot
  | PillSlot
  | CustomSlot

/**
 * Flat color fill of the region.
 *
 * On edge-strip positions (`topEdge` / `bottomEdge` / `leftEdge` /
 * `rightEdge`), defaults to a *short, pinned* strip that covers only part
 * of the edge (~55%, pinned to start). Set `extent: 'full'` to force a
 * full-width strip.
 *
 * `color` is optional — when omitted the slot inherits `node.resolvedStroke`,
 * so it automatically follows toolbar color changes.
 */
export interface ColorSlot {
  kind: 'color'
  color?: NodeAccessor<string>
  /**
   * Edge-strip extent. `'short'` (default on edge positions) draws a
   * ~55%-length strip pinned to the start (left/top). `'full'` draws a
   * strip across the whole edge, from one rounded-corner tangent to the
   * other. Ignored for non-edge positions.
   */
  extent?: 'short' | 'full'
  /** Optional fractional length for `extent: 'short'`. Defaults to 0.55. */
  length?: NodeAccessor<number>
}

/**
 * Uppercase pill-style status tag — slim rounded rect with a tinted fill
 * and colored text. Use for OK / ATTN / RISK tags, or any short badge
 * label. Text is rendered uppercase with letter-spacing.
 *
 * `color` is optional — when omitted the pill inherits `node.resolvedStroke`.
 */
export interface PillSlot {
  kind: 'pill'
  value: NodeAccessor<string>
  /** Accent color — drives both the subtle fill tint and the text color. */
  color?: NodeAccessor<string>
  /** Override the text color (defaults to `color`). */
  textColor?: NodeAccessor<string>
  /** Override the fill (defaults to `color` at ~15% alpha). */
  fill?: NodeAccessor<string>
}

/**
 * Horizontal progress bar. Value is clamped to 0..1.
 *
 * `color` is optional — defaults to `node.resolvedStroke`.
 */
export interface ProgressSlot {
  kind: 'progress'
  value: NodeAccessor<number>
  color?: NodeAccessor<string>
  bgColor?: NodeAccessor<string>
}

/**
 * Count / badge. Renders a pill with a number or short string.
 *
 * `color` is optional — defaults to `node.resolvedStroke`.
 */
export interface CountSlot {
  kind: 'count'
  value: NodeAccessor<number | string>
  color?: NodeAccessor<string>
  textColor?: NodeAccessor<string>
  /** When true (default), the badge is hidden when value resolves to 0 or ''. */
  hideWhenEmpty?: boolean
}

/** Small text label inside the region. */
export interface TextSlot {
  kind: 'text'
  value: NodeAccessor<string>
  color?: NodeAccessor<string>
}

/**
 * A small solid dot centered in the region (typically a corner).
 *
 * `color` is optional — defaults to `node.resolvedStroke`.
 */
export interface DotSlot {
  kind: 'dot'
  color?: NodeAccessor<string>
}

/**
 * Escape hatch for arbitrary SVG inside the region. The library still owns
 * positioning (the region `Rect` is provided via `ctx.region`), paint order,
 * and ref-indicator collision.
 */
export interface CustomSlot {
  kind: 'custom'
  render: (ctx: SlotContext) => unknown
}

/** A value or a function that computes the value from a `SlotContext`. */
export type NodeAccessor<T> = T | ((ctx: SlotContext) => T)

/**
 * Context passed to slot accessors and `custom` renderers. Scoped to one
 * node instance and one region.
 */
export interface SlotContext {
  node: ResolvedNode
  theme: CanvasTheme
  /** The region rect this slot is rendering into (canvas-space). */
  region: SlotRect
  /** Resolve a sub-canvas by ref (synchronous canvases map + async cache). */
  getSubCanvas: (ref: string) => CanvasData | undefined
  canvases?: Record<string, CanvasData>
  /**
   * Rollup scoped to this node's sub-canvas. Equivalent to
   * `rollupNodes(getSubCanvas(node.ref), predicate)`. Returns zeros when
   * the node has no ref or the sub-canvas is unresolved.
   */
  rollup: (predicate: (n: CanvasNode) => boolean) => RollupResult
}

/**
 * Axis-aligned rectangle in canvas-space. Duplicated from `rendering/` so
 * core's data-model module has no cross-package import cycles.
 */
export interface SlotRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Result of rolling up descendant nodes against a predicate. Returned by
 * `rollupNodes` / `rollupNodesDeep` and by `SlotContext.rollup`.
 */
export interface RollupResult {
  /** Total nodes considered. */
  total: number
  /** Nodes matching the predicate. */
  matched: number
  /** `matched / total`, or 0 when `total === 0`. */
  fraction: number
}

// ---------------------------------------------------------------------------
// Editable fields — per-category form schema for the inline editor
// ---------------------------------------------------------------------------

export type EditableFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'boolean'

export interface EditableField {
  /**
   * Dot-path into the node. Top-level fields like `'text'`, `'label'`,
   * `'file'`, `'url'`, or nested like `'customData.status'`.
   */
  path: string
  kind: EditableFieldKind
  label?: string
  /** Options for `kind: 'select'`. */
  options?: Array<{ value: string; label?: string }>
  /** Numeric constraints for `kind: 'number'`. */
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export interface PresetColor {
  fill: string
  stroke: string
}

export interface GridConfig {
  size: number
  color: string
  strokeWidth: number
}

export interface RefIndicatorConfig {
  icon: 'chevron' | 'arrow' | 'expand' | 'none'
  /** Resting glyph color */
  color: string
  /**
   * Hover fill of the carved square. Defaults to `node.labelColor` at 18%.
   * Any valid CSS color (rgba/hex/named).
   */
  hoverFill?: string
  /** Hover glyph color. Defaults to `theme.background` (inverted on the fill). */
  hoverColor?: string
}

export interface NodeTheme {
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
  labelColor: string
  sublabelColor: string
  /**
   * Primary font stack for monospace / data-style text (file paths,
   * footer metrics, counts). Used by everything unless a specific
   * consumer overrides it.
   */
  fontFamily: string
  /**
   * Optional display-font stack for node titles and header kickers.
   * Defaults to `fontFamily` so existing themes are unchanged. Swap in
   * a sans-serif here for an app-style / dashboard look while keeping
   * numbers and metrics monospaced.
   */
  labelFont?: string
  fontSize: number
  sublabelFontSize: number
  refIndicator: RefIndicatorConfig
}

export interface EdgeTheme {
  stroke: string
  strokeWidth: number
  arrowSize: number
  labelColor: string
  labelFontSize: number
}

export interface GroupTheme {
  fill: string
  stroke: string
  strokeWidth: number
  strokeDasharray: string
  labelColor: string
  labelFontSize: number
  cornerRadius: number
}

export interface BreadcrumbTheme {
  background: string
  textColor: string
  activeColor: string
  separatorColor: string
  fontFamily: string
  fontSize: number
}

export interface LanesTheme {
  /** Fill color for odd-indexed bands (0, 2, 4, ...). */
  bandFillEven: string
  /** Fill color for even-indexed bands (1, 3, 5, ...). */
  bandFillOdd: string
  /** Color of the divider line drawn between bands. */
  dividerColor: string
  dividerWidth: number
  /** Header (pinned label) styling */
  headerBackground: string
  headerTextColor: string
  headerFontFamily: string
  headerFontSize: number
  /** Thickness of the sticky header strip, in screen pixels. */
  headerSize: number
  /** Padding between header text and the band edge, in screen pixels. */
  headerPadding: number
}

/**
 * A single action that a user can trigger on a selected node via the
 * floating node toolbar. Each action carries its own visual treatment and
 * the patch it applies — themes declare these so the library can render a
 * generic toolbar without knowing the consumer's domain.
 *
 * The library has no opinion about what actions represent. Common uses:
 *   - Status toggles (planned / in-progress / done) via `customData` patches
 *   - Category switchers (initiative / milestone / service / database)
 *   - Color palettes tied to `color` or `customData`
 *   - Priority markers, owners, tags — anything the consumer can express
 *     as a patch to a CanvasNode.
 */
export interface NodeAction {
  /** Stable id, unique within its group. */
  id: string
  /** Human-readable label used as tooltip text. */
  label: string
  /**
   * Optional icon key — looked up in the theme's `icons` map (or the built-in
   * set). Renders inside a button-style action.
   */
  icon?: string
  /**
   * Optional swatch color — renders as a small colored dot/pill. Use for
   * status/color palette groups.
   */
  swatch?: string
  /**
   * Patch to apply when the action is triggered. Can be a static patch or
   * a function that receives the current node and returns one (for toggles,
   * cycles, or "merge customData" behaviors).
   */
  patch: NodeUpdate | ((node: CanvasNode) => NodeUpdate)
  /**
   * Optional predicate — when present, the action is only rendered for
   * nodes that match. Useful for category-specific actions.
   */
  appliesTo?: (node: CanvasNode) => boolean
  /**
   * Optional predicate — when present and true, the action is rendered as
   * "active" (e.g. a highlighted swatch). Use this to reflect the node's
   * current state in the toolbar.
   */
  isActive?: (node: CanvasNode) => boolean
}

/**
 * A group of related NodeActions, rendered together in the toolbar.
 * Groups are separated by a divider.
 */
export interface NodeActionGroup {
  /** Stable id, unique within the theme. */
  id: string
  /** Optional heading shown above the group (or as a tooltip). */
  label?: string
  /**
   * Visual treatment:
   *   - `'swatches'` — a row of colored dots (good for color palettes and status)
   *   - `'buttons'` — icon buttons in a row
   *   - `'menu'` — a dropdown/popover with labels (good for longer lists like categories)
   */
  kind?: 'swatches' | 'buttons' | 'menu'
  actions: NodeAction[]
}

export interface CanvasTheme {
  name: string
  background: string
  grid: GridConfig
  node: NodeTheme
  edge: EdgeTheme
  group: GroupTheme
  breadcrumbs: BreadcrumbTheme
  lanes: LanesTheme
  /** Map preset colors "1"-"6" to fill/stroke */
  presetColors: Record<string, PresetColor>
  /** Map category strings to visual definitions */
  categories: Record<string, CategoryDefinition>
  /**
   * Custom icons, merged over the built-in icon set. Each value is an array
   * of SVG path `d` strings authored in a 16x16 coordinate space — matching
   * the coordinate system used by the built-in icons. Useful for shipping
   * domain-specific glyphs via the theme without forking the library.
   */
  icons?: Record<string, string[]>
  /**
   * Action groups shown in the floating node toolbar when a node is selected
   * in editable mode. When omitted, the library falls back to a generic
   * color-swatch group derived from `presetColors`.
   */
  nodeActions?: NodeActionGroup[]
  /**
   * When true, suppress the trailing delete button in the node toolbar.
   * Defaults to false (delete button shown). Consumers who want a custom
   * delete action (confirmation dialog, soft-delete, etc.) can hide the
   * built-in button and add their own via `nodeActions`.
   */
  hideToolbarDelete?: boolean
}

// ---------------------------------------------------------------------------
// Resolved / computed types (used internally by renderers)
// ---------------------------------------------------------------------------

/** A node with all dimensions resolved (category defaults applied). */
export interface ResolvedNode extends CanvasNode {
  width: number
  height: number
  /** Resolved fill color */
  resolvedFill: string
  /** Resolved stroke color */
  resolvedStroke: string
  /** Resolved corner radius */
  resolvedCornerRadius: number
  /** Whether this node has a sub-canvas ref */
  isNavigable: boolean
  /** Resolved icon identifier (from category or null) */
  resolvedIcon: string | null
}

/** A computed point on a node's edge. */
export interface AnchorPoint {
  x: number
  y: number
}

/** Viewport transform state. */
export interface ViewportState {
  x: number
  y: number
  zoom: number
}

/** Breadcrumb entry for navigation. */
export interface BreadcrumbEntry {
  label: string
  ref?: string
}

/** The bounding box of all nodes on a canvas. */
export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Component prop types (used by system-canvas-react)
// ---------------------------------------------------------------------------

export interface ContextMenuEvent {
  type: 'node' | 'edge' | 'canvas'
  target?: CanvasNode | CanvasEdge
  position: { x: number; y: number }
}

// ---------------------------------------------------------------------------
// Editing types
// ---------------------------------------------------------------------------

/** A partial update to an existing node (x/y/text/label/url/file/etc.). */
export type NodeUpdate = Partial<Omit<CanvasNode, 'id' | 'type'>>

/** A partial update to an existing edge (label/color/style/endpoints/etc.). */
export type EdgeUpdate = Partial<Omit<CanvasEdge, 'id'>>

/** An entry in the add-node menu. */
export interface NodeMenuOption {
  kind: 'category' | 'type'
  /** For kind='category': the category key. For kind='type': the NodeType. */
  value: string
  label: string
  icon?: string | null
  fill?: string
  stroke?: string
  /**
   * The resolved JSON Canvas node type for this option.
   * Matches category.type (or 'text' if unset) for categories,
   * or the NodeType itself for base types.
   */
  nodeType: NodeType
}
