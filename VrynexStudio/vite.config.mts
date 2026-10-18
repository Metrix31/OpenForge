import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  base: './', // wichtig für file:// im Produktivbetrieb
  build: {
    outDir: '../../dist/electron/renderer', // relativ zu root
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000, // Monaco ist groß
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: { overlay: false },
  },
});
