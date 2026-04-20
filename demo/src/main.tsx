import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SystemCanvas, type SystemCanvasHandle } from 'system-canvas-react'
import {
  darkTheme,
  midnightTheme,
  lightTheme,
  blueprintTheme,
  warmTheme,
  roadmapTheme,
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
import { roadmapRoot, roadmapCanvasMap } from './roadmap.js'
import { kanbanRoot, kanbanCanvasMap, kanbanTheme } from './kanban.js'
import { swimlaneRoot, swimlaneCanvasMap, swimlaneTheme } from './swimlane.js'
import { nestedRoot, nestedCanvasMap } from './nested.js'
import { showcaseRoot, showcaseCanvasMap, showcaseTheme } from './showcase.js'

const allThemes: Record<string, CanvasTheme> = {
  dark: darkTheme,
  midnight: midnightTheme,
  light: lightTheme,
  blueprint: blueprintTheme,
  warm: warmTheme,
  roadmap: roadmapTheme,
  kanban: kanbanTheme,
  swimlane: swimlaneTheme,
  showcase: showcaseTheme,
}

const ROOT_KEY = '__root__'

type Mode = 'system' | 'roadmap' | 'kanban' | 'swimlane' | 'nested' | 'showcase'

// Which theme feels most natural for each mode. Consumers can still pick
// anything from the theme dropdown, but switching modes flips to the
// matching theme automatically for a nicer out-of-the-box demo.
const DEFAULT_THEME_FOR_MODE: Record<Mode, string> = {
  system: 'dark',
  roadmap: 'roadmap',
  kanban: 'kanban',
  swimlane: 'swimlane',
  nested: 'dark',
  showcase: 'showcase',
}

// Whether each mode supports snap-to-lanes. Driven by whether the underlying
// canvas actually has columns or rows.
const MODE_HAS_LANES: Record<Mode, boolean> = {
  system: false,
  roadmap: true,
  kanban: true,
  swimlane: true,
  nested: true, // sub-canvases have lanes even though the root doesn't
  showcase: false,
}

// Root-label for breadcrumbs per mode.
const MODE_ROOT_LABEL: Record<Mode, string> = {
  system: 'Organization',
  roadmap: 'Roadmap',
  kanban: 'Sprint board',
  swimlane: 'Release process',
  nested: 'Acme Co.',
  showcase: 'Showcase',
}

// In "nested" mode we let per-canvas theme hints drive the theme instead
// of forcing one at the top level. This lets the theme swap as the user
// navigates between the freeform root and the lane-structured sub-canvases.
const MODE_USES_PER_CANVAS_THEME: Record<Mode, boolean> = {
  system: false,
  roadmap: false,
  kanban: false,
  swimlane: false,
  nested: true,
  showcase: false,
}

const MODES: Mode[] = ['system', 'roadmap', 'kanban', 'swimlane', 'nested', 'showcase']

function readModeFromUrl(): Mode {
  if (typeof window === 'undefined') return 'system'
  const param = new URLSearchParams(window.location.search).get('mode')
  return (MODES as string[]).includes(param ?? '') ? (param as Mode) : 'system'
}

function App() {
  const [mode, setMode] = useState<Mode>(() => readModeFromUrl())
  // Initial theme follows the mode read from the URL, so refreshing on
  // ?mode=showcase lands with the showcase theme (same as clicking it).
  const [themeName, setThemeName] = useState<string>(() => DEFAULT_THEME_FOR_MODE[readModeFromUrl()])
  const [edgeStyle, setEdgeStyle] = useState<'bezier' | 'straight' | 'orthogonal'>('bezier')
  const [editable, setEditable] = useState<boolean>(true)
  const [zoomNavigation, setZoomNavigation] = useState<boolean>(true)
  const [snapToLanes, setSnapToLanes] = useState<boolean>(true)

  // Imperative handle for programmatic camera control (cinematic tour)
  const canvasHandleRef = useRef<SystemCanvasHandle>(null)
  const tourRunningRef = useRef(false)

  // Plays a scripted zoom-in sequence through the 'system' mode hierarchy:
  //   Organization  ->  Kubernetes  ->  worker-pod  ->  Sandbox
  // Each hop takes 2400ms; a short pause between hops lets the viewer
  // register where they landed before the next hop begins.
  const playTour = useCallback(async () => {
    const handle = canvasHandleRef.current
    if (!handle || tourRunningRef.current) return
    tourRunningRef.current = true
    try {
      handle.navigateToRoot()
      // Small delay so the root fit animation completes before we start.
      await new Promise((r) => setTimeout(r, 600))
      await handle.zoomIntoNode('k8s', { durationMs: 2400 })
      await new Promise((r) => setTimeout(r, 500))
      await handle.zoomIntoNode('pod-worker', { durationMs: 2400 })
      await new Promise((r) => setTimeout(r, 500))
      await handle.zoomIntoNode('sandbox', { durationMs: 2400 })
    } finally {
      tourRunningRef.current = false
    }
  }, [])

  // Independent canvas stores — one per mode — so mutations don't leak
  // across modes when the user switches.
  const [systemCanvases, setSystemCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: initialRoot,
    ...initialCanvasMap,
  }))
  const [roadmapCanvases, setRoadmapCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: roadmapRoot,
    ...roadmapCanvasMap,
  }))
  const [kanbanCanvases, setKanbanCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: kanbanRoot,
    ...kanbanCanvasMap,
  }))
  const [swimlaneCanvases, setSwimlaneCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: swimlaneRoot,
    ...swimlaneCanvasMap,
  }))
  const [nestedCanvases, setNestedCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: nestedRoot,
    ...nestedCanvasMap,
  }))
  const [showcaseCanvases, setShowcaseCanvases] = useState<Record<string, CanvasData>>(() => ({
    [ROOT_KEY]: showcaseRoot,
    ...showcaseCanvasMap,
  }))

  const canvasesByMode: Record<Mode, Record<string, CanvasData>> = {
    system: systemCanvases,
    roadmap: roadmapCanvases,
    kanban: kanbanCanvases,
    swimlane: swimlaneCanvases,
    nested: nestedCanvases,
    showcase: showcaseCanvases,
  }
  const allCanvases = canvasesByMode[mode]

  // IMPORTANT: the setter must be chosen on every call, not captured at
  // closure creation — otherwise switching modes would silently keep
  // mutating whichever canvas was active on the first render.
  const modeRef = useRef(mode)
  modeRef.current = mode
  const setActiveCanvases = useCallback(
    (updater: (prev: Record<string, CanvasData>) => Record<string, CanvasData>) => {
      switch (modeRef.current) {
        case 'system':
          setSystemCanvases(updater)
          break
        case 'roadmap':
          setRoadmapCanvases(updater)
          break
        case 'kanban':
          setKanbanCanvases(updater)
          break
        case 'swimlane':
          setSwimlaneCanvases(updater)
          break
        case 'nested':
          setNestedCanvases(updater)
          break
        case 'showcase':
          setShowcaseCanvases(updater)
          break
      }
    },
    []
  )

  // Keep ?mode= in sync with state, so refreshes land on the same mode.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('mode') === mode) return
    url.searchParams.set('mode', mode)
    window.history.replaceState(null, '', url.toString())
  }, [mode])

  // Respond to browser back/forward so the URL remains authoritative.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => setMode(readModeFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // When switching modes, flip to the default theme for that mode — but
  // preserve the user's choice if they're already on a non-default theme.
  const handleModeChange = (next: Mode) => {
    setMode(next)
    const currentDefaults = Object.values(DEFAULT_THEME_FOR_MODE)
    // If the user hadn't deviated from a default theme, switch to the new
    // mode's default. Otherwise keep their custom choice.
    if (currentDefaults.includes(themeName)) {
      setThemeName(DEFAULT_THEME_FOR_MODE[next])
    }
  }

  const theme = allThemes[themeName]
  const rootCanvas = allCanvases[ROOT_KEY]

  // Pass the sub-canvas map (without ROOT_KEY) to SystemCanvas
  const canvases = allCanvases

  const keyFor = (canvasRef: string | undefined) => canvasRef ?? ROOT_KEY

  const handleNodeAdd = useCallback((node: CanvasNode, canvasRef: string | undefined) => {
    const key = keyFor(canvasRef)
    setActiveCanvases((prev) => ({
      ...prev,
      [key]: addNodeHelper(prev[key] ?? { nodes: [], edges: [] }, node),
    }))
  }, [setActiveCanvases])

  const handleNodeUpdate = useCallback(
    (nodeId: string, patch: NodeUpdate, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setActiveCanvases((prev) => ({
        ...prev,
        [key]: updateNodeHelper(prev[key] ?? { nodes: [], edges: [] }, nodeId, patch),
      }))
    },
    [setActiveCanvases]
  )

  const handleNodeDelete = useCallback(
    (nodeId: string, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setActiveCanvases((prev) => ({
        ...prev,
        [key]: removeNodeHelper(prev[key] ?? { nodes: [], edges: [] }, nodeId),
      }))
    },
    [setActiveCanvases]
  )

  const handleEdgeUpdate = useCallback(
    (edgeId: string, patch: EdgeUpdate, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setActiveCanvases((prev) => ({
        ...prev,
        [key]: updateEdgeHelper(prev[key] ?? { nodes: [], edges: [] }, edgeId, patch),
      }))
    },
    [setActiveCanvases]
  )

  const handleEdgeDelete = useCallback(
    (edgeId: string, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setActiveCanvases((prev) => ({
        ...prev,
        [key]: removeEdgeHelper(prev[key] ?? { nodes: [], edges: [] }, edgeId),
      }))
    },
    [setActiveCanvases]
  )

  const handleEdgeAdd = useCallback(
    (edge: CanvasEdge, canvasRef: string | undefined) => {
      const key = keyFor(canvasRef)
      setActiveCanvases((prev) => ({
        ...prev,
        [key]: addEdgeHelper(prev[key] ?? { nodes: [], edges: [] }, edge),
      }))
    },
    [setActiveCanvases]
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
        {mode === 'system' && (
          // Invisible tour trigger. Lives to the left of the Mode selector
          // so anyone in the know can click it; everyone else sees empty
          // space. Reserves a small hit-target (24x20) so it's clickable.
          <button
            type="button"
            onClick={playTour}
            aria-label="Play tour"
            title="Play tour"
            style={{
              width: 24,
              height: 20,
              padding: 0,
              margin: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: 0,
            }}
          />
        )}
        <label>
          Mode:{' '}
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as Mode)}
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
            <option value="system">system</option>
            <option value="roadmap">roadmap</option>
            <option value="kanban">kanban</option>
            <option value="swimlane">swimlane</option>
            <option value="nested">nested</option>
            <option value="showcase">showcase</option>
          </select>
        </label>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={zoomNavigation}
            onChange={(e) => setZoomNavigation(e.target.checked)}
          />
          Zoom-nav
        </label>
        {MODE_HAS_LANES[mode] && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={snapToLanes}
              onChange={(e) => setSnapToLanes(e.target.checked)}
            />
            Snap to lanes
          </label>
        )}
      </div>

      <SystemCanvas
        key={mode}
        ref={canvasHandleRef}
        canvas={rootCanvas}
        canvases={canvases}
        // In "nested" mode we deliberately omit the `theme` prop so the
        // library can read per-canvas `theme.base` hints and swap themes
        // as the user navigates. The `themes` map below exposes our
        // custom kanban/swimlane themes by name for that lookup.
        theme={MODE_USES_PER_CANVAS_THEME[mode] ? undefined : theme}
        themes={allThemes}
        edgeStyle={edgeStyle}
        editable={editable}
        zoomNavigation={zoomNavigation}
        snapToLanes={MODE_HAS_LANES[mode] ? snapToLanes : false}
        rootLabel={MODE_ROOT_LABEL[mode]}
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
