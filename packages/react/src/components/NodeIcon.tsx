import React from 'react'

interface NodeIconProps {
  icon: string
  x: number
  y: number
  size?: number
  color: string
  opacity?: number
  /**
   * Custom icon map, merged over the built-in set. Entries here win over
   * built-ins of the same name, so themes can both extend and override.
   * Path data is expected in a 16x16 coordinate space.
   */
  customIcons?: Record<string, string[]>
}

/**
 * Renders a small SVG icon at the given position.
 * All icons are drawn as stroked paths within a `size x size` viewBox.
 */
export function NodeIcon({
  icon,
  x,
  y,
  size = 14,
  color,
  opacity = 0.7,
  customIcons,
}: NodeIconProps) {
  const pathData = customIcons?.[icon] ?? iconPaths[icon]
  if (!pathData) return null

  return (
    <g
      transform={`translate(${x}, ${y})`}
      pointerEvents="none"
      opacity={opacity}
    >
      {pathData.map((d, i) => (
        <path
          key={i}
          d={scalePathData(d, size)}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  )
}

/**
 * Scale path data from a 16x16 coordinate space to the target size.
 */
function scalePathData(d: string, size: number): string {
  const scale = size / 16
  return d.replace(/(-?\d+\.?\d*)/g, (match) => {
    return String(parseFloat(match) * scale)
  })
}

/**
 * Icon path data in a 16x16 coordinate space.
 * Each icon is an array of path `d` strings (some icons need multiple paths).
 */
const iconPaths: Record<string, string[]> = {
  // Database: cylinder shape
  database: [
    'M 2 4 C 2 2 8 1 8 1 C 8 1 14 2 14 4 L 14 12 C 14 14 8 15 8 15 C 8 15 2 14 2 12 Z',
    'M 2 4 C 2 6 8 7 8 7 C 8 7 14 6 14 4',
    'M 2 8 C 2 10 8 11 8 11 C 8 11 14 10 14 8',
  ],

  // Server: stacked rectangles with dots
  server: [
    'M 2 2 L 14 2 L 14 7 L 2 7 Z',
    'M 2 9 L 14 9 L 14 14 L 2 14 Z',
    'M 4.5 4.5 L 4.5 4.5',
    'M 4.5 11.5 L 4.5 11.5',
  ],

  // Person: head circle + body arc
  person: [
    'M 8 7 A 3 3 0 1 0 8 1 A 3 3 0 1 0 8 7',
    'M 2 15 C 2 11 5 9 8 9 C 11 9 14 11 14 15',
  ],

  // Cloud: cloud shape
  cloud: [
    'M 4 12 C 1.5 12 1 10 2 8.5 C 1 7 2 5 4 5 C 4.5 3 6.5 2 8.5 2.5 C 10 1 12.5 1.5 13 3.5 C 15 4 15.5 6.5 14 8 C 15 9.5 14.5 12 12 12 Z',
  ],

  // Lock: padlock shape
  lock: [
    'M 4 7 L 12 7 L 12 14 L 4 14 Z',
    'M 5.5 7 L 5.5 5 C 5.5 3 6.5 1.5 8 1.5 C 9.5 1.5 10.5 3 10.5 5 L 10.5 7',
    'M 8 10 L 8 11.5',
  ],

  // Globe: circle with latitude/longitude lines
  globe: [
    'M 1 8 A 7 7 0 1 0 15 8 A 7 7 0 1 0 1 8',
    'M 1 8 L 15 8',
    'M 8 1 C 5 4 5 12 8 15',
    'M 8 1 C 11 4 11 12 8 15',
  ],

  // Code: angle brackets
  code: [
    'M 5 3 L 1 8 L 5 13',
    'M 11 3 L 15 8 L 11 13',
    'M 10 1 L 6 15',
  ],

  // Folder: folder shape
  folder: [
    'M 1 4 L 1 13 L 15 13 L 15 4 L 7 4 L 6 2 L 1 2 Z',
  ],

  // Network: three connected nodes
  network: [
    'M 8 2 L 8 2 M 6 2 A 2 2 0 1 0 10 2 A 2 2 0 1 0 6 2',
    'M 2 12 L 2 12 M 0 12 A 2 2 0 1 0 4 12 A 2 2 0 1 0 0 12',
    'M 14 12 L 14 12 M 12 12 A 2 2 0 1 0 16 12 A 2 2 0 1 0 12 12',
    'M 8 4 L 3 10',
    'M 8 4 L 13 10',
  ],

  // Shield: security shield
  shield: [
    'M 8 1 L 2 4 L 2 8 C 2 12 8 15 8 15 C 8 15 14 12 14 8 L 14 4 Z',
  ],

  // Zap: lightning bolt
  zap: [
    'M 9 1 L 3 9 L 8 9 L 7 15 L 13 7 L 8 7 Z',
  ],

  // Users: two people
  users: [
    'M 6 7 A 2.5 2.5 0 1 0 6 2 A 2.5 2.5 0 1 0 6 7',
    'M 1 14 C 1 11 3 9 6 9 C 9 9 11 11 11 14',
    'M 11 6.5 A 2 2 0 1 0 11 2.5 A 2 2 0 1 0 11 6.5',
    'M 15 14 C 15 11.5 13.5 10 11.5 9.5',
  ],

  // Cog: gear/settings
  cog: [
    'M 8 5.5 A 2.5 2.5 0 1 0 8 10.5 A 2.5 2.5 0 1 0 8 5.5',
    'M 8 1 L 8 3 M 8 13 L 8 15 M 1 8 L 3 8 M 13 8 L 15 8 M 3 3 L 4.5 4.5 M 11.5 11.5 L 13 13 M 13 3 L 11.5 4.5 M 4.5 11.5 L 3 13',
  ],

  // Terminal: command prompt
  terminal: [
    'M 2 2 L 14 2 L 14 14 L 2 14 Z',
    'M 5 7 L 7.5 9 L 5 11',
    'M 9 11 L 12 11',
  ],

  // Package: box
  package: [
    'M 2 5 L 8 2 L 14 5 L 14 11 L 8 14 L 2 11 Z',
    'M 2 5 L 8 8 L 14 5',
    'M 8 8 L 8 14',
  ],
}
