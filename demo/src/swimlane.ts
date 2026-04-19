import type { CanvasData, CanvasTheme, CanvasLane } from 'system-canvas'

/**
 * Swim lane example.
 *
 *  - rows only (Design / Engineering / QA / Release)
 *  - no columns
 *  - teal/blue "process" palette
 *  - flow-style edges connecting tasks across rows
 *
 * Demonstrates a rows-only canvas — the same primitive as the kanban
 * columns, rotated 90°. The library draws a left header strip automatically
 * and no top strip because columns is undefined.
 */

export const swimlaneTheme: CanvasTheme = {
  name: 'swimlane',

  background: '#0b1520',

  grid: {
    size: 48,
    color: '#13243a',
    strokeWidth: 0.5,
  },

  node: {
    fill: 'rgba(17, 32, 48, 0.85)',
    stroke: '#3d6a8e',
    strokeWidth: 1,
    cornerRadius: 6,
    labelColor: '#dbeafe',
    sublabelColor: '#7aa4c7',
    fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
    fontSize: 12,
    sublabelFontSize: 10,
    refIndicator: {
      icon: 'arrow',
      color: 'rgba(219, 234, 254, 0.95)',
    },
  },

  edge: {
    stroke: '#5a87ab',
    strokeWidth: 1.5,
    arrowSize: 10,
    labelColor: '#9cc0e0',
    labelFontSize: 10,
  },

  group: {
    fill: 'rgba(17, 32, 48, 0.4)',
    stroke: '#3d6a8e',
    strokeWidth: 1,
    strokeDasharray: '6,4',
    labelColor: '#7aa4c7',
    labelFontSize: 11,
    cornerRadius: 8,
  },

  breadcrumbs: {
    background: 'rgba(11, 21, 32, 0.94)',
    textColor: '#7aa4c7',
    activeColor: '#dbeafe',
    separatorColor: '#2a3f56',
    fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
    fontSize: 12,
  },

  lanes: {
    bandFillEven: 'rgba(30, 50, 75, 0.4)',
    bandFillOdd: 'rgba(30, 50, 75, 0.15)',
    dividerColor: 'rgba(90, 135, 171, 0.35)',
    dividerWidth: 1,
    headerBackground: 'rgba(11, 21, 32, 0.94)',
    headerTextColor: '#9cc0e0',
    headerFontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
    headerFontSize: 12,
    headerSize: 34,
    headerPadding: 12,
  },

  presetColors: {
    '1': { fill: 'rgba(239, 68, 68, 0.22)',  stroke: '#f87171' }, // blocker
    '2': { fill: 'rgba(251, 146, 60, 0.22)', stroke: '#fb923c' }, // at-risk
    '3': { fill: 'rgba(234, 179, 8, 0.22)',  stroke: '#fcd34d' }, // in-progress
    '4': { fill: 'rgba(74, 222, 128, 0.22)', stroke: '#4ade80' }, // done
    '5': { fill: 'rgba(56, 189, 248, 0.22)', stroke: '#7dd3fc' }, // planned
    '6': { fill: 'rgba(168, 85, 247, 0.22)', stroke: '#c4b5fd' }, // research
  },

  categories: {
    task: {
      defaultWidth: 180,
      defaultHeight: 56,
      fill: 'rgba(56, 189, 248, 0.14)',
      stroke: '#7dd3fc',
      cornerRadius: 6,
      icon: 'terminal',
      type: 'text',
    },
    decision: {
      defaultWidth: 170,
      defaultHeight: 56,
      fill: 'rgba(234, 179, 8, 0.14)',
      stroke: '#fcd34d',
      cornerRadius: 14,
      icon: 'network',
      type: 'text',
    },
    handoff: {
      defaultWidth: 160,
      defaultHeight: 44,
      fill: 'rgba(168, 85, 247, 0.14)',
      stroke: '#c4b5fd',
      cornerRadius: 4,
      icon: 'users',
      type: 'text',
    },
    release: {
      defaultWidth: 180,
      defaultHeight: 56,
      fill: 'rgba(74, 222, 128, 0.14)',
      stroke: '#4ade80',
      cornerRadius: 10,
      icon: 'package',
      type: 'text',
    },
  },

  nodeActions: [
    {
      id: 'status',
      label: 'Status',
      kind: 'swatches',
      actions: [
        {
          id: 'st-planned',
          label: 'Planned',
          swatch: '#7dd3fc',
          patch: (n) => ({
            color: '5',
            customData: { ...(n.customData ?? {}), status: 'planned' },
          }),
          isActive: (n) => n.customData?.status === 'planned',
        },
        {
          id: 'st-in-progress',
          label: 'In progress',
          swatch: '#fcd34d',
          patch: (n) => ({
            color: '3',
            customData: { ...(n.customData ?? {}), status: 'in-progress' },
          }),
          isActive: (n) => n.customData?.status === 'in-progress',
        },
        {
          id: 'st-done',
          label: 'Done',
          swatch: '#4ade80',
          patch: (n) => ({
            color: '4',
            customData: { ...(n.customData ?? {}), status: 'done' },
          }),
          isActive: (n) => n.customData?.status === 'done',
        },
        {
          id: 'st-blocked',
          label: 'Blocked',
          swatch: '#f87171',
          patch: (n) => ({
            color: '1',
            customData: { ...(n.customData ?? {}), status: 'blocked' },
          }),
          isActive: (n) => n.customData?.status === 'blocked',
        },
      ],
    },
    {
      id: 'kind',
      label: 'Type',
      kind: 'menu',
      actions: [
        { id: 'sk-task', label: 'Task', icon: 'terminal', patch: { category: 'task' }, isActive: (n) => n.category === 'task' },
        { id: 'sk-decision', label: 'Decision', icon: 'network', patch: { category: 'decision' }, isActive: (n) => n.category === 'decision' },
        { id: 'sk-handoff', label: 'Handoff', icon: 'users', patch: { category: 'handoff' }, isActive: (n) => n.category === 'handoff' },
        { id: 'sk-release', label: 'Release', icon: 'package', patch: { category: 'release' }, isActive: (n) => n.category === 'release' },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 160

const rows: CanvasLane[] = [
  { id: 'design', label: 'Design', start: 0, size: ROW_HEIGHT },
  { id: 'engineering', label: 'Engineering', start: ROW_HEIGHT, size: ROW_HEIGHT },
  { id: 'qa', label: 'QA', start: ROW_HEIGHT * 2, size: ROW_HEIGHT },
  { id: 'release', label: 'Release', start: ROW_HEIGHT * 3, size: ROW_HEIGHT },
]

// Position inside a row: x progresses left-to-right as a loose timeline;
// y centers the node within the given row.
const at = (row: number, x: number, w = 180, h = 56) => ({
  x,
  y: row * ROW_HEIGHT + (ROW_HEIGHT - h) / 2,
  width: w,
  height: h,
})

export const swimlaneRoot: CanvasData = {
  rows,
  nodes: [
    // Design row (0)
    { id: 's1', type: 'text', category: 'task', text: 'Wireframes', ...at(0, 60), color: '4', customData: { status: 'done' } },
    { id: 's2', type: 'text', category: 'decision', text: 'Design review', ...at(0, 280), color: '4', customData: { status: 'done' } },
    { id: 's3', type: 'text', category: 'task', text: 'Final mocks', ...at(0, 490), color: '3', customData: { status: 'in-progress' } },

    // Engineering row (1)
    { id: 's4', type: 'text', category: 'task', text: 'Schema changes', ...at(1, 280), color: '4', customData: { status: 'done' } },
    { id: 's5', type: 'text', category: 'task', text: 'Frontend build', ...at(1, 490), color: '3', customData: { status: 'in-progress' } },
    { id: 's6', type: 'text', category: 'task', text: 'API endpoints', ...at(1, 700), color: '5', customData: { status: 'planned' } },
    { id: 's7', type: 'text', category: 'handoff', text: 'Code freeze', ...at(1, 910, 160, 44), color: '5' },

    // QA row (2)
    { id: 's8', type: 'text', category: 'task', text: 'Test plan', ...at(2, 700), color: '5', customData: { status: 'planned' } },
    { id: 's9', type: 'text', category: 'task', text: 'Regression pass', ...at(2, 910), color: '5', customData: { status: 'planned' } },
    { id: 's10', type: 'text', category: 'decision', text: 'Go / no-go', ...at(2, 1130, 170), color: '5' },

    // Release row (3)
    { id: 's11', type: 'text', category: 'release', text: 'Staging rollout', ...at(3, 1130), color: '5' },
    { id: 's12', type: 'text', category: 'release', text: 'Production v1', ...at(3, 1350), color: '5' },
  ],
  edges: [
    { id: 'se1', fromNode: 's1', toNode: 's2' },
    { id: 'se2', fromNode: 's2', toNode: 's3' },
    { id: 'se3', fromNode: 's3', toNode: 's4', label: 'handoff' },
    { id: 'se4', fromNode: 's4', toNode: 's5' },
    { id: 'se5', fromNode: 's5', toNode: 's6' },
    { id: 'se6', fromNode: 's6', toNode: 's7' },
    { id: 'se7', fromNode: 's7', toNode: 's8', label: 'QA starts' },
    { id: 'se8', fromNode: 's8', toNode: 's9' },
    { id: 'se9', fromNode: 's9', toNode: 's10' },
    { id: 'se10', fromNode: 's10', toNode: 's11', label: 'approved' },
    { id: 'se11', fromNode: 's11', toNode: 's12' },
  ],
}

export const swimlaneCanvasMap: Record<string, CanvasData> = {}
