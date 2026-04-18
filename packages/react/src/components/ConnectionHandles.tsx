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
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
const HANDLE_RADIUS = 4
const HANDLE_HIT_RADIUS = 10
const FADE_DELAY_MS = 300
const FADE_DURATION_MS = 150

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

  return (
    <g
      className="system-canvas-connection-handles"
      pointerEvents="auto"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
      }}
    >
      {SIDES.map((side) => {
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
              r={isHovered ? HANDLE_RADIUS + 1 : HANDLE_RADIUS}
              fill={handleColor}
              pointerEvents="none"
            />
          </g>
        )
      })}
    </g>
  )
}
