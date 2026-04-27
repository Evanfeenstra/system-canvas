import React, { useId, useMemo } from 'react'
import type {
  CanvasData,
  CanvasNode,
  CanvasTheme,
  CategorySlots,
  ResolvedNode,
  SlotContext,
  SlotPosition,
  SlotSpec,
} from 'system-canvas'
import {
  computeCategorySlotRegions,
  getCategorySlots,
  resolveAccessor,
  resolveAccessorOr,
  rollupNodes,
  slotEntries,
} from 'system-canvas'
import { NodeColorFill } from '../primitives/NodeColorFill.js'
import { NodeProgressBar } from '../primitives/NodeProgressBar.js'
import { NodeCountBadge } from '../primitives/NodeCountBadge.js'
import { NodeDot } from '../primitives/NodeDot.js'
import { NodeText } from '../primitives/NodeText.js'
import { NodeStatusPill } from '../primitives/NodeStatusPill.js'

interface CategorySlotsLayerProps {
  node: ResolvedNode
  theme: CanvasTheme
  /** Synchronous map used to resolve sub-canvases for rollups. */
  canvases?: Record<string, CanvasData>
  /** Optional pre-computed slots (falls back to looking up the category). */
  slots?: CategorySlots
}

/**
 * Renders the category slots for a single node. Computes regions, runs
 * accessors, and dispatches to the appropriate primitive per `kind`.
 *
 * Emits nothing (no `<g>`) when the node's category has no slots. All slot
 * primitives set `pointerEvents="none"` internally so they never steal
 * clicks from the node body or the ref indicator.
 */
export function CategorySlotsLayer({
  node,
  theme,
  canvases,
  slots: slotsProp,
}: CategorySlotsLayerProps) {
  const slots = slotsProp ?? getCategorySlots(node, theme)
  const regions = useMemo(
    () => computeCategorySlotRegions(node, theme, slots),
    [node, theme, slots]
  )
  // Stable, render-scoped id for the edge clipPath so multiple nodes on
  // the same canvas don't collide on `#clip-edge`.
  const reactId = useId()
  const clipId = `sc-edge-clip-${reactId.replace(/:/g, '')}`
  if (!slots) return null

  // Resolver used by slot context — pure lookup into the canvases map.
  const getSubCanvas = (ref: string): CanvasData | undefined => canvases?.[ref]

  const entries = slotEntries(slots)
  if (entries.length === 0) return null

  // Split into edge vs non-edge slots. Edge slots paint clipped to the
  // node's rounded rect so fills bleed under the corners without
  // overflowing. Non-edge slots paint unclipped.
  const edgeEntries = entries.filter(([p]) => isEdgePosition(p))
  const otherEntries = entries.filter(([p]) => !isEdgePosition(p))

  const renderEntry = ([position, spec]: [SlotPosition, SlotSpec]) => {
    const region = regions[position]
    const ctx: SlotContext = {
      node,
      theme,
      region,
      getSubCanvas,
      canvases,
      rollup: (predicate: (n: CanvasNode) => boolean) =>
        node.ref
          ? rollupNodes(getSubCanvas(node.ref), predicate)
          : { total: 0, matched: 0, fraction: 0 },
    }
    return <SlotView key={position} position={position} spec={spec} ctx={ctx} />
  }

  return (
    <g className="system-canvas-slots" pointerEvents="none">
      {edgeEntries.length > 0 && (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={node.resolvedCornerRadius}
              />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>{edgeEntries.map(renderEntry)}</g>
        </>
      )}
      {otherEntries.map(renderEntry)}
    </g>
  )
}

function isEdgePosition(p: SlotPosition): boolean {
  return (
    p === 'topEdge' ||
    p === 'bottomEdge' ||
    p === 'leftEdge' ||
    p === 'rightEdge'
  )
}

function SlotView({
  position,
  spec,
  ctx,
}: {
  position: SlotPosition
  spec: SlotSpec
  ctx: SlotContext
}) {
  try {
    return renderSlot(position, spec, ctx)
  } catch (err) {
    const env = (globalThis as any).process?.env?.NODE_ENV
    if (env !== 'production') {
      console.warn('[system-canvas] slot render failed', position, err)
    }
    return null
  }
}

