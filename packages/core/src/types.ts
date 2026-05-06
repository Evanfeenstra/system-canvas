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
 *   - `body` — the main content area (same rect the default label would
 *     occupy, minus header/footer/edge reservations). When present, the
 *     default label is suppressed and the category owns body rendering.
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
   * The node's main content area — the same rect that the default label
   * would be drawn into, shrunk by any header/footer/edge reservations.
   * When a category declares a `body` slot, the default label rendering
   * is suppressed and the slot owns the main text area entirely. Use for
   * big numeric figures (`$142k`), styled titles, or any main-body
   * visual that can't be expressed through decorative slots alone.
   */
  | 'body'
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
 *
 * `hideWhenZero`, when true, skips rendering the bar entirely (track and
 * fill) when `value` resolves to 0. Useful for cards that should only
 * show progress once a denominator exists — the empty track would
 * otherwise read as "0% complete" rather than "no data yet."
 */
export interface ProgressSlot {
  kind: 'progress'
  value: NodeAccessor<number>
  color?: NodeAccessor<string>
  bgColor?: NodeAccessor<string>
  hideWhenZero?: boolean
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

/**
 * Linear-gradient fill spec for a `TextSlot`. When set as `TextSlot.fill`,
 * the library generates a `<linearGradient>` def keyed by node id and
 * paints text glyphs with `url(#…)`.
 *
 * `angle` is in degrees, 0 = left-to-right (default), 90 = top-to-bottom.
 */
export interface LinearGradientFill {
  from: string
  to: string
  /** In degrees. 0 = horizontal left→right (default). */
  angle?: number
}

/**
 * Text label inside the region. Sized as a small kicker by default, but
 * can be enlarged via `fontSize` for use in a `body` slot (large headline
 * figures like `$142k`) or styled independently per-position.
 *
 * `align` defaults to `start` for `header` / `footer` / `body`, `center`
 * otherwise. `uppercase` / `useLabelFont` default to `true` for `header`
 * (kicker styling) and `false` elsewhere.
 *
 * **Wrapping.** When `wrap` is `true` (default for `body` position, false
 * elsewhere) the value is word-wrapped to fit `region.width`, splitting
 * on `\n` to honor explicit paragraph breaks. The result is rendered as
 * a single `<text>` element with one `<tspan>` per line and clipped to
 * the region rect so overflow never escapes the node.
 *
 * **Gradient fill.** When `fill` is set to `{ from, to, angle? }`, the
 * library defines a per-node `<linearGradient>` and paints the text with
 * it. Useful for the "vision card" headline pattern. Plain `color`
 * overrides apply only to the solid-fill case.
 */
export interface TextSlot {
  kind: 'text'
  value: NodeAccessor<string>
  color?: NodeAccessor<string>
  /**
   * Optional gradient fill. When set, takes precedence over `color`.
   * Static or per-node (function) — keyed gradients are scoped per node id.
   */
  fill?: NodeAccessor<LinearGradientFill>
  /** Font size in px. When omitted, uses a position-appropriate default. */
  fontSize?: NodeAccessor<number>
  /** Font weight (100–900). Defaults by position. */
  fontWeight?: NodeAccessor<number>
  /** Horizontal alignment inside the region. */
  align?: 'start' | 'center' | 'end'
  /** Render uppercase with letter-spacing (kicker styling). */
  uppercase?: boolean
  /**
   * Use the theme's `labelFont` (display font) rather than the body
   * `fontFamily`. Useful for headline figures in a `body` slot.
   */
  useLabelFont?: boolean
  /** Direct font-family override. Wins over `useLabelFont` when both set. */
  fontFamily?: NodeAccessor<string>
  /**
   * Word-wrap to `region.width`. Defaults to `true` for `body` position,
   * `false` elsewhere. `\n` always honors paragraph breaks regardless.
   */
  wrap?: boolean
  /**
   * Cap on rendered lines when `wrap` is true. Excess content is
   * truncated with an ellipsis. When omitted, all wrapped lines render
   * (clipped to the region rect by the slot layer).
   */
  maxLines?: number
  /**
   * Override the per-line vertical advance in px. Defaults to roughly
   * `fontSize * 1.25` so wrapped paragraphs read as a normal block of
   * text.
   */
  lineHeight?: NodeAccessor<number>
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
  /**
   * Edge length (px) of the carved square hit/visual region. Defaults to 18.
   * Increase for a more prominent / easier-to-tap "enter sub-canvas" affordance.
   * The inner glyph scales proportionally.
   */
  size?: number
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

/**
 * Visual styling for the floating node context menu (right-click on a node).
 *
 * The menu itself is opt-in: it only renders when the consumer passes a
 * `nodeContextMenu` config to `<SystemCanvas>`. When omitted from the theme,
 * the library falls back to a sensible dark-glass default that matches the
 * breadcrumb / add-node aesthetic.
 */
export interface ContextMenuTheme {
  /** Menu surface background. Usually a translucent slate. */
  background: string
  /** Border around the menu surface. */
  borderColor: string
  /** Border radius of the menu surface, in pixels. */
  borderRadius: number
  /** Default item text color. */
  itemColor: string
  /** Background color when an item is hovered. */
  itemHoverBackground: string
  /** Text color for items declared with `destructive: true`. */
  destructiveItemColor: string
  /** Font family for menu items. */
  fontFamily: string
  /** Font size for menu items, in pixels. */
  fontSize: number
  /** Vertical padding inside the menu surface, in pixels. */
  paddingY: number
  /** Horizontal padding inside the menu surface, in pixels. */
  paddingX: number
  /** Vertical padding inside each item, in pixels. */
  itemPaddingY: number
  /** Horizontal padding inside each item, in pixels. */
  itemPaddingX: number
  /** Box-shadow CSS string applied to the menu surface. */
  shadow: string
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
  /**
   * Styling for the floating node context menu surfaced when the consumer
   * passes a `nodeContextMenu` config to `<SystemCanvas>`. Optional; the
   * library substitutes a dark-glass default when omitted, so existing
   * themes don't need to opt in to keep working.
   */
  contextMenu?: ContextMenuTheme
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
   * When true, append the built-in trailing delete button to the node
   * toolbar. Defaults to false (no delete button) — the library is opinion-
   * free about destructive actions, and most consumers want a confirmation
   * dialog, soft-delete, or a custom delete action wired via `nodeActions`
   * rather than a one-click trash icon. Users can always delete a selected
   * node with the Delete/Backspace keys regardless of this flag.
   */
  showToolbarDelete?: boolean
  /**
   * Horizontal alignment of the floating node toolbar relative to the
   * selected node's top edge. `'center'` (default) anchors the toolbar's
   * center to the node's center; `'left'` anchors its left edge to the
   * node's left edge; `'right'` anchors its right edge to the node's right
   * edge. The toolbar still flips below the node when it would clip the
   * top of the viewport, and is clamped to the viewport bounds in all modes.
   */
  toolbarAlign?: 'left' | 'center' | 'right'
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

/**
 * Unified selection state surfaced to consumers via `onSelectionChange`.
 *
 * The library tracks one selection at a time — a single node OR a single
 * edge OR nothing. Clicking one kind clears the other (handled inside
 * `useCanvasInteraction`), so consumers never observe a "both selected"
 * state. Use this single callback in preference to inferring deselection
 * from peripheral events (`onNodeClick`, `onEdgeClick`, `onNavigate`):
 * those fire on activation; `onSelectionChange` fires on every actual
 * change to the selection (activation OR deactivation), including
 * background-click deselect, Escape, navigation, and post-delete clears.
 *
 * `canvasRef` matches the rest of the library's callbacks: the ref of the
 * canvas the selected entity lives on, `undefined` for the root canvas.
 *
 * Selection is editable-only — non-editable canvases never select
 * anything, so consumers receive at most a single trailing `null` if
 * they toggle `editable` off while something was selected.
 */
export type CanvasSelection =
  | { kind: 'node'; node: CanvasNode; canvasRef: string | undefined }
  | { kind: 'edge'; edge: CanvasEdge; canvasRef: string | undefined }
  | null

export interface ContextMenuEvent {
  type: 'node' | 'edge' | 'canvas'
  target?: CanvasNode | CanvasEdge
  /**
   * Position of the right-click in canvas-space (post-pan/zoom). Useful
   * for placing a node-relative annotation or computing distances against
   * other canvas content.
   */
  position: { x: number; y: number }
  /**
   * Position of the right-click in viewport-space (raw clientX/clientY).
   * Use this when rendering a `position: fixed` floating menu — canvas
   * coordinates would be wrong because they'd shift as the user pans/zooms.
   */
  screenPosition: { x: number; y: number }
}

// ---------------------------------------------------------------------------
// Declarative node context menu
//
// A consumer can pass a `nodeContextMenu` config to `<SystemCanvas>` and the
// library will render a small floating menu when the user right-clicks a
// node. Items are declared once and filtered per-node via `match` predicates.
// This is the high-level API; consumers who need full control can still
// implement their own menu using the raw `onContextMenu` callback.
// ---------------------------------------------------------------------------

/**
 * Context passed to a context-menu item's `match` predicate so it can decide
 * whether to surface for the right-clicked node. Carries only what the
 * library knows for free; consumer-owned data (like the user's role)
 * should be closed over by the predicate itself.
 */
export interface NodeContextMenuMatchContext {
  /** Ref of the canvas the node lives on. `null` for the root canvas. */
  canvasRef: string | null
}

/**
 * One row in the node context menu. Items are filtered per-node by the
 * optional `match` predicate before the menu renders; items that don't
 * match are silently dropped, and a node with zero matching items skips
 * the menu entirely (no empty popover, no swallowed right-click — the
 * browser's default menu still won't appear because the library
 * preventDefault's all node right-clicks).
 */
export interface NodeContextMenuItem {
  /** Stable identifier echoed back to `onSelect`. */
  id: string
  /** Visible label. */
  label: string
  /**
   * Optional icon key — looked up in the theme's `icons` map (or the
   * built-in set), drawn at 14×14 to the left of the label.
   */
  icon?: string
  /**
   * When true, the item is rendered with `destructiveItemColor` from the
   * theme. Purely cosmetic — the consumer's `onSelect` is still
   * responsible for any confirmation flow.
   */
  destructive?: boolean
  /**
   * Filter predicate: which nodes does this item appear on?
   *
   *   - `categories`: match nodes whose `category` is in this list.
   *   - `types`:      match nodes whose `type` is in this list.
   *   - `when(node, ctx)`: arbitrary predicate; receives the right-clicked
   *     node and the canvas ref it lives on.
   *
   * Multiple shortcuts are ANDed together — an item with both
   * `categories` and `when` only shows when both pass. Omitting `match`
   * entirely matches every node.
   */
  match?: {
    categories?: string[]
    types?: NodeType[]
    when?: (node: CanvasNode, ctx: NodeContextMenuMatchContext) => boolean
  }
  /**
   * Optional per-node disabled state. The item still renders (so users see
   * what's available) but is non-clickable and visually muted.
   */
  disabled?: (node: CanvasNode, ctx: NodeContextMenuMatchContext) => boolean
}

/**
 * Context passed to `onSelect` when the user picks an item. Includes the
 * screen position of the original right-click so the consumer can spawn a
 * follow-up popover or dialog at the same spot.
 */
export interface NodeContextMenuSelectContext extends NodeContextMenuMatchContext {
  screenPosition: { x: number; y: number }
}

/**
 * Top-level config for the declarative node context menu.
 */
export interface NodeContextMenuConfig {
  /**
   * All possible items, in display order. Filtered per-node via each
   * item's `match` predicate before render.
   */
  items: NodeContextMenuItem[]
  /**
   * Called when the user clicks an item. Receives the item id, the
   * right-clicked node, and a context with the canvas ref + screen
   * position. The consumer typically dispatches on `itemId` to open a
   * dialog, fire an API call, or mutate the canvas.
   */
  onSelect: (
    itemId: string,
    node: CanvasNode,
    ctx: NodeContextMenuSelectContext
  ) => void
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
