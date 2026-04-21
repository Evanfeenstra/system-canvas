---
name: system-canvas
description: Generate a single self-contained HTML file with an interactive, pan-and-zoomable system diagram using system-canvas-standalone from a CDN. Use when the user asks to "draw a diagram", "visualize this system", "explain this architecture", "map the codebase", "show a roadmap", "make a system map", "diagram the data flow", or any time a visual explanation benefits from hierarchy, sub-systems, or more than ~5 boxes. Prefer this over Mermaid, ASCII art, or static SVG when the thing being explained has nested structure (services with internal components, teams with initiatives, pipelines with stages), more than ~8 nodes, or when the user will actually want to explore it. Output is one `.html` file that opens directly in a browser -- no build, no server, no npm install.
---

# system-canvas

Produce one HTML file that renders an interactive, zoomable, optionally-nested diagram using the `system-canvas-standalone` CDN bundle. The user opens it in a browser and pans, zooms, and drills into sub-canvases.

## When to use this

Reach for this over Mermaid or ASCII whenever the subject has any of:

- **Hierarchy** -- nested sub-systems the user can drill into via `ref` + `canvases`.
- **More than ~8 nodes** -- pan/zoom solves readability that Mermaid can't.
- **Mixed concept types** -- services, DBs, queues, users. Categories give each a consistent style.
- **An ordered axis** -- timeline, pipeline, swim lanes. Use `columns` / `rows`.

Three boxes and two arrows? Use Mermaid. This skill is for diagrams the user will explore.

## The template

Write one HTML file. Fill in `canvas` (and optionally `canvases`, `theme`, `edgeStyle`).

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>System diagram</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0a0a0a; }
      #app { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://unpkg.com/system-canvas-standalone@latest/dist/system-canvas.min.js"></script>
    <script>
      const canvas = {
        nodes: [ /* ... */ ],
        edges: [ /* ... */ ],
      };

      SystemCanvas.render(document.getElementById('app'), {
        canvas,
        theme: 'midnight',
        edgeStyle: 'bezier',
      });
    </script>
  </body>