function renderSlot(
  position: SlotPosition,
  spec: SlotSpec,
  ctx: SlotContext
): React.ReactNode {
  const { theme, node, region } = ctx

  // Universal color inheritance: when a slot omits `color`, it follows
  // the node's resolved stroke. This makes toolbar color changes
  // propagate naturally to every color-bearing slot (top strips, pills,
  // dots, badges, progress bars).
  const nodeColor = node.resolvedStroke

  switch (spec.kind) {
    case 'color': {
      const color = resolveAccessorOr(spec.color, nodeColor, ctx)
      const length = resolveAccessorOr<number>(spec.length, 0.55, ctx)
      return (
        <NodeColorFill
          region={region}
          color={color}
          position={position}
          extent={spec.extent}
          length={length}
        />
      )
    }
    case 'progress': {
      const value = resolveAccessor(spec.value, ctx)
      // `hideWhenZero` lets cards skip the empty track when there's no
      // signal yet (e.g. a milestone with zero linked features). The
      // empty track would otherwise read as "0% complete" rather than
      // "no data."
      if (spec.hideWhenZero && (!Number.isFinite(value) || value <= 0)) {
        return null
      }
      const color = resolveAccessorOr(spec.color, nodeColor, ctx)
      const bgColor = resolveAccessorOr(spec.bgColor, 'rgba(255,255,255,0.08)', ctx)
      return (
        <NodeProgressBar
          region={region}
          value={value}
          color={color}
          bgColor={bgColor}
        />
      )
    }
    case 'count': {
      const raw = resolveAccessor(spec.value, ctx)
      const hideWhenEmpty = spec.hideWhenEmpty !== false
      if (hideWhenEmpty) {
        if (raw === 0 || raw === '' || raw == null) return null
      }
      const color = resolveAccessorOr(spec.color, nodeColor, ctx)
      const textColor = resolveAccessorOr(spec.textColor, theme.background, ctx)
      return (
        <NodeCountBadge
          region={region}
          value={raw}
          theme={theme}
          color={color}
          textColor={textColor}
          position={position}
        />
      )
    }
    case 'pill': {
      const value = resolveAccessor(spec.value, ctx)
      if (!value) return null
      const color = resolveAccessorOr(spec.color, nodeColor, ctx)
      const textColor = spec.textColor
        ? resolveAccessor(spec.textColor, ctx)
        : undefined
      const fill = spec.fill ? resolveAccessor(spec.fill, ctx) : undefined
      return (
        <NodeStatusPill
          region={region}
          value={value}
          theme={theme}
          color={color}
          textColor={textColor}
          fill={fill}
        />
      )
    }
    case 'text': {
      const value = resolveAccessor(spec.value, ctx)
      const color = resolveAccessorOr(
        spec.color,
        position === 'body' ? theme.node.labelColor : theme.node.sublabelColor,
        ctx
      )
      // Position-aware alignment default — headers/footers left-align,
      // body left-aligns (title-style), everything else centers.
      const defaultAlign: 'start' | 'center' | 'end' =
        position === 'header' || position === 'footer' || position === 'body'
          ? 'start'
          : 'center'
      const align: 'start' | 'center' | 'end' = spec.align ?? defaultAlign
      // Headers read as kickers — uppercase, letter-spaced, bolder,
      // rendered in the label font. Body text reads as a title / figure —
      // label-font, bolder, not uppercase. Callers can override any of
      // these via explicit TextSlot fields.
      const isHeader = position === 'header'
      const isBody = position === 'body'
      const defaultWeight = isHeader ? 700 : isBody ? 600 : 500
      const defaultUppercase = isHeader
      const defaultUseLabelFont = isHeader || isBody
      const defaultFontSize = isBody
        ? Math.round(theme.node.fontSize * 1.35)
        : undefined
      const fontSize =
        spec.fontSize !== undefined
          ? resolveAccessor(spec.fontSize, ctx)
          : defaultFontSize
      const fontWeight =
        spec.fontWeight !== undefined
          ? resolveAccessor(spec.fontWeight, ctx)
          : defaultWeight
      const fontFamily =
        spec.fontFamily !== undefined
          ? resolveAccessor(spec.fontFamily, ctx)
          : undefined
      // Wrapping defaults: `body` text wraps by default (title pattern);
      // every other position renders single-line. Honors `\n` either way.
      const wrap = spec.wrap ?? isBody
      const lineHeight =
        spec.lineHeight !== undefined
          ? resolveAccessor(spec.lineHeight, ctx)
          : undefined
      const fill =
        spec.fill !== undefined ? resolveAccessor(spec.fill, ctx) : undefined
      return (
        <NodeText
          region={region}
          value={value}
          theme={theme}
          color={color}
          fill={fill}
          align={align}
          fontWeight={fontWeight}
          uppercase={spec.uppercase ?? defaultUppercase}
          useLabelFont={spec.useLabelFont ?? defaultUseLabelFont}
          fontFamily={fontFamily}
          fontSize={fontSize}
          wrap={wrap}
          maxLines={spec.maxLines}
          lineHeight={lineHeight}
        />
      )
    }
    case 'dot': {
      const color = resolveAccessorOr(spec.color, nodeColor, ctx)
      return <NodeDot region={region} color={color} />
    }
    case 'custom': {
      return spec.render(ctx) as React.ReactNode
    }
  }
}
