import React from 'react'
import type { CanvasTheme, SlotPosition, SlotRect } from 'system-canvas'

interface NodeCountBadgeProps {
  region: SlotRect
  value: number | string
  theme: CanvasTheme
  color?: string
  textColor?: string
  /**
   * The slot position. `'topRightOuter'` renders a notched tab-style
   * badge that hangs off the node's top-right corner. Any other position
   * renders a simple rounded pill centered in the region.
   */
  position?: SlotPosition
}

/**
 * Count / notification badge.
 *
 * - In `topRightOuter`: a small notched *tab* that hangs off the top-right
 *   corner, clipping slightly into the node's stroke. Matches the
 *   notification-badge pattern.
 * - Anywhere else: a centered rounded pill.
 */
export function NodeCountBadge({
  region,
  value,
  theme,
  color,
  textColor,
  position,
}: NodeCountBadgeProps) {
  const label = typeof value === 'number' ? String(value) : value
  if (label.length === 0) return null

  const fill = color ?? theme.node.refIndicator.color
  const text = textColor ?? theme.background

  if (position === 'topRightOuter') {
    return (
      <TabBadge region={region} label={label} fill={fill} text={text} theme={theme} />
    )
  }

  return <PillBadge region={region} label={label} fill={fill} text={text} theme={theme} />
}

function TabBadge({
  region,
  label,
  fill,
  text,
  theme,
}: {
  region: SlotRect
  label: string
  fill: string
  text: string
  theme: CanvasTheme
}) {
  // Size the tab to the region (a ~1.4em square). Single-digit values fit
  // the square; multi-character values allow the tab to widen leftward.
  const h = region.height
  const minW = h
  const fontSize = Math.max(9, h * 0.58)
  const estW = label.length <= 1 ? minW : Math.max(minW, fontSize * 0.7 * label.length + 10)
  const w = Math.min(estW, h * 3)
  // Pin to the region's right edge; extend leftward if it widened.
  const x = region.x + region.width - w
  const y = region.y
  const rx = Math.min(6, h / 3)
  const cx = x + w / 2
  const cy = y + h / 2
  // Ring the badge in the canvas background color so it reads as a
  // separate element when it sits directly over a same-colored top strip.
  // Stroke is drawn with a slightly larger rect behind the fill so the
  // visible corner radius stays crisp.
  const ringWidth = 2
  return (
    <g pointerEvents="none">
      <rect
        x={x - ringWidth}
        y={y - ringWidth}
        width={w + ringWidth * 2}
        height={h + ringWidth * 2}
        rx={rx + ringWidth}
        fill={theme.background}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={fill}
      />
      <text
        x={cx}
        y={cy + fontSize * 0.35}
        fill={text}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={theme.node.fontFamily}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  )
}

function PillBadge({
  region,
  label,
  fill,
  text,
  theme,
}: {
  region: SlotRect
  label: string
  fill: string
  text: string
  theme: CanvasTheme
}) {
  const fontSize = Math.max(9, Math.min(region.height * 0.7, 14))
  const estWidth = Math.max(
    region.height,
    region.height * 0.65 + label.length * fontSize * 0.55
  )
  const width = Math.min(estWidth, region.width * 1.6)
  const height = region.height
  const cx = region.x + region.width / 2
  const cy = region.y + region.height / 2
  const x = cx - width / 2
  const y = cy - height / 2

  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={height / 2}
        fill={fill}
      />
      <text
        x={cx}
        y={cy + fontSize * 0.35}
        fill={text}
        fontSize={fontSize}
        fontWeight={600}
        fontFamily={theme.node.fontFamily}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  )
}
