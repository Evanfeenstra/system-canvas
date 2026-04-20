import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  EditableField,
  NodeUpdate,
  ResolvedNode,
  CanvasTheme,
} from 'system-canvas'
import { getAtPath, setAtPath } from 'system-canvas'

interface NodeEditorProps {
  node: ResolvedNode
  theme: CanvasTheme
  onCommit: (patch: NodeUpdate) => void
  onCancel: () => void
}

/**
 * Inline editor rendered inside a <foreignObject> overlaying the node.
 *
 * Two modes:
 *   1. **Form editor** — when the node's category declares `editableFields`,
 *      render one control per field (text / textarea / number / select /
 *      boolean). Commit produces a single merged patch.
 *   2. **Single-field editor** — the historical default:
 *        - text  → <textarea>
 *        - file  → <input>
 *        - link  → <input>
 *        - group → <input>
 *
 * Commit semantics:
 *   - Blur of the whole panel (focus leaves all fields) → commit
 *   - Escape                                            → cancel
 *   - Enter on a non-textarea field                     → commit (single
 *     field) or advance focus to next field (form); Enter on last field
 *     commits.
 *   - Cmd/Ctrl+Enter inside a textarea                  → commit
 */
export function NodeEditor({ node, theme, onCommit, onCancel }: NodeEditorProps) {
  const editableFields = useCategoryFields(node, theme)
  if (editableFields) {
    return (
      <FormEditor
        node={node}
        theme={theme}
        fields={editableFields}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    )
  }
  return (
    <SingleFieldEditor
      node={node}
      theme={theme}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  )
}

function useCategoryFields(
  node: ResolvedNode,
  theme: CanvasTheme
): EditableField[] | null {
  if (!node.category) return null
  const def = theme.categories[node.category]
  const fields = def?.editableFields
  if (!fields || fields.length === 0) return null
  return fields
}

// ---------------------------------------------------------------------------
// Single-field editor (historical default)
// ---------------------------------------------------------------------------

function SingleFieldEditor({
  node,
  theme,
  onCommit,
  onCancel,
}: NodeEditorProps) {
  const initial = getInitialValue(node)
  const [value, setValue] = useState(initial)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const el = textareaRef.current ?? inputRef.current
    if (el) {
      el.focus()
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
    onCommit(buildSingleFieldPatch(node, value))
  }

  const cancel = () => {
    if (committedRef.current) return
    committedRef.current = true
    onCancel()
  }

  const stopPointer = (e: React.PointerEvent | React.MouseEvent) => {
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

function buildSingleFieldPatch(
  node: ResolvedNode,
  value: string
): NodeUpdate {
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

// ---------------------------------------------------------------------------
// Form editor (category.editableFields)
// ---------------------------------------------------------------------------

interface FormEditorProps extends NodeEditorProps {
  fields: EditableField[]
}

function FormEditor({
  node,
  theme,
  fields,
  onCommit,
  onCancel,
}: FormEditorProps) {
  // Initial values read from the node at mount; driven by local state.
  const initial = useMemo(() => readInitialValues(node, fields), [node, fields])
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const committedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // The panel grows with the fields list. We size it at least as wide as
  // the node and let the container overflow below the node rect.
  const width = Math.max(node.width, 240)
  // 1-based rough height estimate — lets <foreignObject> give enough room.
  const height = Math.max(node.height, 36 + fields.length * 44)

  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    const patch = buildFormPatch(node, fields, initial, values)
    if (!patch) {
      onCancel()
      return
    }
    onCommit(patch)
  }
  const cancel = () => {
    if (committedRef.current) return
    committedRef.current = true
    onCancel()
  }

  // Commit on blur of the *panel* — fires when focus leaves all fields.
  const onBlurPanel = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && panelRef.current?.contains(next)) return
    commit()
  }

  const stopPointer = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation()
  }

  // Focus the first focusable control on mount.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const first = el.querySelector<HTMLElement>(
      'input, textarea, select, button'
    )
    first?.focus()
    if (first instanceof HTMLInputElement && first.type === 'text') {
      const end = first.value.length
      first.setSelectionRange(end, end)
    }
  }, [])

  const fieldLabelColor = theme.node.sublabelColor
  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    fontFamily: theme.node.fontFamily,
    fontSize: theme.node.fontSize - 1,
    background: theme.background,
    color: theme.node.labelColor,
    border: `1px solid ${theme.breadcrumbs.separatorColor}`,
    borderRadius: 6,
    outline: 'none',
  }

  return (
    <foreignObject
      x={node.x}
      y={node.y}
      width={width}
      height={height}
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
      onClick={stopPointer}
      onDoubleClick={stopPointer}
    >
      <div
        ref={panelRef}
        onBlur={onBlurPanel}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          } else if (
            e.key === 'Enter' &&
            (e.metaKey || e.ctrlKey)
          ) {
            e.preventDefault()
            commit()
          } else if (
            e.key === 'Enter' &&
            !(e.target instanceof HTMLTextAreaElement)
          ) {
            // Advance focus to the next field; commit on last.
            e.preventDefault()
            const panel = panelRef.current
            if (!panel) return
            const focusables = Array.from(
              panel.querySelectorAll<HTMLElement>(
                'input, textarea, select'
              )
            )
            const idx = focusables.indexOf(e.target as HTMLElement)
            if (idx === -1 || idx === focusables.length - 1) commit()
            else focusables[idx + 1].focus()
          }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 10,
          background: theme.breadcrumbs.background,
          color: theme.node.labelColor,
          border: `1.5px solid ${theme.node.labelColor}`,
          borderRadius: node.resolvedCornerRadius,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
          fontFamily: theme.node.fontFamily,
        }}
      >
        {fields.map((field) => {
          const v = values[field.path]
          const setV = (next: unknown) =>
            setValues((prev) => ({ ...prev, [field.path]: next }))
          const label = field.label ?? field.path

          return (
            <label
              key={field.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                fontSize: 10,
                color: fieldLabelColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              <span>{label}</span>
              {renderControl(field, v, setV, inputStyle, theme)}
            </label>
          )
        })}
      </div>
    </foreignObject>
  )
}

