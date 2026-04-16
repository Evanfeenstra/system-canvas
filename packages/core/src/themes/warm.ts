import type { CanvasTheme } from '../types.js'

/**
 * Warm theme — dark warm grays, earth-tone accents.
 * Design studio / organic aesthetic.
 */
export const warmTheme: CanvasTheme = {
  name: 'warm',

  background: '#1a1714',

  grid: {
    size: 36,
    color: '#2a2520',
    strokeWidth: 0.4,
  },

  node: {
    fill: 'rgba(42, 37, 32, 0.6)',
    stroke: '#8b7e6a',
    strokeWidth: 1,
    cornerRadius: 10,
    labelColor: '#e8ddd0',
    sublabelColor: '#8b7e6a',
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
    fontSize: 12,
    sublabelFontSize: 9,
    refIndicator: {
      icon: 'chevron',
      color: 'rgba(139, 126, 106, 0.5)',
    },
  },

  edge: {
    stroke: '#6b5e4a',
    strokeWidth: 1.5,
    arrowSize: 10,
    labelColor: '#8b7e6a',
    labelFontSize: 9,
  },

  group: {
    fill: 'rgba(42, 37, 32, 0.3)',
    stroke: '#6b5e4a',
    strokeWidth: 1,
    strokeDasharray: '8,4',
    labelColor: '#8b7e6a',
    labelFontSize: 11,
    cornerRadius: 14,
  },

  breadcrumbs: {
    background: 'rgba(26, 23, 20, 0.95)',
    textColor: '#8b7e6a',
    activeColor: '#e8ddd0',
    separatorColor: '#4a4238',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
  },

  presetColors: {
    '1': { fill: 'rgba(160, 60, 50, 0.3)',   stroke: '#c77e6a' },  // terracotta
    '2': { fill: 'rgba(180, 120, 50, 0.3)',  stroke: '#d4a060' },  // amber/honey
    '3': { fill: 'rgba(180, 160, 60, 0.3)',  stroke: '#c8b860' },  // gold
    '4': { fill: 'rgba(80, 120, 70, 0.3)',   stroke: '#8aaa70' },  // sage
    '5': { fill: 'rgba(70, 120, 130, 0.3)',  stroke: '#70a8aa' },  // teal
    '6': { fill: 'rgba(100, 70, 120, 0.3)',  stroke: '#9a80b0' },  // dusty plum
  },

  categories: {},
}
