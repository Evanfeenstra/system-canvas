import type { CanvasData } from 'system-canvas'
import { evenLanes } from 'system-canvas'

/**
 * A roadmap-flavored canvas. Demonstrates:
 *   - Ordinal columns (Now / Next / Later / Someday)
 *   - Team swim lanes as rows
 *   - Roadmap theme categories: initiative, milestone, outcome, blocker
 *   - Sub-canvas refs for drilling into an initiative
 */

const COL_WIDTH = 320
const ROW_HEIGHT = 180

const columns = evenLanes(['Now', 'Next', 'Later', 'Someday'], COL_WIDTH, 0)
const rows = [
  { id: 'product', label: 'Product', start: 0, size: ROW_HEIGHT },
  { id: 'platform', label: 'Platform', start: ROW_HEIGHT, size: ROW_HEIGHT },
  { id: 'design', label: 'Design', start: ROW_HEIGHT * 2, size: ROW_HEIGHT },
]

// Helper to center a node inside a cell.
const cell = (col: number, row: number, w: number, h: number) => ({
  x: col * COL_WIDTH + (COL_WIDTH - w) / 2,
  y: row * ROW_HEIGHT + (ROW_HEIGHT - h) / 2,
})

export const roadmapRoot: CanvasData = {
  theme: { base: 'roadmap' },
  columns,
  rows,
  nodes: [
    // --- Product row ---
    {
      id: 'p-now',
      type: 'text',
      category: 'initiative',
      text: 'Onboarding v2',
      ...cell(0, 0, 200, 72),
      ref: 'roadmap:onboarding',
    },
    {
      id: 'p-next',
      type: 'text',
      category: 'initiative',
      text: 'Billing redesign',
      ...cell(1, 0, 200, 72),
    },
    {
      id: 'p-later',
      type: 'text',
      category: 'outcome',
      text: 'Enterprise tier',
      ...cell(2, 0, 200, 68),
    },
    {
      id: 'p-someday',
      type: 'text',
      category: 'parked',
      text: 'Mobile app',
      ...cell(3, 0, 180, 56),
    },

    // --- Platform row ---
    {
      id: 'pl-now',
      type: 'text',
      category: 'initiative',
      text: 'Auth migration',
      ...cell(0, 1, 200, 72),
    },
    {
      id: 'pl-now-milestone',
      type: 'text',
      category: 'milestone',
      text: 'SOC2 audit',
      ...cell(0, 1, 160, 52),
      y: cell(0, 1, 160, 52).y + 70,
    },
    {
      id: 'pl-next',
      type: 'text',
      category: 'blocker',
      text: 'Legacy DB sunset',
      ...cell(1, 1, 180, 56),
    },
    {
      id: 'pl-later',
      type: 'text',
      category: 'initiative',
      text: 'Multi-region',
      ...cell(2, 1, 200, 72),
    },

    // --- Design row ---
    {
      id: 'd-now',
      type: 'text',
      category: 'outcome',
      text: 'Design system v3',
      ...cell(0, 2, 200, 68),
    },
    {
      id: 'd-next',
      type: 'text',
      category: 'initiative',
      text: 'Marketing site refresh',
      ...cell(1, 2, 200, 72),
    },
    {
      id: 'd-later',
      type: 'text',
      category: 'milestone',
      text: 'Brand relaunch',
      ...cell(2, 2, 160, 52),
    },
  ],
  edges: [
    // Flow from Now → Next → Later within Product
    { id: 'e1', fromNode: 'p-now', toNode: 'p-next', label: 'unblocks' },
    { id: 'e2', fromNode: 'p-next', toNode: 'p-later' },
    // Platform dependency into Product
    { id: 'e3', fromNode: 'pl-now', toNode: 'p-next', label: 'depends on' },
    // Design → Platform collaboration
    { id: 'e4', fromNode: 'd-now', toNode: 'p-next' },
  ],
}

// A sub-roadmap reached via the p-now node's ref
export const onboardingSub: CanvasData = {
  theme: { base: 'roadmap' },
  columns: evenLanes(['Week 1', 'Week 2', 'Week 3'], 280, 0),
  nodes: [
    {
      id: 'task-1',
      type: 'text',
      category: 'milestone',
      text: 'Wireframes locked',
      x: 60,
      y: 40,
    },
    {
      id: 'task-2',
      type: 'text',
      category: 'initiative',
      text: 'Frontend build',
      x: 320,
      y: 40,
      width: 220,
      height: 72,
    },
    {
      id: 'task-3',
      type: 'text',
      category: 'outcome',
      text: 'Ship to 10% of users',
      x: 620,
      y: 40,
    },
  ],
  edges: [
    { id: 'se1', fromNode: 'task-1', toNode: 'task-2' },
    { id: 'se2', fromNode: 'task-2', toNode: 'task-3' },
  ],
}

export const roadmapCanvasMap: Record<string, CanvasData> = {
  'roadmap:onboarding': onboardingSub,
}
