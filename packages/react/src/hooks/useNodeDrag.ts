import { useCallback, useRef, useState } from 'react'
import type {
  CanvasNode,
  ResolvedNode,
  ViewportState,
  NodeUpdate,
} from 'system-canvas'
import { getGroupChildren, screenToCanvas } from 'system-canvas'

interface UseNodeDragOptions {
  /** Current viewport state ref — drag uses viewport.zoom to convert deltas */
  viewport: React.RefObject<ViewportState>
  /** All currently-resolved nodes (used to find group children at drag start) */
  nodesRef: React.RefObject<ResolvedNode[]>
  /** Called once per moved node when drag ends */
  onCommit: (id: string, patch: NodeUpdate) => void

  /**
   * Optional ref to the SVG element. Required when drop-on-node detection
   * is enabled (`canDropNodeOn` provided) so the hook can convert pointer
   * client coords into canvas-space for hit-testing. Without it, drop
   * detection is silently disabled.
   */
  svgRef?: React.RefObject<SVGSVGElement | null>

  /**
   * Predicate consulted while dragging. When the pointer hovers over
   * another node, the hook calls this with `(sources, target)`. When it
   * returns true, the target gets the "droppable" highlight and a release
   * fires `onNodeDrop` instead of committing the drag.
   *
   * Self-drop (target.id matches any source id) is filtered before this
   * is called.
   *
   * Called frequently during drag — keep it cheap (pure derivation, no
   * fetches / setState).
   */
  canDropNodeOn?: (
    sources: CanvasNode[],
    target: CanvasNode
  ) => boolean

  /**
   * Fires once on pointer release when a drag ended over a node that
   * `canDropNodeOn` accepted. By the time this fires the source nodes
   * have already snapped back to their pre-drag positions; the consumer's
   * job is purely to mutate data and trigger a refetch.
   */
  onNodeDrop?: (sources: CanvasNode[], target: CanvasNode) => void
}

interface UseNodeDragResult {
  /** Map of node id → live drag position (canvas-space) */
  dragOverrides: Map<string, { x: number; y: number }>
  /**
   * Id of the node currently under the pointer that `canDropNodeOn`
   * accepted as a valid drop target. `null` when there's no drag in
   * progress, no hover, or the predicate rejected the current hover.
   * Consumers use this to paint a "droppable" highlight.
   */
  dropTargetId: string | null
  /** Attach this as the node component's onPointerDown */
  onPointerDown: (node: ResolvedNode, event: React.PointerEvent) => void
  isDragging: boolean
}

interface DragState {
  /** Starting pointer position in screen coords */
  startClientX: number
  startClientY: number
  /** Element that captured the pointer — released on up */
  captureTarget: Element
  pointerId: number
  /** Set of node ids being moved, with their original positions */
  moving: Map<string, { startX: number; startY: number }>
  /**
   * The primary node the user grabbed (handed to `canDropNodeOn` as the
   * single source). Distinguished from the `moving` map because group
   * drags carry contained children along, but those aren't sources for
   * the drop predicate — only the directly-grabbed node is.
   */
  source: CanvasNode
}

const DRAG_THRESHOLD = 3 // px in screen space before we consider it a drag

