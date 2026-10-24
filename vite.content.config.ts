import { defineConfig } from 'vite';

// Content script: one self-contained IIFE file (no imports at runtime).
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    lib: {
      entry: 'src/content/index.ts',
      formats: ['iife'],
      name: 'FocusTubeContent',
      fileName: () => 'content.js',
    },
  },
});
