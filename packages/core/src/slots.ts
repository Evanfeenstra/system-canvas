import type {
  CanvasTheme,
  CategoryDefinition,
  CategorySlots,
  NodeAccessor,
  ResolvedNode,
  SlotContext,
  SlotPosition,
  SlotRect,
  SlotSpec,
} from './types.js'

// ---------------------------------------------------------------------------
// Region geometry
//
// Regions are library-owned rectangles on a node, in canvas-space. Sizes
// that scale with text use `em` units relative to `theme.node.fontSize`;
// edge thicknesses and insets are in px because they're visual details.
// ---------------------------------------------------------------------------

const CORNER_INSET = 8
const CORNER_EM = 1.25
const HEADER_EM = 1.0
const FOOTER_EM = 1.0
const HEADER_INSET_X = 14
const HEADER_INSET_Y = 10
const FOOTER_INSET_Y = 10
/**
 * Edge-strip thicknesses. Sized so a `progress` slot reads as a
 * real progress bar (not a 2px hairline) while still feeling like a
 * strip, not a bar chart.
 */
const TOP_EDGE_PX = 5
const RIGHT_EDGE_PX = 4
const LEFT_EDGE_PX = 4
/** Bottom-edge strip gets a bit more weight so progress bars read. */
const BOTTOM_EDGE_MIN_PX = 6
const BOTTOM_EDGE_HEIGHT_RATIO = 0.08
/** Corner-tab badge — hangs off the top-right corner. */
const TAB_BADGE_EM = 1.4
/** How far the tab badge floats above the node's top edge (in px). */
const TAB_BADGE_LIFT = 10
/** How far the tab badge extends past the node's right edge (in px). */
const TAB_BADGE_OVERHANG = 8

/**
 * Compute the region rect (in canvas-space) for every slot position on a
 * resolved node. Pure geometry — no knowledge of which slots are actually
 * in use. Callers index by `SlotPosition`.
 */
