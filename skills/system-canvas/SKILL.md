---
name: system-canvas
description: Generate a single self-contained HTML file with an interactive, pan-and-zoomable system diagram using system-canvas-standalone from a CDN. Use when the user asks to "draw a diagram", "visualize this system", "explain this architecture", "map the codebase", "show a roadmap", "make a system map", "diagram the data flow", or any time a visual explanation benefits from hierarchy, sub-systems, or more than ~5 boxes. Prefer this over Mermaid, ASCII art, or static SVG when the thing being explained has nested structure (services with internal components, teams with initiatives, pipelines with stages), more than ~8 nodes, or when the user will actually want to explore it. Output is one `.html` file that opens directly in a browser -- no build, no server, no npm install.
---

# system-canvas

Produce one HTML file that renders an interactive, zoomable, optionally-nested diagram using the `system-canvas-standalone` CDN bundle. The user opens it in a browser and pans, zooms, and drills into sub-canvases.

## When to use this

Reach for this skill whenever you would otherwise write a Mermaid block or ASCII diagram and the thing you're explaining has any of:

- **Hierarchy** -- a system with internal components, a monorepo with packages, a team with sub-teams. Use nested sub-canvases; the user clicks a corner indicator and drills in.
- **More than ~8 nodes** -- Mermaid becomes unreadable; ASCII was never readable. Pan and zoom solve this.
- **Mixed concept types** -- services, databases, queues, users, external APIs. Categories give each type a consistent style.
- **Any axis** -- a timeline, a status pipeline, swim lanes. Use `columns` or `rows` with the `roadmap` theme.

If the explanation is three boxes and two arrows, just use Mermaid. This skill is for when you want the user to actually explore.

## The template

Write one HTML file. Substitute the `canvas` object and optionally `canvases`, `theme`, `edgeStyle`. Nothing else needs to change.

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

After writing, tell the user the path and suggest `open <file>.html` (macOS) or `xdg-open` (Linux). Do not spin up a dev server. Do not inline the bundle.

## Data model you actually need

```js
{
  theme: { base: 'midnight', categories: { /* optional -- see below */ } },
  nodes: [
    { id: 'api', type: 'text', text: 'API Server', x: 0, y: 0, category: 'service' },
  ],
  edges: [
    { id: 'e1', fromNode: 'api', toNode: 'db', label: 'queries' },
  ],
  columns: [ /* optional lanes -- see Lanes */ ],
  rows: [ /* optional */ ],
}
```

**Node types** (`type` field):
- `text` -- default. Has a `text` field. Use this unless you have a reason not to.
- `file` -- represents a file. Has a `file` field (path). Renders with file styling.
- `link` -- represents a URL. Has a `url` field. Renders with link styling.
- `group` -- translucent container. Has a `label` field. Place child nodes spatially inside its rect; dragging a group moves contained children.

**Required on every node**: `id` (unique string), `type`, `x`, `y`. If no `category` is set, also set `width` and `height`.

**Required on every edge**: `id` (unique string), `fromNode`, `toNode`. Optional but encouraged: `label`. Optional: `fromSide` / `toSide` (`'top' | 'right' | 'bottom' | 'left'`) to force anchor sides -- usually let it auto-route.

**The three extension fields**:
- `category` on a node -- maps to a `CategoryDefinition` in the theme. Supplies default width, height, fill, stroke, icon. Set this instead of repeating `width`/`height`/`color` on every node.
- `ref` on a node -- string key into the `canvases` map. Makes the node navigable; a corner indicator appears. Clicking it drills into that sub-canvas.
- `theme` at the top level -- inline theme override. Most commonly `{ base: 'midnight', categories: {...} }`.

## Layout heuristics (so coordinates don't come out garbage)

- Default node size is roughly **160x70**. If you don't set a category or explicit size, assume that footprint.
- Horizontal spacing between peer nodes: **~240px** (node width + ~80px gap).
- Vertical spacing: **~120px**.
- Origin `(0, 0)` is fine -- the viewport auto-fits to content on mount.
- Use **negative coordinates** freely. Centering the diagram around the origin often reads better than starting at `(0, 0)`.
- **Left-to-right** for data flow / pipelines / request paths.
- **Top-down** for hierarchies / org charts / call stacks.
- **Radial** (central node, peers around it) for hub-and-spoke systems.
- Cap any single canvas at **~12 nodes**. Beyond that, extract sub-systems into nested canvases via `ref`.

**Group nodes**: make them large enough to visually contain their children. Example: four 160x70 service nodes laid out in a 2x2 grid need a group around 380x220. Place the group's `(x, y)` at the top-left of the bounding rect. Groups render *behind* their contents.

## Categories: define once, reference everywhere

