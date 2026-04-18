import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CanvasNode,
  CanvasTheme,
  NodeAction,
  NodeActionGroup,
  NodeUpdate,
  ResolvedNode,
  ViewportState,
} from 'system-canvas'
import {
  canvasToScreen,
  filterActionsForNode,
  getNodeActions,
  resolveActionPatch,
} from 'system-canvas'
import { NodeIcon } from './NodeIcon.js'

/** Gap between the node's top edge and the toolbar's bottom edge, in screen px. */
const NODE_GAP = 10
/** Margin from the viewport's top edge before the toolbar flips to below the node. */
const FLIP_MARGIN = 8
/** Toolbar internal padding / button gap, in screen px. */
const PADDING = 6
const BUTTON_GAP = 4
/** Swatch dot diameter, in screen px. */
const SWATCH_SIZE = 16
/** Icon/button button square size, in screen px. */
const BUTTON_SIZE = 28
/** Delete-button icon size. */
const DELETE_SIZE = 14

export interface NodeToolbarRenderProps {
  node: ResolvedNode
  theme: CanvasTheme
  /** Apply a patch to the node (same semantics as onNodeUpdate). */
  patch: (update: NodeUpdate) => void
  /** Delete the node. */
  deleteNode: () => void
}

interface NodeToolbarProps {
  node: ResolvedNode
  theme: CanvasTheme
  /** Called when an action fires — forwarded to onNodeUpdate. */
  onPatch: (update: NodeUpdate) => void
  /** Called when the delete button fires. */
  onDelete: () => void
  /** Live viewport state — polled each frame for position sync. */
  getViewport: () => ViewportState
  /** Container width/height in screen px (for flip-below-node logic). */
  containerWidth: number
  containerHeight: number
  /** Optional full override of the toolbar UI. */
  render?: (props: NodeToolbarRenderProps) => React.ReactNode
}

/**
 * A floating toolbar that appears above the selected node in editable mode.
 *
 * Implementation:
 *   - Rendered as an HTML overlay (absolute-positioned inside the canvas
 *     container), kept in sync with the viewport via rAF polling — same
 *     pattern as LaneHeaders. This gives fixed-pixel sizing regardless of
 *     zoom without needing inverse-scale transforms.
 *   - Action groups come from `theme.nodeActions`; falls back to a generic
 *     color-swatch group derived from `theme.presetColors`.
 *   - Delete is always appended as a final divider group.
 *   - Fully replaceable via the `render` prop, in which case the library
 *     only positions the container and the consumer draws its contents.
 */
