// Main component
export { SystemCanvas } from './components/SystemCanvas.js'
export type { SystemCanvasProps } from './components/SystemCanvas.js'

// Individual components (for custom composition)
export { Viewport, type ViewportHandle } from './components/Viewport.js'
export { NodeRenderer } from './components/NodeRenderer.js'
export { EdgeRenderer } from './components/EdgeRenderer.js'
export { Breadcrumbs } from './components/Breadcrumbs.js'
export { TextNode } from './components/TextNode.js'
export { FileNode } from './components/FileNode.js'
export { LinkNode } from './components/LinkNode.js'
export { GroupNode } from './components/GroupNode.js'
export { NodeIcon } from './components/NodeIcon.js'

// Hooks
export { useViewport } from './hooks/useViewport.js'
export { useNavigation } from './hooks/useNavigation.js'
export { useCanvasInteraction } from './hooks/useCanvasInteraction.js'

// Re-export everything from core for convenience
export * from 'system-canvas'