export function computeCategorySlotRegions(
  node: ResolvedNode,
  theme: CanvasTheme,
  slots?: CategorySlots
): Record<SlotPosition, SlotRect> {
  const { x, y, width, height } = node
  const fs = theme.node.fontSize
  const corner = CORNER_EM * fs
  const header = HEADER_EM * fs
  const footer = FOOTER_EM * fs
  const tab = TAB_BADGE_EM * fs
  const bottomEdge = Math.max(
    BOTTOM_EDGE_MIN_PX,
    Math.round(height * BOTTOM_EDGE_HEIGHT_RATIO)
  )
  // Body region is the reflow-aware content rect: the full node box minus
  // any header/footer/edge reservations contributed by other slots. We
  // compute this from `slots` if provided, otherwise default to the full
  // content area minus standard padding. The body region never shrinks to
  // accommodate itself — only sibling slots influence it.
  const bodyReservations = computeBodyReservations(node, theme, slots)
  const bodyX = x + bodyReservations.left
  const bodyY = y + bodyReservations.top
  const bodyWidth = Math.max(0, width - bodyReservations.left - bodyReservations.right)
  const bodyHeight = Math.max(0, height - bodyReservations.top - bodyReservations.bottom)
  // Edge regions span the full edge of the node. The `CategorySlotsLayer`
  // wraps edge-slot output in a clipPath that matches the node's rounded
  // rect, so solid fills and progress bars bleed naturally under the
  // corners instead of leaving a visible gap.
  return {
    topEdge: {
      x,
      y,
      width,
      height: TOP_EDGE_PX,
    },
    bottomEdge: {
      x,
      y: y + height - bottomEdge,
      width,
      height: bottomEdge,
    },
    leftEdge: {
      x,
      y,
      width: LEFT_EDGE_PX,
      height,
    },
    rightEdge: {
      x: x + width - RIGHT_EDGE_PX,
      y,
      width: RIGHT_EDGE_PX,
      height,
    },
    bodyTop: (() => {
      // Horizontal band intended for inline progress bars, divider
      // strips, sparklines, etc.
      //
      // Vertical placement depends on whether a `header` slot is
      // declared on the same category:
      //
      //   - **With header** (dashboard pattern): the band sits
      //     directly below the header strip with a small breathing
      //     gap. Body content (title text) reflows BELOW the band —
      //     `computeBodyReservations` accounts for this so wrapped
      //     titles never collide.
      //
      //   - **Without header** (legacy status-card pattern): the
      //     band floats one line of body text below the top edge,
      //     overlapping the body region. Default label rendering
      //     centers within the remaining body space, producing the
      //     "title above, bar below" look the showcase expects.
      //
      // The header-present branch is the one users tend to want when
      // they pair `header` + `bodyTop` on the same card; without it,
      // a wrapped/multi-line body collides with the bar (the bug
      // this branch fixes).
      const hasHeader = slots?.header !== undefined
      const bandHeight = Math.max(4, Math.round(fs * 0.35))
      const bandY = hasHeader
        ? // Just below the header strip. Header height is ~fs + 4
          // and sits at HEADER_INSET_Y; pad another small gap so the
          // bar reads as decoration rather than a divider line.
          y + HEADER_INSET_Y + fs + 6
        : // Legacy: under one line of body text.
          y + HEADER_INSET_Y + fs + Math.round(fs * 0.9)
      return {
        x: x + HEADER_INSET_X,
        y: bandY,
        width: Math.max(0, width - HEADER_INSET_X * 2),
        height: bandHeight,
      }
    })(),
    topRightOuter: {
      // Hangs off the top-right corner. The region extends past the
      // node's right edge so the badge reads as a notification tab
      // clinging to the outside of the corner rather than sitting on
      // top of the node.
      x: x + width - tab + TAB_BADGE_OVERHANG,
      y: y - TAB_BADGE_LIFT,
      width: tab,
      height: tab,
    },
    topLeft: {
      x: x + CORNER_INSET,
      y: y + CORNER_INSET,
      width: corner,
      height: corner,
    },
    topRight: {
      x: x + width - CORNER_INSET - corner,
      y: y + CORNER_INSET,
      width: corner,
      height: corner,
    },
    bottomLeft: {
      x: x + CORNER_INSET,
      y: y + height - CORNER_INSET - corner,
      width: corner,
      height: corner,
    },
    bottomRight: {
      x: x + width - CORNER_INSET - corner,
      y: y + height - CORNER_INSET - corner,
      width: corner,
      height: corner,
    },
    header: {
      x: x + HEADER_INSET_X,
      y: y + HEADER_INSET_Y,
      width: Math.max(0, width - HEADER_INSET_X * 2),
      height: header,
    },
    footer: {
      x: x + HEADER_INSET_X,
      y: y + height - FOOTER_INSET_Y - footer,
      width: Math.max(0, width - HEADER_INSET_X * 2),
      height: footer,
    },
    body: {
      x: bodyX,
      y: bodyY,
      width: bodyWidth,
      height: bodyHeight,
    },
  }
}

/**
 * Reservations used to compute the `body` region. Mirrors
 * `computeReflowReservations` but excludes the body slot itself from
 * triggering the dashboard padding — the body owns the reflowed area
 * regardless of whether decorative slots are present.
 */
function computeBodyReservations(
  node: ResolvedNode,
  theme: CanvasTheme,
  slots: CategorySlots | undefined
): ReflowReservations {
  // Fall back to standard content padding when there are no slots.
  if (!slots) {
    return {
      top: HEADER_INSET_Y,
      bottom: FOOTER_INSET_Y,
      left: HEADER_INSET_X,
      right: HEADER_INSET_X,
    }
  }
  const r = computeReflowReservationsInternal(node, theme, slots)
  let top = Math.max(r.top, HEADER_INSET_Y)

  // When `bodyTop` is paired with a `header`, the band sits directly
  // below the header strip (see `computeCategorySlotRegions`'s
  // `bodyTop` branch). Reserve enough body-region top inset that
  // body content (e.g. wrapped title text in a custom `body` slot)
  // starts BELOW the band rather than colliding with it.
  //
  // We deliberately skip this reservation when there's no header: in
  // that case `bodyTop` overlaps the body region by design, and the
  // default label rendering centers within the remaining space (the
  // showcase status-card pattern).
  if (slots.bodyTop && slots.header) {
    const fs = theme.node.fontSize
    const bandHeight = Math.max(4, Math.round(fs * 0.35))
    // Mirror the same geometry as `computeCategorySlotRegions`'s
    // bodyTop branch: header-bottom (HEADER_INSET_Y + fs + 6) + band
    // height + a small gap for breathing room before body text.
    const bandBottomFromTop = HEADER_INSET_Y + fs + 6 + bandHeight + 6
    top = Math.max(top, bandBottomFromTop)
  }

  // Always apply standard body padding so the body slot aligns with
  // header/footer insets even when no other slots are present.
  return {
    top,
    bottom: Math.max(r.bottom, FOOTER_INSET_Y),
    left: Math.max(r.left, HEADER_INSET_X),
    right: Math.max(r.right, HEADER_INSET_X),
  }
}

