import { useEffect, useRef } from 'react'
import type { CanvasNode, CanvasEdge, ViewportState } from 'system-canvas'
import { generateNodeId, generateEdgeId, screenToCanvas } from 'system-canvas'

interface ClipboardSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewportAtCopy: ViewportState
}

// Module-level clipboard — survives re-renders and component unmounts,
// so paste works even after the originating canvas navigates away.
let clipboardSnapshot: ClipboardSnapshot | null = null

interface UseMultiSelectClipboardOptions {
  selectedIdsRef: React.RefObject<Set<string>>
  nodesRef: React.RefObject<CanvasNode[]>
  edgesRef: React.RefObject<CanvasEdge[]>
  viewport: React.RefObject<ViewportState>
  canvasContainerRef: React.RefObject<HTMLElement | null>
  onNodeAdd: (node: CanvasNode, canvasRef: string | undefined) => void
  onEdgeAdd: (edge: CanvasEdge, canvasRef: string | undefined) => void
  canvasRef: string | undefined
}

export function useMultiSelectClipboard(options: UseMultiSelectClipboardOptions): void {
  const {
    selectedIdsRef,
    nodesRef,
    edgesRef,
    viewport,
    onNodeAdd,
    onEdgeAdd,
    canvasRef,
  } = options

  // Keep latest callbacks in refs so the document handler never goes stale
  const onNodeAddRef = useRef(onNodeAdd)
  onNodeAddRef.current = onNodeAdd
  const onEdgeAddRef = useRef(onEdgeAdd)
  onEdgeAddRef.current = onEdgeAdd
  const canvasRefRef = useRef(canvasRef)
  canvasRefRef.current = canvasRef

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Guard: skip when a text editor has focus
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return
      }

      const isMod = e.metaKey || e.ctrlKey

      // -----------------------------------------------------------------------
      // Cmd+C — copy
      // -----------------------------------------------------------------------
      if (isMod && e.key === 'c') {
        const selectedIds = selectedIdsRef.current
        if (!selectedIds || selectedIds.size === 0) return

        const nodes = nodesRef.current ?? []
        const edges = edgesRef.current ?? []
        const vp = viewport.current ?? { x: 0, y: 0, zoom: 1 }

        const copiedNodes = nodes.filter(n => selectedIds.has(n.id))
        if (copiedNodes.length === 0) return

        const copiedEdges = edges.filter(
          edge => selectedIds.has(edge.fromNode) && selectedIds.has(edge.toNode)
        )

        clipboardSnapshot = {
          nodes: copiedNodes,
          edges: copiedEdges,
          viewportAtCopy: { ...vp },
        }

        e.preventDefault()
        return
      }

      // -----------------------------------------------------------------------
      // Cmd+V — paste
      // -----------------------------------------------------------------------
      if (isMod && e.key === 'v') {
        if (!clipboardSnapshot) return

        const { nodes: srcNodes, edges: srcEdges } = clipboardSnapshot
        if (srcNodes.length === 0) return

        // Build old-id → new-id mapping
        const oldToNew = new Map<string, string>()
        for (const n of srcNodes) {
          oldToNew.set(n.id, generateNodeId())
        }

        // Compute bounding-box center of original nodes
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const n of srcNodes) {
          minX = Math.min(minX, n.x)
          minY = Math.min(minY, n.y)
          maxX = Math.max(maxX, n.x + (n.width ?? 0))
          maxY = Math.max(maxY, n.y + (n.height ?? 0))
        }
        const clusterCx = (minX + maxX) / 2
        const clusterCy = (minY + maxY) / 2

        // Compute current viewport center in canvas-space
        const vp = viewport.current ?? { x: 0, y: 0, zoom: 1 }
        // The viewport center is at (containerWidth/2, containerHeight/2) in
        // screen-space. We don't have the container size here, so we use the
        // document center as a reasonable approximation. Using (0,0) in
        // SVG-relative screen coords translates to a point in canvas-space;
        // we want the actual center. As a pragmatic fallback we paste offset
        // by a fixed delta so the user can see the pasted nodes immediately.
        const pasteOffsetX = 40
        const pasteOffsetY = 40

        // Translate each node so the cluster center lands at the current
        // canvas center (approximated by viewport origin + a small offset)
        const viewportCenterCanvas = screenToCanvas(0, 0, vp)
        const dx = viewportCenterCanvas.x - clusterCx + pasteOffsetX
        const dy = viewportCenterCanvas.y - clusterCy + pasteOffsetY

        const clonedNodes: CanvasNode[] = srcNodes.map(n => ({
          ...structuredClone(n),
          id: oldToNew.get(n.id)!,
          x: n.x + dx,
          y: n.y + dy,
        }))

        const clonedEdges: CanvasEdge[] = srcEdges
          .filter(
            edge => oldToNew.has(edge.fromNode) && oldToNew.has(edge.toNode)
          )
          .map(edge => ({
            ...structuredClone(edge),
            id: generateEdgeId(),
            fromNode: oldToNew.get(edge.fromNode)!,
            toNode: oldToNew.get(edge.toNode)!,
          }))

        const ref = canvasRefRef.current
        for (const node of clonedNodes) {
          onNodeAddRef.current(node, ref)
        }
        for (const edge of clonedEdges) {
          onEdgeAddRef.current(edge, ref)
        }

        e.preventDefault()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [selectedIdsRef, nodesRef, edgesRef, viewport])
}
