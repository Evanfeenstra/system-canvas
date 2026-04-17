// Types
export type {
  CanvasColor,
  NodeType,
  Side,
  EndShape,
  EdgeStyle,
  BackgroundStyle,
  CanvasNode,
  CanvasEdge,
  CanvasData,
  CanvasThemeHint,
  CategoryDefinition,
  PresetColor,
  GridConfig,
  RefIndicatorConfig,
  NodeTheme,
  EdgeTheme,
  GroupTheme,
  BreadcrumbTheme,
  CanvasTheme,
  ResolvedNode,
  AnchorPoint,
  ViewportState,
  BreadcrumbEntry,
  BoundingBox,
  ContextMenuEvent,
  NodeUpdate,
  EdgeUpdate,
  NodeMenuOption,
} from './types.js'

// Themes
export {
  darkTheme,
  midnightTheme,
  lightTheme,
  blueprintTheme,
  warmTheme,
  resolveTheme,
  resolveColor,
  resolveNode,
} from './themes/index.js'

// Rendering utilities
export {
  computeAnchorPoint,
  inferSide,
  computeEdgePath,
  computeEdgeMidpoint,
  computeBoundingBox,
  fitToBounds,
  screenToCanvas,
  canvasToScreen,
} from './rendering/index.js'

// Canvas helpers
export {
  resolveCanvas,
  buildNodeMap,
  getNodeLabel,
  getGroupChildren,
  validateCanvas,
  generateNodeId,
  getNodeMenuOptions,
  createNodeFromOption,
  addNode,
  updateNode,
  removeNode,
  updateEdge,
  removeEdge,
} from './canvas.js'

// Convenience theme collection
import { darkTheme as _dark } from './themes/dark.js'
import { midnightTheme as _midnight } from './themes/midnight.js'
import { lightTheme as _light } from './themes/light.js'
import { blueprintTheme as _blueprint } from './themes/blueprint.js'
import { warmTheme as _warm } from './themes/warm.js'

export const themes = {
  dark: _dark,
  midnight: _midnight,
  light: _light,
  blueprint: _blueprint,
  warm: _warm,
} as const
