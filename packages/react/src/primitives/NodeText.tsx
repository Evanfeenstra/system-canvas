import React from 'react'
import type { CanvasTheme, SlotRect } from 'system-canvas'

interface NodeTextProps {
  region: SlotRect
  value: string
  theme: CanvasTheme
  color?: string
  align?: 'start' | 'center' | 'end'
  fontWeight?: number
  /**
   * Render the label uppercase with letter-spacing. Useful for kicker
   * headers like `CUSTOMER` / `REVENUE`.
   */
  uppercase?: boolean
  /**
   * Use the theme's `labelFont` (display font) rather than `fontFamily`.
   * Defaults to `false` so footer metrics etc. stay monospace.
   */
  useLabelFont?: boolean
  /** Override the font family directly. */
  fontFamily?: string
  /** Override the font size (in px). */
  fontSize?: number
}

/**
 * Small text label inside a slot region. Used for headers, footers,
 * and any other in-slot text.
 */
export function NodeText({
  region,
  value,
  theme,
  color,
  align = 'start',
  fontWeight = 500,
  uppercase = false,
  useLabelFont = false,
  fontFamily,
  fontSize: fontSizeProp,
}: NodeTextProps) {
  if (!value) return null

  const fontSize =
    fontSizeProp ??
    Math.max(9, Math.min(theme.node.fontSize - 2, region.height * 0.85))
  const anchor: 'start' | 'middle' | 'end' =
    align === 'start' ? 'start' : align === 'center' ? 'middle' : 'end'
  const x =
    align === 'start'
      ? region.x
      : align === 'center'
        ? region.x + region.width / 2
        : region.x + region.width
  const y = region.y + region.height / 2 + fontSize * 0.36

  const font =
    fontFamily ??
    (useLabelFont ? theme.node.labelFont ?? theme.node.fontFamily : theme.node.fontFamily)

  return (
    <text
      x={x}
      y={y}
      fill={color ?? theme.node.sublabelColor}
      fontSize={fontSize}
      fontWeight={fontWeight}
      fontFamily={font}
      textAnchor={anchor}
      letterSpacing={uppercase ? 0.8 : 0.2}
      pointerEvents="none"
    >
      {uppercase ? value.toUpperCase() : value}
    </text>
  )
}
