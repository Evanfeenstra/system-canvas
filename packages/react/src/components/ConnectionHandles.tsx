import React, { useEffect, useState } from 'react'
import type { ResolvedNode, CanvasTheme, Side } from 'system-canvas'
import { computeAnchorPoint } from 'system-canvas'

interface ConnectionHandlesProps {
  node: ResolvedNode
  theme: CanvasTheme
  onHandlePointerDown: (
    node: ResolvedNode,
    side: Side,
    event: React.PointerEvent
  ) => void
  /**
   * When true, skip the fade-in delay and render at full opacity
   * immediately (used while a connection drag is already in progress).
   */
  immediate?: boolean
  /**
   * Which side (if any) is currently closest to the cursor. When set, only
   * that side's handle is rendered. When null/undefined, no side-handles
   * render (unless `immediate` is true, in which case all four render so the
   * source handle remains visible during a drag).
   */
  activeSide?: Side | null
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
const HANDLE_RADIUS = 4
const HANDLE_HIT_RADIUS = 10
const FADE_DELAY_MS = 300
const FADE_DURATION_MS = 150
/**
 * Scale factor applied to the handle circle when the pointer is directly
 * over it. Animated via CSS `transform` (SVG's `r` attribute can't be
 * CSS-transitioned reliably across browsers, but `transform` can).
 */
const HOVER_SCALE = 1.42
const HOVER_TRANSITION_MS = 120

/**
 * Four small circular handles, one centered on each side of the node.
 * Pressing a handle begins an edge-creation drag.
 *
 * Fades in after a 300ms delay to avoid flashing during mouse fly-throughs.
 * Handles are solid-filled in the node's own stroke color; hovering an
 * individual handle grows it slightly.
 */
export function ConnectionHandles({
  node,
  theme,
  onHandlePointerDown,
  immediate,
  activeSide,
}: ConnectionHandlesProps) {
  const [visible, setVisible] = useState<boolean>(!!immediate)
  const [hoveredSide, setHoveredSide] = useState<Side | null>(null)

  useEffect(() => {
    if (immediate) {
      setVisible(true)
      return
    }
    setVisible(false)
    const t = window.setTimeout(() => setVisible(true), FADE_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [node.id, immediate])

  const handleColor = node.resolvedStroke ?? theme.node.labelColor

  // While a drag is in progress (`immediate`), render all four sides so the
  // source handle stays put. Otherwise render only the side closest to the
  // cursor (or nothing when no side is active).
  const sidesToRender: Side[] = immediate
    ? SIDES
    : activeSide
      ? [activeSide]
      : []

  return (
    <g
      className="system-canvas-connection-handles"
      pointerEvents="auto"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
      }}
    >
      {sidesToRender.map((side) => {
        const { x, y } = computeAnchorPoint(node, side)
        const isHovered = hoveredSide === side
        return (
          <g
            key={side}
            style={{ cursor: 'crosshair' }}
            onPointerEnter={() => setHoveredSide(side)}
            onPointerLeave={() => setHoveredSide((s) => (s === side ? null : s))}
            onPointerDown={(e) => {
              // Stop propagation so the node's own drag/click doesn't fire.
              e.stopPropagation()
              onHandlePointerDown(node, side, e)
            }}
          >
            {/* Invisible wider hit target */}
            <circle cx={x} cy={y} r={HANDLE_HIT_RADIUS} fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={HANDLE_RADIUS}
              fill={handleColor}
              pointerEvents="none"
              style={{
                // Scale around the handle's own center. CSS transforms on
                // SVG elements use the element's user-space origin by
                // default, so we set transform-origin explicitly.
                transformOrigin: `${x}px ${y}px`,
                transform: isHovered ? `scale(${HOVER_SCALE})` : 'scale(1)',
                transition: `transform ${HOVER_TRANSITION_MS}ms ease-out`,
              }}
            />
          </g>
        )
      })}
    </g>
  )
}