Skip this and every node will need `width`, `height`, `color` spelled out -- the diagram ends up inconsistent and looks hand-rolled. Define a category per concept type:

```js
const canvas = {
  theme: {
    base: 'midnight',
    categories: {
      service:  { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(6,78,59,0.4)',  stroke: '#34d399' },
      database: { defaultWidth: 140, defaultHeight: 70, fill: 'rgba(76,29,149,0.4)', stroke: '#a78bfa' },
      queue:    { defaultWidth: 140, defaultHeight: 60, fill: 'rgba(120,53,15,0.4)', stroke: '#fbbf24' },
      external: { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(30,41,59,0.4)',  stroke: '#94a3b8' },
    },
  },
  nodes: [
    { id: 'api', type: 'text', text: 'API',     x: 0,   y: 0, category: 'service' },
    { id: 'db',  type: 'text', text: 'Postgres', x: 240, y: 0, category: 'database' },
  ],
  edges: [{ id: 'e1', fromNode: 'api', toNode: 'db', label: 'SQL' }],
};
```

Three to six categories is usually the sweet spot. Pick distinct hues so the diagram reads at a glance.

### Category slots (optional, powerful)

A category can declare `slots` -- small visual add-ons the library renders in fixed positions on every node of that category. Use them when a node has a piece of at-a-glance state worth showing without cluttering the label. Slot kinds: `color` (accent strip), `progress` (0..1 bar), `count` (badge), `text` (header/footer kicker), `dot`, or `custom` (your own SVG). Positions: `topEdge` / `bottomEdge` / `leftEdge` / `rightEdge`, four corners (`topLeft`/`topRight`/`bottomLeft`/`bottomRight`), or inset strips `header` / `footer`. One slot per position.

Slot values can be static or a function of the node: `value: (ctx) => ctx.node.customData.progress`. If the node has a `ref`, `ctx.rollup(pred)` rolls up its sub-canvas so e.g. a parent service node can show "3/5 healthy" or a progress bar derived from children. Example:

```js
service: {
  defaultWidth: 160, defaultHeight: 70,
  fill: 'rgba(6,78,59,0.4)', stroke: '#34d399',
  slots: {
    header: { kind: 'text', value: 'SERVICE' },
    bottomEdge: {
      kind: 'progress',
      value: ({ rollup }) => rollup(n => n.customData?.status === 'ok').fraction,
      color: '#34d399',
    },
  },
},
```

Skip slots for simple diagrams. Reach for them when the visual benefits from showing state, counts, progress, or status without reading the label.

## Nested sub-canvases: the killer feature

This is what makes `system-canvas` better than Mermaid for explaining real systems. A node with a `ref` becomes navigable; provide a `canvases` map to supply the drill-down.

```js
const canvases = {
  'api-internals': {
    nodes: [
      { id: 'router',  type: 'text', text: 'Router',     x: 0,   y: 0,  category: 'component' },
      { id: 'auth',    type: 'text', text: 'Auth MW',    x: 240, y: 0,  category: 'component' },
      { id: 'handler', type: 'text', text: 'Handlers',   x: 480, y: 0,  category: 'component' },
    ],
    edges: [
      { id: 'e1', fromNode: 'router',  toNode: 'auth' },
      { id: 'e2', fromNode: 'auth',    toNode: 'handler' },
    ],
  },
};

const canvas = {
  theme: { base: 'midnight', categories: { /* ... */ } },
  nodes: [
    { id: 'api', type: 'text', text: 'API Server', x: 0, y: 0, category: 'service', ref: 'api-internals' },
    { id: 'db',  type: 'text', text: 'Postgres',   x: 240, y: 0, category: 'database' },
  ],
  edges: [{ id: 'e1', fromNode: 'api', toNode: 'db' }],
};

SystemCanvas.render(document.getElementById('app'), { canvas, canvases, theme: 'midnight' });
```

The user clicks the corner indicator on the `api` node to zoom into `api-internals`, and a breadcrumb trail lets them navigate back. Sub-canvases can themselves have nodes with `ref`s -- nest as deeply as the subject matter warrants.

**When to nest**: whenever describing one node would require more than a sentence, or whenever a node itself has substantial internal structure worth showing.

## Edges

- Always give every edge a unique `id`.
- Add a `label` whenever the relationship is non-obvious. "HTTPS", "publishes", "reads from", "depends on" all earn their keep. Skip labels when the arrow direction is self-evident.
- Pick `edgeStyle` once at the top level:
  - `'bezier'` (default) -- organic curves. Best for most diagrams.
  - `'orthogonal'` -- right-angle routing. Best for formal architecture diagrams where the boxes are grid-aligned.
  - `'straight'` -- direct lines. Best for sparse diagrams or when you want a utilitarian feel.

