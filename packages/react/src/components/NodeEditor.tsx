import React, { useEffect, useRef, useState } from 'react'
import type { ResolvedNode, CanvasTheme, NodeUpdate } from 'system-canvas'

interface NodeEditorProps {
  node: ResolvedNode
  theme: CanvasTheme
  onCommit: (patch: NodeUpdate) => void
  onCancel: () => void
}

/**
 * Inline editor rendered inside a <foreignObject> overlaying the node.
 *
 * - text  → <textarea> editing node.text
 * - file  → <input>    editing node.file
 * - link  → <input>    editing node.url
 * - group → <input>    editing node.label
 */
export function NodeEditor({ node, theme, onCommit, onCancel }: NodeEditorProps) {
  const initial = getInitialValue(node)
  const [value, setValue] = useState(initial)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const el = textareaRef.current ?? inputRef.current
    if (el) {
      el.focus()
      // Place cursor at end so user can append/edit without overwriting.
      const end = el.value.length
      el.setSelectionRange(end, end)
    }
  }, [])

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    if (value === initial) {
      onCancel()
      return
    }
    onCommit(buildPatch(node, value))
  }

  const cancel = () => {
    if (committedRef.current) return
    committedRef.current = true
    onCancel()
  }

  const stopPointer = (e: React.PointerEvent | React.MouseEvent) => {
    // Prevent the SVG's pan/drag handlers from stealing the event.
    e.stopPropagation()
  }

  const fontFamily = theme.node.fontFamily
  const fontSize = theme.node.fontSize
  const padding = 8

  const commonFieldStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding,
    fontFamily,
    fontSize,
    background: theme.background,
    color: theme.node.labelColor,
    border: `1.5px solid ${theme.node.labelColor}`,
    borderRadius: node.resolvedCornerRadius,
    outline: 'none',
    resize: 'none',
    textAlign: node.type === 'text' ? 'center' : 'left',
  }

  return (
    <foreignObject
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
      onClick={stopPointer}
      onDoubleClick={stopPointer}
    >
      {node.type === 'text' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          style={commonFieldStyle}
        />
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          style={commonFieldStyle}
        />
      )}
    </foreignObject>
  )
}

function getInitialValue(node: ResolvedNode): string {
  switch (node.type) {
    case 'text':
      return node.text ?? ''
    case 'file':
      return node.file ?? ''
    case 'link':
      return node.url ?? ''
    case 'group':
      return node.label ?? ''
    default:
      return ''
  }
}

function buildPatch(node: ResolvedNode, value: string): NodeUpdate {
  switch (node.type) {
    case 'text':
      return { text: value }
    case 'file':
      return { file: value }
    case 'link':
      return { url: value }
    case 'group':
      return { label: value }
    default:
      return {}
  }
}