function renderControl(
  field: EditableField,
  value: unknown,
  setValue: (v: unknown) => void,
  inputStyle: React.CSSProperties,
  theme: CanvasTheme
): React.ReactNode {
  switch (field.kind) {
    case 'textarea':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={value == null ? '' : String(value)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => {
            const v = e.target.value
            setValue(v === '' ? undefined : Number(v))
          }}
          placeholder={field.placeholder}
          style={inputStyle}
        />
      )
    case 'select':
      return (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => setValue(e.target.value)}
          style={inputStyle}
        >
          {!(field.options?.some((o) => o.value === (value as string))) && (
            <option value="">—</option>
          )}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label ?? o.value}
            </option>
          ))}
        </select>
      )
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => setValue(e.target.checked)}
          style={{
            alignSelf: 'flex-start',
            width: 16,
            height: 16,
            accentColor: theme.node.labelColor,
          }}
        />
      )
    case 'text':
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder={field.placeholder}
          style={inputStyle}
        />
      )
  }
}

function readInitialValues(
  node: ResolvedNode,
  fields: EditableField[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    out[f.path] = getAtPath(node, f.path)
  }
  return out
}

/**
 * Build the commit patch. Each field's dot-path is written into a pseudo
 * node via `setAtPath`, starting from the current node (so untouched
 * `customData` siblings are preserved). The top-level keys on the result
 * become the patch.
 *
 * Returns null when nothing actually changed.
 */
function buildFormPatch(
  node: ResolvedNode,
  fields: EditableField[],
  initial: Record<string, unknown>,
  current: Record<string, unknown>
): NodeUpdate | null {
  let changed = false
  for (const f of fields) {
    if (current[f.path] !== initial[f.path]) {
      changed = true
      break
    }
  }
  if (!changed) return null

  // Work off a shallow clone of the node so nested writes don't mutate.
  let working: Record<string, any> = { ...(node as any) }
  for (const f of fields) {
    working = setAtPath(working, f.path, current[f.path])
  }

  // Build the patch by collecting the top-level keys that any field writes
  // into. For `customData.foo` the top-level key is `customData` and we
  // emit the whole merged `customData` object.
  const patch: NodeUpdate = {}
  const topKeys = new Set<string>()
  for (const f of fields) {
    topKeys.add(f.path.split('.')[0])
  }
  for (const k of topKeys) {
    ;(patch as any)[k] = working[k]
  }
  return patch
}