</html>
```

Always load `@latest/dist/system-canvas.min.js` from unpkg. Never spin up a dev server or inline the bundle.

## Data model

```js
{
  theme: { base: 'midnight', categories: { /* optional */ } },
  nodes: [{ id: 'api', type: 'text', text: 'API Server', x: 0, y: 0, category: 'service' }],
  edges: [{ id: 'e1', fromNode: 'api', toNode: 'db', label: 'queries' }],
  columns: [ /* optional lanes */ ],
  rows:    [ /* optional */ ],
}
```

**Node types**:
- `text` -- default; has `text`. Use this unless you have a reason not to.
- `file` -- has `file` (path). File styling.
- `link` -- has `url`. Link styling.
- `group` -- translucent container; has `label`. Place children spatially inside; dragging moves them.

**Required on every node**: `id`, `type`, `x`, `y`. No category? Also set `width` and `height`.

**Required on every edge**: `id`, `fromNode`, `toNode`. Encouraged: `label`. Optional: `fromSide` / `toSide` (`'top' | 'right' | 'bottom' | 'left'`) -- usually let auto-routing handle it.

**Extension fields**:
- `category` on a node -- maps to a `CategoryDefinition` (default size, colors, icon, slots). Use this instead of repeating `width`/`height`/`color` everywhere.
- `ref` on a node -- key into `canvases`. Makes the node navigable; corner indicator appears.
- `theme` at the top level -- inline override, commonly `{ base: 'midnight', categories: {...} }`.

## Layout heuristics

- Default node size ~**160x70**. Assume that footprint when you don't set size/category.
- Peer spacing: **~240px horizontal**, **~120px vertical**.
- Origin `(0, 0)` is fine -- viewport auto-fits on mount. Negative coords are OK; centering around origin often reads better.
- **Left-to-right** for data flow. **Top-down** for hierarchies. **Radial** for hub-and-spoke.
- Cap a single canvas at **~12 nodes**. Past that, extract via `ref`.

**Groups**: size them to visually contain their children. Four 160x70 nodes in a 2x2 grid → group ~380x220. Group `(x, y)` is the top-left of the bounding rect. Groups render *behind* their contents.

## Categories: define once, reference everywhere

Skip categories and every node needs `width`/`height`/`color` spelled out -- inconsistent and hand-rolled.

```js
theme: {
  base: 'midnight',
  categories: {
    service:  { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(6,78,59,0.4)',  stroke: '#34d399' },
    database: { defaultWidth: 140, defaultHeight: 70, fill: 'rgba(76,29,149,0.4)', stroke: '#a78bfa' },
    queue:    { defaultWidth: 140, defaultHeight: 60, fill: 'rgba(120,53,15,0.4)', stroke: '#fbbf24' },
    external: { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(30,41,59,0.4)',  stroke: '#94a3b8' },
  },
},
```

Three to six categories, distinct hues.

### Category slots (optional, powerful)

A category can declare `slots` -- small visual add-ons rendered in fixed positions on every node of that category. Use them for at-a-glance state without cluttering the label.

- **Kinds**: `color` (accent strip), `progress` (0..1 bar), `count` (badge), `pill` (short tag like OK/RISK), `text` (kicker), `dot`, `custom` (your SVG).
- **Positions**: edge strips `topEdge`/`bottomEdge`/`leftEdge`/`rightEdge` (bleed into corners); `header`/`footer` inset strips; `bodyTop` inline band under the title; four corners `topLeft`/`topRight`/`bottomLeft`/`bottomRight`; `topRightOuter` tab badge hanging off the corner. One slot per position.
- **Color inheritance**: `color` is optional on every color-bearing slot (`color`, `progress`, `count`, `pill`, `dot`) -- omit it and the slot inherits the node/category stroke. Usually just set `stroke` on the category; leave slot colors blank.
- **Dynamic values**: `value: (ctx) => ctx.node.customData.progress`. When the node has a `ref`, `ctx.rollup(pred)` rolls up its sub-canvas -- e.g. a parent shows "3/5 healthy" derived from children.

```js
service: {
  defaultWidth: 160, defaultHeight: 70,
  fill: 'rgba(6,78,59,0.4)', stroke: '#34d399',
  slots: {
    header: { kind: 'text', value: 'SERVICE' },
    bottomEdge: {
      kind: 'progress',
      value: ({ rollup }) => rollup(n => n.customData?.status === 'ok').fraction,
    }, // color omitted -- inherits '#34d399'
  },
},
```

Skip slots for simple diagrams. Reach for them when state, counts, progress, or status deserve visual weight.

## Nested sub-canvases (the killer feature)

A node with `ref` becomes navigable; supply a matching `canvases` map.

```js
const canvases = {
  'api-internals': {
    nodes: [
      { id: 'router',  type: 'text', text: 'Router',   x: 0,   y: 0, category: 'component' },
      { id: 'auth',    type: 'text', text: 'Auth MW',  x: 240, y: 0, category: 'component' },
      { id: 'handler', type: 'text', text: 'Handlers', x: 480, y: 0, category: 'component' },
    ],
    edges: [
      { id: 'e1', fromNode: 'router', toNode: 'auth' },
      { id: 'e2', fromNode: 'auth',   toNode: 'handler' },
    ],
  },
};

// on root canvas:
{ id: 'api', type: 'text', text: 'API Server', x: 0, y: 0, category: 'service', ref: 'api-internals' }
```

The user clicks the corner indicator to drill in; breadcrumbs navigate back. Sub-canvases can nest their own `ref`s.

**When to nest**: whenever a node would need a sentence to describe, or has substantial internal structure.

## Edges

- Unique `id` every time.
- Add `label` when the relationship isn't obvious ("HTTPS", "publishes", "reads from"). Skip when direction alone is self-evident.
- Pick `edgeStyle` once:
  - `'bezier'` (default) -- organic curves. Best for most diagrams.
  - `'orthogonal'` -- right angles. Best for grid-aligned architecture.
  - `'straight'` -- direct lines. Sparse / utilitarian.

## Themes

Pass `theme: 'name'` or `{ base: 'name', categories: {...} }`. Built-ins:

- `'midnight'` -- deep blue-black, high contrast. Default for technical demos.
- `'dark'` -- neutral dark gray. When midnight feels too blue.
- `'blueprint'` -- cyan-on-navy grid. "This is an architecture" vibes.
- `'light'` -- white bg. For docs / light-themed pages.
- `'warm'` -- cream bg, editorial.
- `'roadmap'` -- pairs with `columns`/`rows`. Ships initiative/milestone/outcome/blocker categories.

## Lanes (only when there's a natural axis)

Time (Q1/Q2/Q3), status (Now/Next/Later), pipeline stages, or swim lanes → use `columns` or `rows`, pair with `roadmap` theme.

```js
{
  theme: { base: 'roadmap' },
  columns: [
    { id: 'now',   label: 'Now',   start: 0,   size: 320 },
    { id: 'next',  label: 'Next',  start: 320, size: 320 },
    { id: 'later', label: 'Later', start: 640, size: 320 },
  ],
  nodes: [
    { id: 'a', type: 'text', text: 'Ship v1',     x: 40,  y: 40, category: 'initiative' },
    { id: 'b', type: 'text', text: 'Auth rework', x: 360, y: 40, category: 'initiative' },
  ],
}
// render options: { laneHeaders: 'pinned' }
```

Skip lanes for non-axial diagrams.

## Worked example

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Web app architecture</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0a0a0a; }
      #app { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://unpkg.com/system-canvas-standalone@latest/dist/system-canvas.min.js"></script>
    <script>
      const categories = {
        service:  { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(6,78,59,0.4)',  stroke: '#34d399' },
        database: { defaultWidth: 140, defaultHeight: 70, fill: 'rgba(76,29,149,0.4)', stroke: '#a78bfa' },
        queue:    { defaultWidth: 140, defaultHeight: 60, fill: 'rgba(120,53,15,0.4)', stroke: '#fbbf24' },
        external: { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(30,41,59,0.4)',  stroke: '#94a3b8' },
        component:{ defaultWidth: 140, defaultHeight: 60, fill: 'rgba(30,64,175,0.4)', stroke: '#60a5fa' },
      };

      const canvas = {
        theme: { base: 'midnight', categories },
        nodes: [
          { id: 'web',    type: 'text', text: 'Web App\nReact',  x: -260, y: 0,   category: 'external' },
          { id: 'api',    type: 'text', text: 'API Server',      x: 0,    y: 0,   category: 'service', ref: 'api-internals' },
          { id: 'worker', type: 'text', text: 'Worker',          x: 0,    y: 140, category: 'service' },
          { id: 'queue',  type: 'text', text: 'Redis Queue',     x: 260,  y: 140, category: 'queue' },
          { id: 'db',     type: 'text', text: 'Postgres',        x: 260,  y: 0,   category: 'database' },
        ],
        edges: [
          { id: 'e1', fromNode: 'web',    toNode: 'api',    label: 'HTTPS' },
          { id: 'e2', fromNode: 'api',    toNode: 'db',     label: 'SQL' },
          { id: 'e3', fromNode: 'api',    toNode: 'queue',  label: 'enqueue' },
          { id: 'e4', fromNode: 'queue',  toNode: 'worker', label: 'dequeue' },
          { id: 'e5', fromNode: 'worker', toNode: 'db',     label: 'writes' },
        ],
      };

      const canvases = {
        'api-internals': {
          theme: { base: 'midnight', categories },
          nodes: [
            { id: 'router',  type: 'text', text: 'Router',    x: 0,   y: 0, category: 'component' },
            { id: 'auth',    type: 'text', text: 'Auth MW',   x: 220, y: 0, category: 'component' },
            { id: 'handler', type: 'text', text: 'Handlers',  x: 440, y: 0, category: 'component' },
            { id: 'orm',     type: 'text', text: 'ORM Layer', x: 660, y: 0, category: 'component' },
          ],
          edges: [
            { id: 'e1', fromNode: 'router',  toNode: 'auth' },
            { id: 'e2', fromNode: 'auth',    toNode: 'handler' },
            { id: 'e3', fromNode: 'handler', toNode: 'orm' },
          ],
        },
      };

      SystemCanvas.render(document.getElementById('app'), {
        canvas, canvases,
        theme: 'midnight',
        edgeStyle: 'bezier',
        rootLabel: 'Architecture',
      });
    </script>
  </body>
</html>
```

## Output conventions

- One `.html` file named for the subject (`architecture.html`, `roadmap.html`) or `diagram.html` by default.
- Tell the user the path and `open diagram.html`.
- No extra CSS -- the `<style>` block above is the whole thing. Themes do the rest.
- Read-only. Don't wire `editable`, `onChange`, toolbars, or UI chrome -- this skill produces data; the user explores.

## Checklist

- Every node: `id`, `type`, `x`, `y` (+ `width`/`height` when no category).
- Every edge: unique `id`, `fromNode`, `toNode`.
- Categories defined when ≥3 nodes share a style.
- Non-trivial sub-systems have `ref` + a matching `canvases` entry.
- ≤ ~12 nodes per canvas.
- Theme fits the subject (`blueprint` technical, `midnight` sleek, `light` docs, `roadmap` lanes).
