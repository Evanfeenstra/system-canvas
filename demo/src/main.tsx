import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SystemCanvas } from 'system-canvas-react'
import {
  themes,
  darkTheme,
  midnightTheme,
  lightTheme,
  blueprintTheme,
  warmTheme,
} from 'system-canvas'
import type { CanvasData, CanvasTheme, CanvasNode } from 'system-canvas'
import { rootCanvas, canvasMap } from './data.js'

const allThemes: Record<string, CanvasTheme> = {
  dark: darkTheme,
  midnight: midnightTheme,
  light: lightTheme,
  blueprint: blueprintTheme,
  warm: warmTheme,
}

// Add categories to all themes for the demo
const categoryDefs = {
  service: {
    defaultWidth: 140,
    defaultHeight: 60,
    fill: 'rgba(6, 78, 59, 0.4)',
    stroke: '#34d399',
    cornerRadius: 6,
    icon: 'server',
  },
  database: {
    defaultWidth: 140,
    defaultHeight: 60,
    fill: 'rgba(76, 29, 149, 0.4)',
    stroke: '#a78bfa',
    cornerRadius: 6,
    icon: 'database',
  },
  frontend: {
    defaultWidth: 140,
    defaultHeight: 60,
    fill: 'rgba(8, 51, 68, 0.4)',
    stroke: '#22d3ee',
    cornerRadius: 6,
    icon: 'globe',
  },
}

for (const t of Object.values(allThemes)) {
  t.categories = { ...t.categories, ...categoryDefs }
}

function App() {
  const [themeName, setThemeName] = useState<string>('dark')
  const [edgeStyle, setEdgeStyle] = useState<'bezier' | 'straight' | 'orthogonal'>('bezier')

  const theme = allThemes[themeName]

  async function resolveCanvas(ref: string): Promise<CanvasData> {
    // Simulate async load
    await new Promise((r) => setTimeout(r, 200))
    const canvas = canvasMap[ref]
    if (!canvas) throw new Error(`Unknown canvas ref: ${ref}`)
    return canvas
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Theme / controls bar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 20,
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          background: theme.breadcrumbs.background,
          borderRadius: 8,
          fontFamily: theme.node.fontFamily,
          fontSize: 11,
          color: theme.breadcrumbs.textColor,
          backdropFilter: 'blur(8px)',
        }}
      >
        <label>
          Theme:{' '}
          <select
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            style={{
              background: 'transparent',
              color: theme.breadcrumbs.activeColor,
              border: `1px solid ${theme.breadcrumbs.separatorColor}`,
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            {Object.keys(allThemes).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Edges:{' '}
          <select
            value={edgeStyle}
            onChange={(e) =>
              setEdgeStyle(e.target.value as 'bezier' | 'straight' | 'orthogonal')
            }
            style={{
              background: 'transparent',
              color: theme.breadcrumbs.activeColor,
              border: `1px solid ${theme.breadcrumbs.separatorColor}`,
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            <option value="bezier">bezier</option>
            <option value="straight">straight</option>
            <option value="orthogonal">orthogonal</option>
          </select>
        </label>
      </div>

      <SystemCanvas
        canvas={rootCanvas}
        theme={theme}
        edgeStyle={edgeStyle}
        onResolveCanvas={resolveCanvas}
        rootLabel="Organization"
        onNodeClick={(node: CanvasNode) => {
          console.log('Node clicked:', node.id)
        }}
        onNavigate={(ref: string) => {
          console.log('Navigating to:', ref)
        }}
      />
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