/** Return true for `NodeAccessor` values that are functions. */
function isFn<T>(v: NodeAccessor<T>): v is (ctx: SlotContext) => T {
  return typeof v === 'function'
}

/**
 * Resolve an accessor against a `SlotContext`. Function accessors are
 * called; static values are returned as-is.
 */
export function resolveAccessor<T>(accessor: NodeAccessor<T>, ctx: SlotContext): T {
  return isFn(accessor) ? accessor(ctx) : accessor
}

/**
 * Resolve an accessor with a fallback for the function case. Useful when
 * a slot renders a default from the theme but allows per-call overrides.
 */
export function resolveAccessorOr<T>(
  accessor: NodeAccessor<T> | undefined,
  fallback: T,
  ctx: SlotContext
): T {
  if (accessor === undefined) return fallback
  return resolveAccessor(accessor, ctx)
}

/**
 * Look up the slots map for a node's category. Returns undefined when the
 * node has no category, or the category has no slots declared.
 */
export function getCategorySlots(
  node: ResolvedNode,
  theme: CanvasTheme
): CategorySlots | undefined {
  if (!node.category) return undefined
  const def: CategoryDefinition | undefined = theme.categories[node.category]
  return def?.slots
}

// ---------------------------------------------------------------------------
// Ref-indicator collision
// ---------------------------------------------------------------------------

type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

/**
 * Pick a corner for the ref indicator given which slots are occupied.
 *
 * If the default corner is free, it wins. Otherwise we try the diagonally
 * opposite corner, then the remaining two corners in clockwise order from
 * the default. If all four corners are occupied we keep the default
 * position — the caller can decide whether to log a dev warning.
 *
 * Corners occupied by `header` or `footer` count as occupied on *both*
 * corners of that row: a header in the top strip blocks both `topLeft` and
 * `topRight` (the indicator would overlap the header text strip anyway).
 */
export function pickRefIndicatorCorner(
  defaultCorner: Corner,
  slots: CategorySlots | undefined
): Corner {
  if (!slots) return defaultCorner

  const occupied = (c: Corner): boolean => {
    if (slots[c]) return true
    if ((c === 'topLeft' || c === 'topRight') && slots.header) return true
    if ((c === 'bottomLeft' || c === 'bottomRight') && slots.footer) return true
    // A tab badge hanging off the top-right blocks the topRight corner.
    if (c === 'topRight' && slots.topRightOuter) return true
    return false
  }

  if (!occupied(defaultCorner)) return defaultCorner

  // Search order: diagonal, then the remaining two in clockwise order.
  const order: Record<Corner, Corner[]> = {
    topLeft: ['bottomRight', 'topRight', 'bottomLeft'],
    topRight: ['bottomLeft', 'bottomRight', 'topLeft'],
    bottomLeft: ['topRight', 'topLeft', 'bottomRight'],
    bottomRight: ['topLeft', 'bottomLeft', 'topRight'],
  }
  for (const c of order[defaultCorner]) {
    if (!occupied(c)) return c
  }
  return defaultCorner
}

// ---------------------------------------------------------------------------
// Iteration helper
// ---------------------------------------------------------------------------

/**
 * Iterate over a slots map in a deterministic order. Returns entries as
 * `[position, spec]` pairs. Order matches the `SlotPosition` definition —
 * stable across runs so SVG paint order is stable.
 */
export function slotEntries(
  slots: CategorySlots
): Array<[SlotPosition, SlotSpec]> {
  const positions: SlotPosition[] = [
    'topEdge',
    'bottomEdge',
    'leftEdge',
    'rightEdge',
    'header',
    'footer',
    'body',
    'bodyTop',
    'topLeft',
    'topRight',
    'bottomLeft',
    'bottomRight',
    // Outer positions paint last so they visually sit above the node's
    // own stroke — a tab badge needs to clip into the node's corner.
    'topRightOuter',
  ]
  const out: Array<[SlotPosition, SlotSpec]> = []
  for (const p of positions) {
    const s = slots[p]
    if (s) out.push([p, s])
  }
  return out
}

