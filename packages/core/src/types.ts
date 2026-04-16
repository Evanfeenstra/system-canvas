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

/** A JSON Canvas document (with system-canvas extensions). */
export interface CanvasData {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
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
  color: string
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

export interface CanvasTheme {
  name: string
  background: string
  grid: GridConfig
  node: NodeTheme
  edge: EdgeTheme
  group: GroupTheme
  breadcrumbs: BreadcrumbTheme
  /** Map preset colors "1"-"6" to fill/stroke */
  presetColors: Record<string, PresetColor>
  /** Map category strings to visual definitions */
  categories: Record<string, CategoryDefinition>
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
