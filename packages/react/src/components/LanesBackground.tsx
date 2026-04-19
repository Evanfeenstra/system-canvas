import React from 'react'
import type { CanvasLane, CanvasTheme } from 'system-canvas'
import { resolveColor } from 'system-canvas'

// Lane bands extend far beyond the viewport along the non-lane axis
// so users never see an edge while panning. Matches the grid's "infinite"
// 100000x100000 rect trick.
const LANE_EXTENT = 100000

interface LanesBackgroundProps {
  columns?: CanvasLane[]
  rows?: CanvasLane[]
  theme: CanvasTheme
}

/**
 * Renders column/row bands in canvas-space. Sits inside the transformable
 * <g> so it pans and zooms with the content. Drawn behind every node and
 * edge.
 *
 * Header labels are rendered separately by LaneHeaders (screen-space
 * overlay), so this component only draws the bands themselves.
 */
export function LanesBackground({
  columns,
  rows,
  theme,
}: LanesBackgroundProps) {
  const hasColumns = columns && columns.length > 0
  const hasRows = rows && rows.length > 0
  if (!hasColumns && !hasRows) return null

  const lanesTheme = theme.lanes

  // Resolve per-lane fill override if the consumer supplied `color`.
  // Otherwise alternate the theme's bandFillEven/Odd.
  const fillForLane = (lane: CanvasLane, index: number): string => {
    if (lane.color) {
      const resolved = resolveColor(lane.color, theme)
      return resolved.fill
    }
    return index % 2 === 0 ? lanesTheme.bandFillEven : lanesTheme.bandFillOdd
  }

  return (
    <g className="system-canvas-lanes" pointerEvents="none">
      {/* Rows first so columns draw on top (columns are the more common
          primary axis in roadmap layouts). */}
      {hasRows &&
        rows!.map((row, i) => (
          <rect
            key={`row-${row.id}`}
            x={-LANE_EXTENT}
            y={row.start}
            width={LANE_EXTENT * 2}
            height={row.size}
            fill={fillForLane(row, i)}
          />
        ))}

      {hasColumns &&
        columns!.map((col, i) => (
          <rect
            key={`col-${col.id}`}
            x={col.start}
            y={-LANE_EXTENT}
            width={col.size}
            height={LANE_EXTENT * 2}
            fill={fillForLane(col, i)}
          />
        ))}

      {/* Dividers — thin lines between adjacent lanes. Drawn last so they
          sit on top of the fills. */}
      {hasRows &&
        rows!.map((row, i) => {
          if (i === 0) return null
          return (
            <line
              key={`rowdiv-${row.id}`}
              x1={-LANE_EXTENT}
              y1={row.start}
              x2={LANE_EXTENT}
              y2={row.start}
              stroke={lanesTheme.dividerColor}
              strokeWidth={lanesTheme.dividerWidth}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

      {hasColumns &&
        columns!.map((col, i) => {
          if (i === 0) return null
          return (
            <line
              key={`coldiv-${col.id}`}
              x1={col.start}
              y1={-LANE_EXTENT}
              x2={col.start}
              y2={LANE_EXTENT}
              stroke={lanesTheme.dividerColor}
              strokeWidth={lanesTheme.dividerWidth}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
    </g>
  )
}
