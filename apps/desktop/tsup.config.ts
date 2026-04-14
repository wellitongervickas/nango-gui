import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts'],
  format: ['cjs'],
  outDir: 'dist',
  splitting: false,
  external: ['electron', 'electron-updater'],
  noExternal: ['@nango-gui/main', '@nango-gui/shared'],
})