export function NodeToolbar({
  node,
  theme,
  onPatch,
  onDelete,
  getViewport,
  containerWidth,
  containerHeight,
  render,
}: NodeToolbarProps) {
  const [viewport, setViewport] = useState<ViewportState>(() => getViewport())

  useEffect(() => {
    let raf = 0
    let lastX = -Infinity
    let lastY = -Infinity
    let lastZoom = -Infinity
    const tick = () => {
      const vp = getViewport()
      if (vp.x !== lastX || vp.y !== lastY || vp.zoom !== lastZoom) {
        lastX = vp.x
        lastY = vp.y
        lastZoom = vp.zoom
        setViewport(vp)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getViewport])

  // Position of the node's top-center in screen coords.
  const topCenter = canvasToScreen(node.x + node.width / 2, node.y, viewport)
  const bottomCenter = canvasToScreen(
    node.x + node.width / 2,
    node.y + node.height,
    viewport
  )

  // Measure the toolbar's actual screen size so we can center it over the
  // node and flip it below when near the top of the viewport.
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setSize({ width: r.width, height: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  })

  // Default position: centered horizontally above the node.
  let left = topCenter.x - size.width / 2
  let top = topCenter.y - size.height - NODE_GAP

  // Flip below the node if it would clip the top of the viewport.
  if (top < FLIP_MARGIN) {
    top = bottomCenter.y + NODE_GAP
  }

  // Clamp horizontally to the viewport so the toolbar stays readable.
  left = Math.max(FLIP_MARGIN, Math.min(left, containerWidth - size.width - FLIP_MARGIN))

  const patch = (update: NodeUpdate) => onPatch(update)
  const deleteNode = () => onDelete()

  return (
    <div
      ref={toolbarRef}
      className="system-canvas-node-toolbar"
      // Stop pointer events from bubbling to the canvas (which would
      // deselect the node or start a pan).
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left,
        top,
        display: 'flex',
        alignItems: 'center',
        gap: BUTTON_GAP,
        padding: PADDING,
        background: theme.breadcrumbs.background,
        border: `1px solid ${theme.breadcrumbs.separatorColor}`,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(8px)',
        fontFamily: theme.node.fontFamily,
        fontSize: 11,
        color: theme.breadcrumbs.textColor,
        pointerEvents: 'auto',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {render ? (
        render({ node, theme, patch, deleteNode })
      ) : (
        <DefaultToolbarContent
          node={node}
          theme={theme}
          onPatch={patch}
          onDelete={deleteNode}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default content
// ---------------------------------------------------------------------------

interface DefaultToolbarContentProps {
  node: ResolvedNode
  theme: CanvasTheme
  onPatch: (update: NodeUpdate) => void
  onDelete: () => void
}

function DefaultToolbarContent({
  node,
  theme,
  onPatch,
  onDelete,
}: DefaultToolbarContentProps) {
  const groups = useMemo(() => getNodeActions(theme), [theme])

  return (
    <>
      {groups.map((group, i) => (
        <React.Fragment key={group.id}>
          {i > 0 && <Divider theme={theme} />}
          <ActionGroupView
            group={group}
            node={node}
            theme={theme}
            onPatch={onPatch}
          />
        </React.Fragment>
      ))}
      <Divider theme={theme} />
      <DeleteButton theme={theme} onDelete={onDelete} />
    </>
  )
}

function Divider({ theme }: { theme: CanvasTheme }) {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: theme.breadcrumbs.separatorColor,
        margin: `0 ${BUTTON_GAP / 2}px`,
      }}
    />
  )
}

interface ActionGroupViewProps {
  group: NodeActionGroup
  node: ResolvedNode
  theme: CanvasTheme
  onPatch: (update: NodeUpdate) => void
}

function ActionGroupView({ group, node, theme, onPatch }: ActionGroupViewProps) {
  const actions = filterActionsForNode(group, node)
  if (actions.length === 0) return null

  const kind = group.kind ?? 'buttons'

  if (kind === 'menu') {
    return <MenuGroup group={group} actions={actions} node={node} theme={theme} onPatch={onPatch} />
  }

  return (
    <div
      title={group.label}
      style={{ display: 'flex', alignItems: 'center', gap: BUTTON_GAP }}
    >
      {actions.map((action) => {
        const handleClick = () => {
          const patch = resolveActionPatch(action, node)
          onPatch(patch)
        }
        const active = action.isActive?.(node) ?? false
        if (kind === 'swatches') {
          return (
            <SwatchButton
              key={action.id}
              action={action}
              active={active}
              theme={theme}
              onClick={handleClick}
            />
          )
        }
        return (
          <IconButton
            key={action.id}
            action={action}
            active={active}
            theme={theme}
            onClick={handleClick}
          />
        )
      })}
    </div>
  )
}

function SwatchButton({
  action,
  active,
  theme,
  onClick,
}: {
  action: NodeAction
  active: boolean
  theme: CanvasTheme
  onClick: () => void
}) {
  const color = action.swatch ?? theme.node.labelColor
  return (
    <button
      type="button"
      title={action.label}
      onClick={onClick}
      style={{
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        borderRadius: '50%',
        background: color,
        border: active
          ? `2px solid ${theme.breadcrumbs.activeColor}`
          : `1px solid ${theme.breadcrumbs.separatorColor}`,
        padding: 0,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: active ? `0 0 0 2px ${theme.background}` : 'none',
        transition: 'transform 80ms ease-out',
      }}
      onMouseDown={(e) => e.preventDefault()}
    />
  )
}

function IconButton({
  action,
  active,
  theme,
  onClick,
}: {
  action: NodeAction
  active: boolean
  theme: CanvasTheme
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={action.label}
      onClick={onClick}
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active
          ? theme.breadcrumbs.separatorColor
          : 'transparent',
        border: `1px solid ${
          active ? theme.breadcrumbs.activeColor : theme.breadcrumbs.separatorColor
        }`,
        borderRadius: 6,
        color: active
          ? theme.breadcrumbs.activeColor
          : theme.breadcrumbs.textColor,
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {action.icon ? (
        <svg width={16} height={16} viewBox="0 0 16 16">
          <NodeIcon
            icon={action.icon}
            x={0}
            y={0}
            size={16}
            color={
              active
                ? theme.breadcrumbs.activeColor
                : theme.breadcrumbs.textColor
            }
            opacity={1}
            customIcons={theme.icons}
          />
        </svg>
      ) : action.swatch ? (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: action.swatch,
          }}
        />
      ) : (
        <span style={{ fontSize: 10 }}>{action.label.slice(0, 2)}</span>
      )}
    </button>
  )
}

interface MenuGroupProps {
  group: NodeActionGroup
  actions: NodeAction[]
  node: ResolvedNode
  theme: CanvasTheme
  onPatch: (update: NodeUpdate) => void
}

function MenuGroup({ group, actions, node, theme, onPatch }: MenuGroupProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const active = actions.find((a) => a.isActive?.(node))
  const triggerLabel = active?.label ?? group.label ?? 'Menu'
  const triggerIcon = active?.icon ?? undefined

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        title={group.label}
        onClick={() => setOpen((v) => !v)}
        style={{
          height: BUTTON_SIZE,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 10px',
          background: 'transparent',
          border: `1px solid ${theme.breadcrumbs.separatorColor}`,
          borderRadius: 6,
          color: theme.breadcrumbs.textColor,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          outline: 'none',
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {triggerIcon && (
          <svg width={14} height={14} viewBox="0 0 16 16">
            <NodeIcon
              icon={triggerIcon}
              x={0}
              y={0}
              size={14}
              color={theme.breadcrumbs.textColor}
              opacity={1}
              customIcons={theme.icons}
            />
          </svg>
        )}
        <span>{triggerLabel}</span>
        <span style={{ opacity: 0.6, fontSize: 8 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 160,
            padding: 4,
            background: theme.breadcrumbs.background,
            border: `1px solid ${theme.breadcrumbs.separatorColor}`,
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(8px)',
            zIndex: 1,
          }}
        >
          {actions.map((action) => {
            const isActive = action.isActive?.(node) ?? false
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  onPatch(resolveActionPatch(action, node))
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: isActive
                    ? theme.breadcrumbs.separatorColor
                    : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  color: isActive
                    ? theme.breadcrumbs.activeColor
                    : theme.breadcrumbs.textColor,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  textAlign: 'left',
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {action.icon && (
                  <svg width={14} height={14} viewBox="0 0 16 16">
                    <NodeIcon
                      icon={action.icon}
                      x={0}
                      y={0}
                      size={14}
                      color={
                        isActive
                          ? theme.breadcrumbs.activeColor
                          : theme.breadcrumbs.textColor
                      }
                      opacity={1}
                      customIcons={theme.icons}
                    />
                  </svg>
                )}
                {action.swatch && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: action.swatch,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DeleteButton({
  theme,
  onDelete,
}: {
  theme: CanvasTheme
  onDelete: () => void
}) {
  return (
    <button
      type="button"
      title="Delete"
      onClick={onDelete}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${theme.breadcrumbs.separatorColor}`,
        borderRadius: 6,
        color: theme.breadcrumbs.textColor,
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
    >
      <svg width={DELETE_SIZE} height={DELETE_SIZE} viewBox="0 0 16 16">
        <path
          d="M 3 5 L 13 5 M 6 5 L 6 3 L 10 3 L 10 5 M 5 5 L 5.5 14 L 10.5 14 L 11 5 M 7 7 L 7 12 M 9 7 L 9 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
