export function snapToGrid(value: number, size: number): number {
  if (size <= 0) return value
  return Math.round(value / size) * size
}