## Themes

Pass `theme: 'name'` (string) for a built-in base, or an object `{ base: 'name', categories: {...} }` to extend one with categories. Built-ins:

- `'midnight'` -- deep blue-black. Slick, high-contrast. Default choice for technical demos.
- `'dark'` -- neutral dark gray. Good fallback when midnight feels too blue.
- `'blueprint'` -- cyan-on-navy grid. Perfect for "this is an architecture" vibes.
- `'light'` -- white background. Use when the diagram will be embedded in docs or a light-themed page.
- `'warm'` -- cream background with warm accents. Approachable, editorial.
- `'roadmap'` -- paired with `columns`/`rows` for timeline and swim-lane diagrams. Ships with initiative, milestone, outcome, blocker categories.

## Lanes (only when there's a natural axis)

If the diagram has an ordered axis -- time (Q1 / Q2 / Q3), status (Now / Next / Later), pipeline stages (Ingest / Transform / Serve), or swim-lane teams -- use `columns` (vertical bands) or `rows` (horizontal bands). Pair with the `roadmap` theme.

```js
const canvas = {
  theme: { base: 'roadmap' },
  columns: [
    { id: 'now',    label: 'Now',    start: 0,   size: 320 },
    { id: 'next',   label: 'Next',   start: 320, size: 320 },
    { id: 'later',  label: 'Later',  start: 640, size: 320 },
  ],
  nodes: [
    { id: 'a', type: 'text', text: 'Ship v1',     x: 40,  y: 40, category: 'initiative' },
    { id: 'b', type: 'text', text: 'Auth rework', x: 360, y: 40, category: 'initiative' },
  ],
};

SystemCanvas.render(document.getElementById('app'), { canvas, laneHeaders: 'pinned' });
```

Skip lanes for non-axial diagrams (most architecture diagrams). They add noise.

## Complete worked example

A working two-level diagram. Copy, adapt, ship.

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
        service:  { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(6,78,59,0.4)',   stroke: '#34d399' },
        database: { defaultWidth: 140, defaultHeight: 70, fill: 'rgba(76,29,149,0.4)',  stroke: '#a78bfa' },
        queue:    { defaultWidth: 140, defaultHeight: 60, fill: 'rgba(120,53,15,0.4)',  stroke: '#fbbf24' },
        external: { defaultWidth: 160, defaultHeight: 70, fill: 'rgba(30,41,59,0.4)',   stroke: '#94a3b8' },
        component:{ defaultWidth: 140, defaultHeight: 60, fill: 'rgba(30,64,175,0.4)',  stroke: '#60a5fa' },
      };

      const canvas = {
        theme: { base: 'midnight', categories },
        nodes: [
          { id: 'web',    type: 'text', text: 'Web App\nReact',     x: -260, y: 0,  category: 'external' },
          { id: 'api',    type: 'text', text: 'API Server',         x: 0,    y: 0,  category: 'service', ref: 'api-internals' },
          { id: 'worker', type: 'text', text: 'Worker',             x: 0,    y: 140, category: 'service' },
          { id: 'queue',  type: 'text', text: 'Redis Queue',        x: 260,  y: 140, category: 'queue' },
          { id: 'db',     type: 'text', text: 'Postgres',           x: 260,  y: 0,  category: 'database' },
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
        canvas,
        canvases,
        theme: 'midnight',
        edgeStyle: 'bezier',
        rootLabel: 'Architecture',
      });
    </script>
  </body>
</html>
```

## Output conventions

- Write one `.html` file (default: `diagram.html` in the current working directory, or a name matching the subject -- `architecture.html`, `roadmap.html`).
- Tell the user the path and how to open it (`open diagram.html`).
- Keep the `<style>` block to the minimum above. No extra CSS -- the canvas fills the viewport and themes handle the rest.
- Load the bundle from `https://unpkg.com/system-canvas-standalone@latest/dist/system-canvas.min.js`. Always `@latest`, always `.min.js`.
- Do not wire `editable`, `onChange`, toolbars, or any UI chrome. This skill is for read-only visual explanations. The agent produces the `canvas` data; the user explores it.

## Quick checklist before finishing

- Every node has `id`, `type`, `x`, `y`.
- Every node without a `category` has `width` and `height`.
- Every edge has a unique `id`, `fromNode`, `toNode`.
- Categories are defined if more than ~3 nodes share a visual style.
- Any node that represents a non-trivial sub-system has a `ref` and a matching entry in `canvases`.
- The diagram fits the chosen theme (`blueprint` for technical, `midnight` for sleek, `light` for docs, `roadmap` for lanes).
- No single canvas has more than ~12 nodes.
