import { defineConfig } from 'tsup'

export default defineConfig([
  // IIFE bundle for <script> tag usage (minified + unminified)
  {
    entry: { 'system-canvas': 'src/index.tsx' },
    format: ['iife'],
    globalName: 'SystemCanvas',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: true,
    clean: true,
    dts: false,
    outExtension: () => ({ js: '.js' }),
    define: { 'process.env.NODE_ENV': '"production"' },
    esbuildOptions(opts) {
      opts.legalComments = 'none'
    },
  },
  {
    entry: { 'system-canvas.min': 'src/index.tsx' },
    format: ['iife'],
    globalName: 'SystemCanvas',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    sourcemap: true,
    clean: false,
    dts: false,
    outExtension: () => ({ js: '.js' }),
    define: { 'process.env.NODE_ENV': '"production"' },
    esbuildOptions(opts) {
      opts.legalComments = 'none'
    },
  },
  // ESM bundle for bundler users who still want a single-file drop-in
  {
    entry: { 'system-canvas.esm': 'src/index.tsx' },
    format: ['esm'],
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: true,
    clean: false,
    dts: true,
    outExtension: () => ({ js: '.js' }),
    define: { 'process.env.NODE_ENV': '"production"' },
  },
])
