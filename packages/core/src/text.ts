// ---------------------------------------------------------------------------
// Text measurement & wrapping
//
// Pure helpers used by the library's text-rendering slot to wrap node text
// to a region width without needing a DOM. Re-exported so consumers writing
// `kind: 'custom'` slots can reuse the same wrap behavior the declarative
// `kind: 'text'` slot uses internally.
//
// The width estimate is intentionally rough (a single per-glyph ratio). For
// SVG text in monospace or near-monospace UI fonts at small sizes (10-18px),
// it's accurate enough that wrapped lines fit comfortably with a small
// trailing safety margin. We do not attempt real font metrics — that would
// require a DOM canvas or a font-shaping library, and would change the
// library's "pure math" boundary.
// ---------------------------------------------------------------------------

/**
 * Average glyph-width-to-font-size ratio used by `measureTextWidth`. Tuned
 * for UI sans/mono mixes; matches what most consumer code reaches for when
 * estimating SVG text widths in the absence of real font metrics.
 */
const GLYPH_WIDTH_RATIO = 0.62

/**
 * Rough width in pixels for `text` rendered at `fontSize`. Uses a single
 * average glyph-width ratio — good enough for layout decisions like
 * word-wrap or column placement, not pixel-perfect.
 *
 * For empty input returns 0.
 */
export function measureTextWidth(text: string, fontSize: number): number {
  if (!text) return 0
  return text.length * fontSize * GLYPH_WIDTH_RATIO
}

/**
 * Word-wrap a single paragraph string into lines that fit within `maxWidth`
 * pixels at `fontSize`. Words longer than `maxWidth` are placed on their
 * own line and may overflow — callers that clip to a region won't see the
 * overflow visually, and breaking inside words would mangle identifiers.
 *
 * `\n` is **not** interpreted here. Callers should split on `\n` first
 * and call `wrapText` per paragraph (see `wrapTextWithBreaks`).
 *
 * Returns an array with at least one entry — an empty input yields `['']`
 * so callers that render one `<text>` per line still emit a placeholder
 * line and preserve baseline math.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  if (!text) return ['']
  if (maxWidth <= 0) return [text]
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measureTextWidth(candidate, fontSize) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/**
 * Word-wrap with explicit line breaks. Splits `text` on `\n`, runs each
 * paragraph through `wrapText`, and concatenates the results. An empty
 * paragraph (two consecutive newlines) emits one empty line so vertical
 * spacing is preserved.
 *
 * `maxLines`, when provided, truncates the output to that many lines and
 * appends an ellipsis to the final line if truncation occurred. Useful
 * for fixed-height regions where overflow would clip mid-glyph.
 */
export function wrapTextWithBreaks(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines?: number
): string[] {
  if (!text) return []
  const paragraphs = text.split('\n')
  const out: string[] = []
  for (const para of paragraphs) {
    if (para === '') {
      out.push('')
      continue
    }
    out.push(...wrapText(para, maxWidth, fontSize))
  }
  if (maxLines !== undefined && maxLines > 0 && out.length > maxLines) {
    const truncated = out.slice(0, maxLines)
    const last = truncated[truncated.length - 1]
    truncated[truncated.length - 1] = ellipsize(last, maxWidth, fontSize)
    return truncated
  }
  return out
}

/**
 * Trim `line` so that `line + '…'` fits within `maxWidth`. If the entire
 * line already fits, just appends the ellipsis. Conservative — drops one
 * word at a time from the end rather than a single character, to avoid
 * truncating mid-word.
 */
function ellipsize(line: string, maxWidth: number, fontSize: number): string {
  const ellipsis = '…'
  if (measureTextWidth(line + ellipsis, fontSize) <= maxWidth) {
    return line + ellipsis
  }
  const words = line.split(' ')
  while (words.length > 1) {
    words.pop()
    const candidate = words.join(' ') + ellipsis
    if (measureTextWidth(candidate, fontSize) <= maxWidth) return candidate
  }
  // Single word longer than maxWidth — return as-is with ellipsis.
  return line + ellipsis
}