// ---------------------------------------------------------------------------
// Text-reflow reservations
// ---------------------------------------------------------------------------

export interface ReflowReservations {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Compute how many pixels of the node's content box must be reserved on
 * each side for library-owned slots so node text/icons can be reflowed
 * without colliding with slots.
 *
 *   - `header`  → shift text down by header region height + inset
 *   - `footer`  → shrink text vertical extent by footer region height + inset
 *   - `leftEdge` / `rightEdge` → inset text by the edge strip width
 *
 * Top/bottom edges and corner slots don't reflow text (they're thin strips
 * or small badges that sit over the existing layout). If the node is so
 * short that reservations would leave less than `fontSize` vertical space
 * for text, the reflow is skipped (text stays centered).
 */
export function computeReflowReservations(
  node: ResolvedNode,
  theme: CanvasTheme,
  slots: CategorySlots | undefined
): ReflowReservations {
  return computeReflowReservationsInternal(node, theme, slots)
}

/**
 * Shared reservation computation used by `computeReflowReservations` (for
 * text/icon reflow) and by body-region geometry. Kept private so the
 * public API surface stays small.
 */
function computeReflowReservationsInternal(
  node: ResolvedNode,
  theme: CanvasTheme,
  slots: CategorySlots | undefined
): ReflowReservations {
  if (!slots) return { top: 0, bottom: 0, left: 0, right: 0 }

  // Compute header/footer/edge base regions without the body inset. We
  // deliberately pass `undefined` so this recursive call doesn't re-enter
  // the body-region logic (which itself calls this function).
  const regions = computeCategorySlotRegions(node, theme)
  let top = 0
  let bottom = 0
  let left = 0
  let right = 0

  if (slots.header) top = regions.header.height + HEADER_INSET_Y + 6
  if (slots.footer) bottom = regions.footer.height + FOOTER_INSET_Y + 4
  if (slots.leftEdge) left = regions.leftEdge.width + 4
  if (slots.rightEdge) right = regions.rightEdge.width + 4
  // A `topLeft` dot reads as an inline status marker next to the title,
  // not a corner badge — reserve enough left padding that the title
  // clears the dot region.
  if (slots.topLeft && slots.topLeft.kind === 'dot') {
    left = Math.max(left, regions.topLeft.x + regions.topLeft.width - node.x + 6)
  }

  // Dashboard-card pattern: whenever the node has "dashboard" signals
  // (an explicit header, a top-right pill, an inline bodyTop strip, an
  // inline topLeft dot, or a footer row), pin the title to the top,
  // left-align it, and apply standard body padding so the body text
  // aligns with the header's inset.
  const isDashboard =
    slots.header !== undefined ||
    slots.topRight !== undefined ||
    slots.bodyTop !== undefined ||
    slots.footer !== undefined ||
    (slots.topLeft !== undefined && slots.topLeft.kind === 'dot')
  if (isDashboard) {
    if (!slots.header) top = Math.max(top, HEADER_INSET_Y)
    // Baseline body padding — matches `HEADER_INSET_X` so the title,
    // sublabel, and header text all share the same left edge. Without
    // this, text renders flush against the node's rounded stroke.
    left = Math.max(left, HEADER_INSET_X)
    right = Math.max(right, HEADER_INSET_X)
  }
  // A topRight pill steals additional real estate from the title — on
  // top of the baseline padding, reserve a band wide enough for a short
  // 4-char tag ("RISK" / "ATTN" / "OK").
  if (slots.topRight && slots.topRight.kind === 'pill') {
    right = Math.max(right, Math.round(theme.node.fontSize * 3.6))
  }

  // Bail if reservations would eat all the text space.
  const vertSpace = node.height - top - bottom
  if (vertSpace < theme.node.fontSize) {
    top = 0
    bottom = 0
  }
  const horSpace = node.width - left - right
  if (horSpace < theme.node.fontSize) {
    left = 0
    right = 0
  }

  return { top, bottom, left, right }
}
