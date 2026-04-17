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
const HANDLE_RADIUS = 5
const HANDLE_HIT_RADIUS = 9
const FADE_DELAY_MS = 300
const FADE_DURATION_MS = 150

/**
 * Four small circular handles, one centered on each side of the node.
 * Pressing a handle begins an edge-creation drag.
 *
 * Fades in after a 300ms delay to avoid flashing during mouse fly-throughs.
 * A wider invisible hit circle makes the handles easier to grab.
 */
export function ConnectionHandles({
  node,
  theme,
  onHandlePointerDown,
  immediate,
}: ConnectionHandlesProps) {
  // `visible` drives a CSS opacity transition. We start at 0, then after the
  // delay set it to 1 so the transition runs. Keyed on node.id so moving to a
  // different node restarts the timer.
  const [visible, setVisible] = useState<boolean>(!!immediate)

  useEffect(() => {
    if (immediate) {
      setVisible(true)
      return
    }
    setVisible(false)
    const t = window.setTimeout(() => setVisible(true), FADE_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [node.id, immediate])

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
        return (
          <g
            key={side}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              // Stop propagation so the node's own drag/click doesn't fire.
              e.stopPropagation()
              onHandlePointerDown(node, side, e)
            }}
          >
            {/* Invisible wider hit target */}
            <circle cx={x} cy={y} r={HANDLE_HIT_RADIUS} fill="transparent" />
            {/* Visible dot */}
            <circle
              cx={x}
              cy={y}
              r={HANDLE_RADIUS}
              fill={theme.background}
              stroke={theme.node.labelColor}
              strokeWidth={1.5}
              pointerEvents="none"
            />
          </g>
        )
      })}
    </g>
  )
}
