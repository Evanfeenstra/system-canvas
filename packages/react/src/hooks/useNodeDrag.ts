import { useCallback, useRef, useState } from 'react'
import type { ResolvedNode, ViewportState, NodeUpdate } from 'system-canvas'
import { getGroupChildren } from 'system-canvas'

interface UseNodeDragOptions {
  /** Current viewport state ref — drag uses viewport.zoom to convert deltas */
  viewport: React.RefObject<ViewportState>
  /** All currently-resolved nodes (used to find group children at drag start) */
  nodesRef: React.RefObject<ResolvedNode[]>
  /** Called once per moved node when drag ends */
  onCommit: (id: string, patch: NodeUpdate) => void
}

interface UseNodeDragResult {
  /** Map of node id → live drag position (canvas-space) */
  dragOverrides: Map<string, { x: number; y: number }>
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
}

const DRAG_THRESHOLD = 3 // px in screen space before we consider it a drag

export function useNodeDrag(options: UseNodeDragOptions): UseNodeDragResult {
  const { viewport, nodesRef, onCommit } = options

  const [dragOverrides, setDragOverrides] = useState<
    Map<string, { x: number; y: number }>
  >(() => new Map())
  const [isDragging, setIsDragging] = useState(false)

  const stateRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)

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
  }, [viewport])

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

      if (commit && movedRef.current) {
        const overrides = Array.from(dragOverridesRef.current.entries())
        for (const [id, pos] of overrides) {
          onCommit(id, { x: Math.round(pos.x), y: Math.round(pos.y) })
        }
      }

      stateRef.current = null
      movedRef.current = false
      setIsDragging(false)
      setDragOverrides(new Map())
    },
    [onPointerMove, onCommit]
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
      }
      movedRef.current = false

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

  return { dragOverrides, onPointerDown, isDragging }
}
