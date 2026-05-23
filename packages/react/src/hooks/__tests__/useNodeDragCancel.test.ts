import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useNodeDrag } from '../useNodeDrag.js'
import type { ResolvedNode, ViewportState } from 'system-canvas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViewportRef(): React.RefObject<ViewportState> {
  return { current: { x: 0, y: 0, zoom: 1 } }
}

function makeNode(id: string): ResolvedNode {
  return {
    id, type: 'text', x: 0, y: 0, width: 100, height: 50,
    text: 'test', resolvedFill: '#fff', resolvedStroke: '#000', cornerRadius: 0,
    resolvedCornerRadius: 0, isNavigable: false, resolvedIcon: null,
  } as ResolvedNode
}

function makeNodesRef(nodes: ResolvedNode[]) {
  return { current: nodes } as React.RefObject<ResolvedNode[]>
}

function makePointerEvent(overrides: Partial<PointerEvent & { currentTarget: Element }> = {}): React.PointerEvent<Element> {
  const el = document.createElement('div')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.setPointerCapture = vi.fn() as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.releasePointerCapture = vi.fn() as any
  return {
    button: 0,
    clientX: 50,
    clientY: 50,
    pointerId: 1,
    currentTarget: el,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as React.PointerEvent<Element>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNodeDrag — cancelDrag', () => {
  it('returns a cancelDrag function', () => {
    const onCommit = vi.fn()
    const viewport = makeViewportRef()
    const nodesRef = makeNodesRef([makeNode('n1')])

    const { result } = renderHook(() =>
      useNodeDrag({ viewport, nodesRef, onCommit })
    )

    expect(typeof result.current.cancelDrag).toBe('function')
  })

  it('is a no-op when no drag is active', () => {
    const onCommit = vi.fn()
    const viewport = makeViewportRef()
    const nodesRef = makeNodesRef([makeNode('n1')])

    const { result } = renderHook(() =>
      useNodeDrag({ viewport, nodesRef, onCommit })
    )

    // Should not throw
    act(() => result.current.cancelDrag())
    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isDragging).toBe(false)
  })

  it('cancels an active drag without committing', () => {
    const onCommit = vi.fn()
    const viewport = makeViewportRef()
    const node = makeNode('n1')
    const nodesRef = makeNodesRef([node])

    const { result } = renderHook(() =>
      useNodeDrag({ viewport, nodesRef, onCommit })
    )

    // Start a drag
    act(() => {
      result.current.onPointerDown(node, makePointerEvent())
    })

    // Simulate pointer move to cross drag threshold
    act(() => {
      const moveEvent = new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 60,
        clientY: 60,
        bubbles: true,
      })
      window.dispatchEvent(moveEvent)
    })

    expect(result.current.isDragging).toBe(true)

    // Cancel — should not commit
    act(() => result.current.cancelDrag())

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.isDragging).toBe(false)
    expect(result.current.dragOverrides.size).toBe(0)
  })
})
