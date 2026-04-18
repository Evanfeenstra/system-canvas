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
  fontFamily: string
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