export function useNodeDrag(options: UseNodeDragOptions): UseNodeDragResult {
  const { viewport, nodesRef, onCommit, svgRef, canDropNodeOn, onNodeDrop } =
    options

  const [dragOverrides, setDragOverrides] = useState<
    Map<string, { x: number; y: number }>
  >(() => new Map())
  const [isDragging, setIsDragging] = useState(false)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const stateRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)

  // Mirror props in refs so the long-lived window-level listeners read
  // the latest predicate / drop callback without re-binding on every
  // render.
  const canDropNodeOnRef = useRef(canDropNodeOn)
  canDropNodeOnRef.current = canDropNodeOn
  const onNodeDropRef = useRef(onNodeDrop)
  onNodeDropRef.current = onNodeDrop
  const svgRefRef = useRef(svgRef)
  svgRefRef.current = svgRef

  // Latest computed drop-target id so finishDrag can read it without
  // depending on React state (state updates are async; finishDrag fires
  // synchronously inside the pointerup handler).
  const dropTargetIdRef = useRef<string | null>(null)

  /**
   * Hit-test the current pointer position (client coords) against
   * `nodesRef.current` and ask `canDropNodeOnRef.current` whether each
   * candidate is a valid drop target. Returns the topmost (last-rendered)
   * accepted target's id, or null. Skips the source node and any node
   * being carried with it (group children).
   */
  const computeDropTarget = useCallback(
    (clientX: number, clientY: number): string | null => {
      const cb = canDropNodeOnRef.current
      const st = stateRef.current
      const nodes = nodesRef.current
      const svg = svgRefRef.current?.current
      if (!cb || !st || !nodes || !svg) return null

      const rect = svg.getBoundingClientRect()
      const vp = viewport.current ?? { x: 0, y: 0, zoom: 1 }
      const { x, y } = screenToCanvas(
        clientX - rect.left,
        clientY - rect.top,
        vp
      )

      // Topmost-first hit-test (mirrors the painter's order used elsewhere).
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        // Skip self-drop and any node being dragged along (group children).
        if (st.moving.has(n.id)) continue
        if (x < n.x || x > n.x + n.width) continue
        if (y < n.y || y > n.y + n.height) continue
        if (cb([st.source], n)) return n.id
        // Topmost rule: if a node is under the pointer but rejected, we
        // still stop here. Otherwise dragging over a non-droppable node
        // would "see through" to a droppable one underneath and the
        // visual feedback would lie about the actual drop target.
        return null
      }
      return null
    },
    [nodesRef, viewport]
  )

  const onPointerMove = useCallback((event: PointerEvent) => {
    const st = stateRef.current
    if (!st || event.pointerId !== st.pointerId) return

    const dxScreen = event.clientX - st.startClientX
    const dyScreen = event.clientY - st.startClientY

    if (!movedRef.current) {
      if (
        Math.abs(dxScreen) < DRAG_THRESHOLD &&
        Math.abs(dyScreen) < DRAG_THRESHOLD
      ) {
        return
      }
      movedRef.current = true
      setIsDragging(true)
    }

    const zoom = viewport.current?.zoom ?? 1
    const dx = dxScreen / zoom
    const dy = dyScreen / zoom

    const next = new Map<string, { x: number; y: number }>()
    for (const [id, start] of st.moving) {
      next.set(id, { x: start.startX + dx, y: start.startY + dy })
    }
    setDragOverrides(next)

    // Drop hit-test runs every frame the pointer moves. Only meaningful
    // when a `canDropNodeOn` predicate was supplied — `computeDropTarget`
    // returns null in that case.
    const nextTarget = computeDropTarget(event.clientX, event.clientY)
    if (nextTarget !== dropTargetIdRef.current) {
      dropTargetIdRef.current = nextTarget
      setDropTargetId(nextTarget)
    }
  }, [viewport, computeDropTarget])

  const finishDrag = useCallback(
    (commit: boolean) => {
      const st = stateRef.current
      if (!st) return

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUpRef.current!)
      window.removeEventListener('pointercancel', onPointerCancelRef.current!)

      try {
        ;(st.captureTarget as any).releasePointerCapture?.(st.pointerId)
      } catch {
        // ignore
      }

      // If the drag ended over a valid drop target AND we want to
      // commit (a real drop, not a cancel), fire the drop callback and
      // SKIP the position commit. Snap-back is implicit: clearing
      // `dragOverrides` returns the source(s) to their pre-drag x/y in
      // the model.
      const dropTarget = dropTargetIdRef.current
      if (commit && movedRef.current && dropTarget) {
        const nodes = nodesRef.current
        const target = nodes?.find((n) => n.id === dropTarget) ?? null
        // Defensive: target may have been removed mid-drag (agent edit,
        // Pusher refresh). In that case fall through to a normal drag-end
        // — the user's gesture shouldn't silently vanish.
        if (target && onNodeDropRef.current) {
          onNodeDropRef.current([st.source], target)
          stateRef.current = null
          movedRef.current = false
          dropTargetIdRef.current = null
          setIsDragging(false)
          setDragOverrides(new Map())
          setDropTargetId(null)
          return
        }
      }

      if (commit && movedRef.current) {
        const overrides = Array.from(dragOverridesRef.current.entries())
        for (const [id, pos] of overrides) {
          onCommit(id, { x: Math.round(pos.x), y: Math.round(pos.y) })
        }
      }

      stateRef.current = null
      movedRef.current = false
      dropTargetIdRef.current = null
      setIsDragging(false)
      setDragOverrides(new Map())
      setDropTargetId(null)
    },
    [onPointerMove, onCommit, nodesRef]
  )

  // Keep a ref to dragOverrides for finishDrag to read without re-binding.
  const dragOverridesRef = useRef(dragOverrides)
  dragOverridesRef.current = dragOverrides

  const onPointerUpRef = useRef<((e: PointerEvent) => void) | null>(null)
  const onPointerCancelRef = useRef<((e: PointerEvent) => void) | null>(null)

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      const st = stateRef.current
      if (!st || event.pointerId !== st.pointerId) return
      finishDrag(true)
    },
    [finishDrag]
  )
  onPointerUpRef.current = onPointerUp

  const onPointerCancel = useCallback(
    (event: PointerEvent) => {
      const st = stateRef.current
      if (!st || event.pointerId !== st.pointerId) return
      finishDrag(false)
    },
    [finishDrag]
  )
  onPointerCancelRef.current = onPointerCancel

  const onPointerDown = useCallback(
    (node: ResolvedNode, event: React.PointerEvent) => {
      // Only primary button
      if (event.button !== 0) return
      // Don't start another drag
      if (stateRef.current) return

      event.stopPropagation()

      const moving = new Map<string, { startX: number; startY: number }>()
      moving.set(node.id, { startX: node.x, startY: node.y })

      // If it's a group, also move spatially contained children.
      if (node.type === 'group' && nodesRef.current) {
        const children = getGroupChildren(node, nodesRef.current)
        for (const c of children) {
          if (!moving.has(c.id)) {
            moving.set(c.id, { startX: c.x, startY: c.y })
          }
        }
      }

      stateRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        captureTarget: event.currentTarget,
        pointerId: event.pointerId,
        moving,
        source: node,
      }
      movedRef.current = false
      dropTargetIdRef.current = null

      try {
        ;(event.currentTarget as any).setPointerCapture?.(event.pointerId)
      } catch {
        // ignore
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
    },
    [nodesRef, onPointerMove, onPointerUp, onPointerCancel]
  )

  return { dragOverrides, dropTargetId, onPointerDown, isDragging }
}
