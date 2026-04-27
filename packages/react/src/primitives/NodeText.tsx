import React, { useId } from 'react'
import type { CanvasTheme, LinearGradientFill, SlotRect } from 'system-canvas'
import { wrapTextWithBreaks } from 'system-canvas'

interface NodeTextProps {
  region: SlotRect
  value: string
  theme: CanvasTheme
  color?: string
  /**
   * Optional gradient paint. When set, the component emits a per-instance
   * `<linearGradient>` def and uses `url(#…)` as the text fill, ignoring
   * `color`. Solid-color callers should pass `undefined` and rely on
   * `color` instead.
   */
  fill?: LinearGradientFill
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
  /**
   * Wrap value to fit `region.width`. When true, splits on `\n` and
   * word-wraps each paragraph; output renders as one `<text>` with one
   * `<tspan>` per line, clipped to the region rect.
   */
  wrap?: boolean
  /** Cap rendered lines when `wrap` is true. Excess truncated with ellipsis. */
  maxLines?: number
  /** Override per-line vertical advance in px. Defaults to ~fontSize * 1.25. */
  lineHeight?: number
}

/**
 * Text label inside a slot region. Used for headers, footers, body
 * titles, and any other in-slot text.
 *
 * Three rendering paths:
 *   1. **Single line, no wrap** — one `<text>` element (default for header
 *      / footer / corner positions).
 *   2. **Wrapped** — one `<text>` with `<tspan dy="…">` per wrapped line,
 *      clipped to the region rect (default for `body`-position text).
 *   3. **Gradient** — same as 1 or 2 but with a per-instance
 *      `<linearGradient>` def feeding the `fill` attribute.
 *
 * All paths set `pointerEvents="none"` so text never intercepts node clicks.
 */
export function NodeText({
  region,
  value,
  theme,
  color,
  fill,
  align = 'start',
  fontWeight = 500,
  uppercase = false,
  useLabelFont = false,
  fontFamily,
  fontSize: fontSizeProp,
  wrap = false,
  maxLines,
  lineHeight: lineHeightProp,
}: NodeTextProps) {
  // Stable id per render so multiple wrapped/gradient nodes never collide on
  // shared `<defs>`. `useId` returns a deterministic value for SSR/CSR.
  const reactId = useId()
  const safeId = reactId.replace(/:/g, '')

  if (!value) return null

  const fontSize =
    fontSizeProp ??
    Math.max(9, Math.min(theme.node.fontSize - 2, region.height * 0.85))
  const lineHeight = lineHeightProp ?? Math.round(fontSize * 1.25)
  const anchor: 'start' | 'middle' | 'end' =
    align === 'start' ? 'start' : align === 'center' ? 'middle' : 'end'
  const x =
    align === 'start'
      ? region.x
      : align === 'center'
        ? region.x + region.width / 2
        : region.x + region.width

  const font =
    fontFamily ??
    (useLabelFont
      ? theme.node.labelFont ?? theme.node.fontFamily
      : theme.node.fontFamily)

  // Gradient setup. Same id is used by the `fill` attr below.
  const gradId = fill ? `sc-text-grad-${safeId}` : undefined
  const fillAttr = gradId ? `url(#${gradId})` : color ?? theme.node.sublabelColor

  // Text content prep.
  const displayValue = uppercase ? value.toUpperCase() : value

  // ----- Single line -----
  if (!wrap) {
    const y = region.y + region.height / 2 + fontSize * 0.36
    return (
      <g pointerEvents="none">
        {fill && <GradientDef id={gradId!} fill={fill} />}
        <text
          x={x}
          y={y}
          fill={fillAttr}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontFamily={font}
          textAnchor={anchor}
          letterSpacing={uppercase ? 0.8 : 0.2}
          pointerEvents="none"
        >
          {displayValue}
        </text>
      </g>
    )
  }

  // ----- Wrapped -----
  // Reserve a tiny horizontal safety margin so the rough glyph-width
  // estimate doesn't push the last word past the rounded corner.
  const wrapInset = 4
  const wrapWidth = Math.max(0, region.width - wrapInset * 2)
  const lines = wrapTextWithBreaks(displayValue, wrapWidth, fontSize, maxLines)
  if (lines.length === 0) return null

  // Baseline anchor: top of region + one ascent. Subsequent lines use
  // `dy={lineHeight}` so SVG handles vertical advance natively.
  const baseY = region.y + fontSize
  const clipId = `sc-text-clip-${safeId}`

  return (
    <g pointerEvents="none">
      <defs>
        {fill && <GradientDef id={gradId!} fill={fill} />}
        <clipPath id={clipId}>
          <rect
            x={region.x}
            y={region.y}
            width={region.width}
            height={region.height}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        <text
          x={x}
          y={baseY}
          fill={fillAttr}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontFamily={font}
          textAnchor={anchor}
          letterSpacing={uppercase ? 0.8 : 0.2}
          pointerEvents="none"
        >
          {lines.map((line, i) => (
            <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  )
}

/**
 * Inline `<linearGradient>` def. Kept local because it's only meaningful
 * paired with a `<text fill="url(#id)">` reference in the same component.
 */
function GradientDef({ id, fill }: { id: string; fill: LinearGradientFill }) {
  // Translate angle (deg) to gradientTransform-friendly rotation. Default
  // 0 = horizontal (x1=0,y1=0 → x2=1,y2=0), 90 = vertical, etc.
  const angle = fill.angle ?? 0
  return (
    <linearGradient
      id={id}
      x1="0"
      y1="0"
      x2="1"
      y2="0"
      gradientUnits="objectBoundingBox"
      gradientTransform={angle ? `rotate(${angle} 0.5 0.5)` : undefined}
    >
      <stop offset="0%" stopColor={fill.from} />
      <stop offset="100%" stopColor={fill.to} />
    </linearGradient>
  )
}
