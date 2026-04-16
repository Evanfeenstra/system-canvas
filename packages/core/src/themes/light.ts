import type { CanvasTheme } from '../types.js'

/**
 * Light theme — clean white/gray, subtle borders, muted fills.
 * Professional / documentation aesthetic.
 */
export const lightTheme: CanvasTheme = {
  name: 'light',

  background: '#f8fafc', // slate-50

  grid: {
    size: 40,
    color: '#e2e8f0', // slate-200
    strokeWidth: 0.5,
  },

  node: {
    fill: 'rgba(241, 245, 249, 0.9)',  // slate-100
    stroke: '#cbd5e1',                  // slate-300
    strokeWidth: 1,
    cornerRadius: 8,
    labelColor: '#0f172a',              // slate-900
    sublabelColor: '#64748b',           // slate-500
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontSize: 12,
    sublabelFontSize: 9,
    refIndicator: {
      icon: 'chevron',
      color: 'rgba(100, 116, 139, 0.5)',
    },
  },

  edge: {
    stroke: '#94a3b8',     // slate-400
    strokeWidth: 1.5,
    arrowSize: 10,
    labelColor: '#64748b', // slate-500
    labelFontSize: 9,
  },

  group: {
    fill: 'rgba(241, 245, 249, 0.5)',
    stroke: '#cbd5e1',
    strokeWidth: 1,
    strokeDasharray: '8,4',
    labelColor: '#64748b',
    labelFontSize: 11,
    cornerRadius: 12,
  },

  breadcrumbs: {
    background: 'rgba(255, 255, 255, 0.95)',
    textColor: '#64748b',
    activeColor: '#0f172a',
    separatorColor: '#cbd5e1',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontSize: 12,
  },

  presetColors: {
    '1': { fill: 'rgba(254, 226, 226, 0.7)', stroke: '#ef4444' },  // red
    '2': { fill: 'rgba(255, 237, 213, 0.7)', stroke: '#f97316' },  // orange
    '3': { fill: 'rgba(254, 249, 195, 0.7)', stroke: '#eab308' },  // yellow
    '4': { fill: 'rgba(220, 252, 231, 0.7)', stroke: '#22c55e' },  // green
    '5': { fill: 'rgba(207, 250, 254, 0.7)', stroke: '#06b6d4' },  // cyan
    '6': { fill: 'rgba(237, 233, 254, 0.7)', stroke: '#8b5cf6' },  // violet
  },

  categories: {},
}
