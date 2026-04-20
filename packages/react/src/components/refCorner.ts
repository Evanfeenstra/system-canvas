/**
 * Slot positions use camelCase (`topLeft`), RefIndicator uses kebab-case
 * (`top-left`) for historical reasons. Keep the internal representation
 * consistent and convert at the boundary.
 */
export type RefCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export type KebabCorner =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export function toKebabCorner(c: RefCorner): KebabCorner {
  switch (c) {
    case 'topLeft':
      return 'top-left'
    case 'topRight':
      return 'top-right'
    case 'bottomLeft':
      return 'bottom-left'
    case 'bottomRight':
      return 'bottom-right'
  }
}
