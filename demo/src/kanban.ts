import type { CanvasData, CanvasTheme } from 'system-canvas'
import { evenLanes } from 'system-canvas'

/**
 * Kanban-style example.
 *
 *  - columns only (To Do / Doing / Review / Done)
 *  - no rows
 *  - pastel paper background with colorful card-style nodes
 *  - nodeActions: priority swatches + delete
 *
 * Demonstrates that "columns" doesn't imply time or ordering — it can be a
 * workflow state. The theme below is defined inline rather than imported
 * from core; it's meant to show how a consumer writes their own theme.
 */

export const kanbanTheme: CanvasTheme = {
  name: 'kanban',

  background: '#15171c', // deep slate

  grid: {
    size: 40,
    color: '#1d2028',
    strokeWidth: 0.5,
  },

  node: {
    fill: 'rgba(34, 38, 48, 0.92)', // raised card on dark bg
    stroke: '#3a3f4c',
    strokeWidth: 1,
    cornerRadius: 10,
    labelColor: '#e8ebf2',
    sublabelColor: '#8a93a6',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontSize: 12,
    sublabelFontSize: 10,
    refIndicator: {
      icon: 'chevron',
      color: 'rgba(210, 217, 232, 0.95)',
    },
  },

  edge: {
    stroke: '#5a6478',
    strokeWidth: 1.3,
    arrowSize: 9,
    labelColor: '#8a93a6',
    labelFontSize: 9,
  },

  group: {
    fill: 'rgba(34, 38, 48, 0.35)',
    stroke: '#3a3f4c',
    strokeWidth: 1,
    strokeDasharray: '6,4',
    labelColor: '#8a93a6',
    labelFontSize: 11,
    cornerRadius: 10,
  },

  breadcrumbs: {
    background: 'rgba(21, 23, 28, 0.94)',
    textColor: '#8a93a6',
    activeColor: '#e8ebf2',
    separatorColor: '#3a3f4c',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontSize: 12,
  },

  // Subtle bands so the columns read as ambient structure, not stripes.
  lanes: {
    bandFillEven: 'rgba(60, 68, 86, 0.28)',
    bandFillOdd: 'rgba(60, 68, 86, 0.10)',
    dividerColor: 'rgba(90, 100, 120, 0.4)',
    dividerWidth: 1,
    headerBackground: 'rgba(21, 23, 28, 0.95)',
    headerTextColor: '#d2d9e8',
    headerFontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    headerFontSize: 12,
    headerSize: 34,
    headerPadding: 12,
  },

  // Priority-oriented preset colors — kanban cards often use color for
  // priority/severity rather than status (which is the column).
  presetColors: {
    '1': { fill: 'rgba(239, 68, 68, 0.22)',  stroke: '#f87171' }, // urgent
    '2': { fill: 'rgba(249, 115, 22, 0.22)', stroke: '#fb923c' }, // high
    '3': { fill: 'rgba(234, 179, 8, 0.22)',  stroke: '#fcd34d' }, // medium
    '4': { fill: 'rgba(34, 197, 94, 0.22)',  stroke: '#4ade80' }, // low
    '5': { fill: 'rgba(14, 165, 233, 0.22)', stroke: '#7dd3fc' }, // info
    '6': { fill: 'rgba(168, 85, 247, 0.22)', stroke: '#c4b5fd' }, // research
  },

  categories: {
    feature: {
      defaultWidth: 200,
      defaultHeight: 72,
      fill: 'rgba(14, 165, 233, 0.18)',
      stroke: '#7dd3fc',
      cornerRadius: 10,
      icon: 'zap',
      type: 'text',
    },
    bug: {
      defaultWidth: 200,
      defaultHeight: 72,
      fill: 'rgba(239, 68, 68, 0.18)',
      stroke: '#f87171',
      cornerRadius: 10,
      icon: 'shield',
      type: 'text',
    },
    chore: {
      defaultWidth: 200,
      defaultHeight: 72,
      fill: 'rgba(120, 113, 108, 0.2)',
      stroke: '#a8a29e',
      cornerRadius: 10,
      icon: 'cog',
      type: 'text',
    },
    research: {
      defaultWidth: 200,
      defaultHeight: 72,
      fill: 'rgba(168, 85, 247, 0.18)',
      stroke: '#c4b5fd',
      cornerRadius: 10,
      icon: 'code',
      type: 'text',
    },
  },

  nodeActions: [
    {
      id: 'priority',
      label: 'Priority',
      kind: 'swatches',
      actions: [
        {
          id: 'priority-urgent',
          label: 'Urgent',
          swatch: '#f87171',
          patch: (n) => ({
            color: '1',
            customData: { ...(n.customData ?? {}), priority: 'urgent' },
          }),
          isActive: (n) => n.customData?.priority === 'urgent',
        },
        {
          id: 'priority-high',
          label: 'High',
          swatch: '#fb923c',
          patch: (n) => ({
            color: '2',
            customData: { ...(n.customData ?? {}), priority: 'high' },
          }),
          isActive: (n) => n.customData?.priority === 'high',
        },
        {
          id: 'priority-medium',
          label: 'Medium',
          swatch: '#fcd34d',
          patch: (n) => ({
            color: '3',
            customData: { ...(n.customData ?? {}), priority: 'medium' },
          }),
          isActive: (n) => n.customData?.priority === 'medium',
        },
        {
          id: 'priority-low',
          label: 'Low',
          swatch: '#4ade80',
          patch: (n) => ({
            color: '4',
            customData: { ...(n.customData ?? {}), priority: 'low' },
          }),
          isActive: (n) => n.customData?.priority === 'low',
        },
      ],
    },
    {
      id: 'kind',
      label: 'Type',
      kind: 'menu',
      actions: [
        { id: 'k-feature', label: 'Feature', icon: 'zap', patch: { category: 'feature' }, isActive: (n) => n.category === 'feature' },
        { id: 'k-bug', label: 'Bug', icon: 'shield', patch: { category: 'bug' }, isActive: (n) => n.category === 'bug' },
        { id: 'k-chore', label: 'Chore', icon: 'cog', patch: { category: 'chore' }, isActive: (n) => n.category === 'chore' },
        { id: 'k-research', label: 'Research', icon: 'code', patch: { category: 'research' }, isActive: (n) => n.category === 'research' },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const COL_WIDTH = 260
const columns = evenLanes(['To Do', 'In Progress', 'Review', 'Done'], COL_WIDTH, 0)

// Stack cards vertically within a column.
const card = (col: number, idx: number, w = 220, h = 72) => ({
  x: col * COL_WIDTH + (COL_WIDTH - w) / 2,
  y: 40 + idx * 92,
  width: w,
  height: h,
})

export const kanbanRoot: CanvasData = {
  columns,
  nodes: [
    // To Do (0)
    { id: 'k1', type: 'text', category: 'feature', text: 'Profile avatar upload', ...card(0, 0) },
    { id: 'k2', type: 'text', category: 'bug', text: 'Login redirect loop on Safari', ...card(0, 1), color: '1', customData: { priority: 'urgent' } },
    { id: 'k3', type: 'text', category: 'chore', text: 'Bump node 20 → 22', ...card(0, 2) },
    { id: 'k4', type: 'text', category: 'research', text: 'Investigate ws reconnect', ...card(0, 3) },

    // In Progress (1)
    { id: 'k5', type: 'text', category: 'feature', text: 'Onboarding checklist', ...card(1, 0), color: '2', customData: { priority: 'high' } },
    { id: 'k6', type: 'text', category: 'bug', text: 'Toast dismiss jitter', ...card(1, 1), color: '3', customData: { priority: 'medium' } },

    // Review (2)
    { id: 'k7', type: 'text', category: 'feature', text: 'Billing portal SSO', ...card(2, 0), color: '2', customData: { priority: 'high' } },
    { id: 'k8', type: 'text', category: 'chore', text: 'Rotate signing keys', ...card(2, 1) },

    // Done (3)
    { id: 'k9', type: 'text', category: 'feature', text: 'Dark mode v1', ...card(3, 0), color: '4', customData: { priority: 'low' } },
    { id: 'k10', type: 'text', category: 'bug', text: 'Empty-state typo', ...card(3, 1), color: '4' },
    { id: 'k11', type: 'text', category: 'chore', text: 'Upgrade Vite 6', ...card(3, 2), color: '4' },
  ],
  edges: [],
}

export const kanbanCanvasMap: Record<string, CanvasData> = {}
