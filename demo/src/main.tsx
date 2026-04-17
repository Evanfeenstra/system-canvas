import React, { useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SystemCanvas } from 'system-canvas-react'
import {
  darkTheme,
  midnightTheme,
  lightTheme,
  blueprintTheme,
  warmTheme,
  addNode as addNodeHelper,
  updateNode as updateNodeHelper,
  removeNode as removeNodeHelper,
  addEdge as addEdgeHelper,
  updateEdge as updateEdgeHelper,
  removeEdge as removeEdgeHelper,
} from 'system-canvas'
import type {
  CanvasData,
  CanvasTheme,
  CanvasNode,
  CanvasEdge,
  NodeUpdate,
  EdgeUpdate,
} from 'system-canvas'
import { rootCanvas as initialRoot, canvasMap as initialCanvasMap } from './data.js'

const allThemes: Record<string, CanvasTheme> = {
  dark: darkTheme,
  midnight: midnightTheme,
  light: lightTheme,
  blueprint: blueprintTheme,
  warm: warmTheme,
}

const ROOT_KEY = '__root__'

function App() {
  const [themeName, setThemeName] = useState<string>('dark')
  const [edgeStyle, setEdgeStyle] = useState<'bezier' | 'straight' | 'orthogonal'>('bezier')
  const [editable, setEditable] = useState<boolean>(true)

  // Hold all canvases in state. Root is stored under ROOT_KEY; sub-canvases
  // are stored under their ref strings.
  const [allCanvases, setAllCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: initialRoot,
    ...initialCanvasMap,
  }))

  const theme = allThemes[themeName]
  const rootCanvas = allCanvases[ROOT_KEY]

  // Pass the sub-canvas map (without ROOT_KEY) to SystemCanvas
  const canvases = allCanvases

  const keyFor = (canvasRef: string | undefined) => canvasRef ?? ROOT_KEY

  const handleNodeAdd = useCallback((node: CanvasNode, canvasRef: string | undefined) => {
    const key = keyFor(canvasRef)
    setAllCanvases((prev) => ({
      ...prev,
      [key]: addNodeHelper(prev[key] ?? { nodes: [], edges: [] }, node),
    }))
  }, [])

  const handleNodeUpdate = useCallback(
    (nodeId: string, patch: NodeUpdate, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setAllCanvases((prev) => ({
        ...prev,
        [key]: updateNodeHelper(prev[key] ?? { nodes: [], edges: [] }, nodeId, patch),
      }))
    },
    []
  )

  const handleNodeDelete = useCallback((nodeId: string, canvasRef: string | undefined) => {
    const key = keyFor(canvasRef)
    setAllCanvases((prev) => ({
      ...prev,
      [key]: removeNodeHelper(prev[key] ?? { nodes: [], edges: [] }, nodeId),
    }))
  }, [])

  const handleEdgeUpdate = useCallback(
    (edgeId: string, patch: EdgeUpdate, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setAllCanvases((prev) => ({
        ...prev,
        [key]: updateEdgeHelper(prev[key] ?? { nodes: [], edges: [] }, edgeId, patch),
      }))
    },
    []
  )

  const handleEdgeDelete = useCallback(
    (edgeId: string, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setAllCanvases((prev) => ({
        ...prev,
        [key]: removeEdgeHelper(prev[key] ?? { nodes: [], edges: [] }, edgeId),
      }))
    },
    []
  )

  const handleEdgeAdd = useCallback(
    (edge: CanvasEdge, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setAllCanvases((prev) => ({
        ...prev,
        [key]: addEdgeHelper(prev[key] ?? { nodes: [], edges: [] }, edge),
      }))
    },
    []
  )

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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={editable}
            onChange={(e) => setEditable(e.target.checked)}
          />
          Editable
        </label>
      </div>

      <SystemCanvas
        canvas={rootCanvas}
        canvases={canvases}
        theme={theme}
        edgeStyle={edgeStyle}
        editable={editable}
        rootLabel="Organization"
        onNodeAdd={handleNodeAdd}
        onNodeUpdate={handleNodeUpdate}
        onNodeDelete={handleNodeDelete}
        onEdgeAdd={handleEdgeAdd}
        onEdgeUpdate={handleEdgeUpdate}
        onEdgeDelete={handleEdgeDelete}
        onNodeClick={(node: CanvasNode) => {
          console.log('Node clicked:', node.id)
        }}
        onEdgeClick={(edge: CanvasEdge) => {
          console.log('Edge clicked:', edge.id)
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
