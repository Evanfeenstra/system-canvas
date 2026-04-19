import type {
  CanvasNode,
  CanvasTheme,
  NodeAction,
  NodeActionGroup,
  NodeUpdate,
} from './types.js'

/**
 * Resolve a NodeAction's patch against the given node.
 *
 * Actions may declare their patch as a static object or as a function
 * that receives the current node — the function form enables toggles,
 * cycles, and customData merges.
 */
export function resolveActionPatch(
  action: NodeAction,
  node: CanvasNode
): NodeUpdate {
  return typeof action.patch === 'function' ? action.patch(node) : action.patch
}

/**
 * Build the default action group used when a theme does not declare its
 * own `nodeActions`. Renders the theme's preset colors "1".."6" as
 * swatches that patch the node's `color`.
 */
export function buildDefaultColorActions(theme: CanvasTheme): NodeActionGroup {
  const keys = Object.keys(theme.presetColors).sort()
  const actions: NodeAction[] = keys.map((key) => {
    const preset = theme.presetColors[key]
    return {
      id: `color-${key}`,
      label: `Color ${key}`,
      swatch: preset.stroke,
      patch: { color: key },
      isActive: (n) => n.color === key,
    }
  })
  return {
    id: 'color',
    label: 'Color',
    kind: 'swatches',
    actions,
  }
}

/**
 * Return the effective list of action groups for a theme. Themes that
 * declare `nodeActions` win; otherwise a generic color-swatch group is
 * synthesized from `presetColors`.
 */
export function getNodeActions(theme: CanvasTheme): NodeActionGroup[] {
  if (theme.nodeActions && theme.nodeActions.length > 0) {
    return theme.nodeActions
  }
  return [buildDefaultColorActions(theme)]
}

/**
 * Filter a group's actions against a specific node using each action's
 * `appliesTo` predicate (actions without `appliesTo` always apply).
 */
export function filterActionsForNode(
  group: NodeActionGroup,
  node: CanvasNode
): NodeAction[] {
  return group.actions.filter((a) => !a.appliesTo || a.appliesTo(node))
}
